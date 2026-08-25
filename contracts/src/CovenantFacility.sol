// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol";
import {INativeQueryVerifier, NativeQueryVerifierLib, IChainInfo, NativeChainInfoLib} from "./VerifierInterface.sol";

/// @title COVENANT — proof-conditioned revolving credit lines
/// @notice Hackathon prototype: native test CTC is the facility asset; external obligations are
///         verified from Attestcoin-covered EVM receipts before future tranches unlock.
contract CovenantFacility is ReentrancyGuard {
    using EvmV1Decoder for bytes;

    bytes32 public constant TRANSFER_EVENT_SIGNATURE =
        0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

    enum FacilityStatus {
        None,
        Active,
        Frozen,
        Closed
    }

    enum CovenantStatus {
        None,
        Proposed,
        Pending,
        Satisfied,
        Expired,
        Cancelled
    }

    struct Facility {
        address lender;
        address borrower;
        uint256 creditLimit;
        uint256 trancheSize;
        uint256 unlocked;
        uint256 drawn;
        uint256 activeCovenantId;
        uint64 maturityCreditcoinBlock;
        FacilityStatus status;
    }

    /// @dev Once a covenant leaves `Proposed` (borrower acceptance), every field below is
    ///      permanent: no mutation path exists. The committed evidence policy is this struct
    ///      plus the deterministic matching rules in `_matchingTransferAmount` and the global
    ///      one-time query identity. The committed consequence is: satisfaction expands the
    ///      facility's drawable credit by exactly one tranche; expiry freezes the facility —
    ///      but only once the Attestcoin frontier (0x…0FD3) has provably advanced beyond the
    ///      eligible source range plus `freezeFrontierMarginSourceBlocks`, AND the Creditcoin
    ///      cure deadline has passed. A borrower is never frozen merely because Attestcoin has
    ///      not yet attested a valid source transaction.
    struct Covenant {
        uint256 facilityId;
        uint64 chainKey;
        address token;
        address payer;
        address recipient;
        uint256 requiredAmount;
        uint256 verifiedAmount;
        uint64 startSourceBlock;
        uint64 endSourceBlock;
        uint64 proofDeadlineCreditcoinBlock;
        uint64 freezeFrontierMarginSourceBlocks;
        CovenantStatus status;
    }

    INativeQueryVerifier public immutable VERIFIER;
    IChainInfo public immutable CHAIN_INFO;

    uint256 public nextFacilityId = 1;
    uint256 public nextCovenantId = 1;

    mapping(uint256 => Facility) public facilities;
    mapping(uint256 => Covenant) public covenants;
    mapping(bytes32 => bool) public processedQueries;

    error InvalidFacility();
    error InvalidCovenant();
    error NotLender();
    error NotBorrower();
    error FacilityNotActive();
    error CovenantNotPending();
    error ActiveCovenantExists();
    error InvalidTerms();
    error DrawExceedsUnlocked();
    error ProofDeadlineNotReached();
    error NotFacilityParty();
    error FacilityNotClosable();
    error FacilityMatured();
    error SourceBlockOutsideWindow();
    error WrongSourceChain();
    error QueryAlreadyProcessed();
    error ProofVerificationFailed();
    error ProofDeadlinePassed();
    error FrontierNotAdvanced(uint64 requiredAttestedHeight, uint64 latestAttestedHeight);
    error NoAttestationData();
    error SourceTransactionFailed();
    error NoMatchingPayment();
    error NativeTransferFailed();

    event FacilityCreated(
        uint256 indexed facilityId,
        address indexed lender,
        address indexed borrower,
        uint256 creditLimit,
        uint256 trancheSize,
        uint256 initiallyUnlocked,
        uint64 maturityCreditcoinBlock
    );
    event Drawn(uint256 indexed facilityId, address indexed borrower, uint256 amount, uint256 totalDrawn);
    event CovenantCreated(
        uint256 indexed covenantId,
        uint256 indexed facilityId,
        uint64 indexed chainKey,
        address token,
        address payer,
        address recipient,
        uint256 requiredAmount,
        uint64 startSourceBlock,
        uint64 endSourceBlock,
        uint64 proofDeadlineCreditcoinBlock
    );
    event CovenantAccepted(uint256 indexed covenantId, uint256 indexed facilityId, address indexed borrower);
    event CovenantCancelled(uint256 indexed covenantId, uint256 indexed facilityId);
    event EvidenceAccepted(
        uint256 indexed covenantId,
        bytes32 indexed queryId,
        uint64 indexed sourceBlock,
        uint256 matchedAmount,
        uint256 verifiedAmount
    );
    event CovenantSatisfied(uint256 indexed covenantId, uint256 indexed facilityId, uint256 newUnlockedAmount);
    event FacilityFrozen(uint256 indexed facilityId, uint256 indexed covenantId);
    event FacilityClosed(uint256 indexed facilityId, uint256 lenderRefund);

    constructor() {
        VERIFIER = NativeQueryVerifierLib.getVerifier();
        CHAIN_INFO = NativeChainInfoLib.getChainInfo();
    }

    /// @notice Lender escrows the complete native-test-CTC credit limit at creation.
    function createFacility(address borrower, uint256 trancheSize, uint64 maturityCreditcoinBlock)
        external
        payable
        returns (uint256 facilityId)
    {
        if (
            borrower == address(0) || trancheSize == 0 || msg.value == 0 || trancheSize > msg.value
                || maturityCreditcoinBlock <= block.number
        ) {
            revert InvalidTerms();
        }

        facilityId = nextFacilityId++;
        facilities[facilityId] = Facility({
            lender: msg.sender,
            borrower: borrower,
            creditLimit: msg.value,
            trancheSize: trancheSize,
            unlocked: trancheSize,
            drawn: 0,
            activeCovenantId: 0,
            maturityCreditcoinBlock: maturityCreditcoinBlock,
            status: FacilityStatus.Active
        });

        emit FacilityCreated(
            facilityId, msg.sender, borrower, msg.value, trancheSize, trancheSize, maturityCreditcoinBlock
        );
    }

    function draw(uint256 facilityId, uint256 amount) external nonReentrant {
        Facility storage facility = facilities[facilityId];
        if (facility.status == FacilityStatus.None) revert InvalidFacility();
        if (msg.sender != facility.borrower) revert NotBorrower();
        if (facility.status != FacilityStatus.Active) revert FacilityNotActive();
        if (block.number > facility.maturityCreditcoinBlock) revert FacilityMatured();
        if (amount == 0 || facility.drawn + amount > facility.unlocked) revert DrawExceedsUnlocked();

        facility.drawn += amount;
        (bool ok,) = payable(facility.borrower).call{value: amount}("");
        if (!ok) revert NativeTransferFailed();

        emit Drawn(facilityId, facility.borrower, amount, facility.drawn);
    }

    /// @notice Creates the immutable evidence policy that gates the next tranche.
    /// @dev The proof/cure deadline is on Creditcoin, deliberately separate from the
    ///      source-chain event window. `freezeFrontierMarginSourceBlocks` commits how far past
    ///      `endSourceBlock` the Attestcoin attestation frontier (0x…0FD3) must advance before
    ///      a missed-deadline freeze becomes eligible — protecting the borrower from being
    ///      punished while their valid source transaction is not yet attested.
    function createCovenant(
        uint256 facilityId,
        uint64 chainKey,
        address token,
        address recipient,
        uint256 requiredAmount,
        uint64 startSourceBlock,
        uint64 endSourceBlock,
        uint64 proofDeadlineCreditcoinBlock,
        uint64 freezeFrontierMarginSourceBlocks
    ) external returns (uint256 covenantId) {
        Facility storage facility = facilities[facilityId];
        if (facility.status == FacilityStatus.None) revert InvalidFacility();
        if (msg.sender != facility.lender) revert NotLender();
        if (facility.status != FacilityStatus.Active) revert FacilityNotActive();
        if (facility.activeCovenantId != 0) revert ActiveCovenantExists();
        if (
            chainKey == 0 || token == address(0) || recipient == address(0) || requiredAmount == 0
                || startSourceBlock == 0 || endSourceBlock < startSourceBlock
                || proofDeadlineCreditcoinBlock <= block.number
        ) revert InvalidTerms();
        if (facility.unlocked >= facility.creditLimit) revert InvalidTerms();
        if (proofDeadlineCreditcoinBlock > facility.maturityCreditcoinBlock) revert InvalidTerms();

        covenantId = nextCovenantId++;
        covenants[covenantId] = Covenant({
            facilityId: facilityId,
            chainKey: chainKey,
            token: token,
            payer: facility.borrower,
            recipient: recipient,
            requiredAmount: requiredAmount,
            verifiedAmount: 0,
            startSourceBlock: startSourceBlock,
            endSourceBlock: endSourceBlock,
            proofDeadlineCreditcoinBlock: proofDeadlineCreditcoinBlock,
            freezeFrontierMarginSourceBlocks: freezeFrontierMarginSourceBlocks,
            status: CovenantStatus.Proposed
        });
        facility.activeCovenantId = covenantId;

        emit CovenantCreated(
            covenantId,
            facilityId,
            chainKey,
            token,
            facility.borrower,
            recipient,
            requiredAmount,
            startSourceBlock,
            endSourceBlock,
            proofDeadlineCreditcoinBlock
        );
    }

    /// @notice Borrower accepts the immutable evidence policy before it can gate their facility.
    function acceptCovenant(uint256 covenantId) external {
        Covenant storage covenant = covenants[covenantId];
        if (covenant.status == CovenantStatus.None) revert InvalidCovenant();
        if (covenant.status != CovenantStatus.Proposed) revert CovenantNotPending();

        Facility storage facility = facilities[covenant.facilityId];
        if (msg.sender != facility.borrower) revert NotBorrower();
        if (facility.status != FacilityStatus.Active) revert FacilityNotActive();
        if (block.number > facility.maturityCreditcoinBlock) revert FacilityMatured();
        if (block.number >= covenant.proofDeadlineCreditcoinBlock) revert InvalidTerms();

        covenant.status = CovenantStatus.Pending;
        emit CovenantAccepted(covenantId, covenant.facilityId, msg.sender);
    }

    /// @notice Either party may cancel a proposal before the borrower accepts it.
    function cancelProposedCovenant(uint256 covenantId) external {
        Covenant storage covenant = covenants[covenantId];
        if (covenant.status == CovenantStatus.None) revert InvalidCovenant();
        if (covenant.status != CovenantStatus.Proposed) revert CovenantNotPending();

        Facility storage facility = facilities[covenant.facilityId];
        if (msg.sender != facility.lender && msg.sender != facility.borrower) revert NotFacilityParty();

        covenant.status = CovenantStatus.Cancelled;
        facility.activeCovenantId = 0;
        emit CovenantCancelled(covenantId, covenant.facilityId);
    }

    /// @notice Permissionless evidence submission. The worker has no authority; the proof does.
    function submitEvidence(
        uint256 covenantId,
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) external returns (bytes32 queryId, uint256 matchedAmount) {
        Covenant storage covenant = covenants[covenantId];
        if (covenant.status == CovenantStatus.None) revert InvalidCovenant();
        if (covenant.status != CovenantStatus.Pending) revert CovenantNotPending();
        if (chainKey != covenant.chainKey) revert WrongSourceChain();
        if (blockHeight < covenant.startSourceBlock || blockHeight > covenant.endSourceBlock) {
            revert SourceBlockOutsideWindow();
        }
        if (block.number > covenant.proofDeadlineCreditcoinBlock) revert ProofDeadlinePassed();

        INativeQueryVerifier.MerkleProof memory merkleProof =
            INativeQueryVerifier.MerkleProof({root: merkleRoot, siblings: siblings});
        queryId = _computeQueryId(chainKey, blockHeight, merkleProof);
        if (processedQueries[queryId]) revert QueryAlreadyProcessed();

        INativeQueryVerifier.ContinuityProof memory continuityProof =
            INativeQueryVerifier.ContinuityProof({lowerEndpointDigest: lowerEndpointDigest, roots: continuityRoots});

        bool verified = VERIFIER.verifyAndEmit(chainKey, blockHeight, encodedTransaction, merkleProof, continuityProof);
        if (!verified) revert ProofVerificationFailed();

        matchedAmount = _matchingTransferAmount(covenant, encodedTransaction);
        if (matchedAmount == 0) revert NoMatchingPayment();

        // Set only after all semantic checks. A reverted wrong-policy submission cannot censor a valid proof.
        processedQueries[queryId] = true;
        covenant.verifiedAmount += matchedAmount;

        emit EvidenceAccepted(covenantId, queryId, blockHeight, matchedAmount, covenant.verifiedAmount);

        if (covenant.verifiedAmount >= covenant.requiredAmount) {
            _satisfyCovenant(covenantId, covenant);
        }
    }

    /// @notice Deterministic freeze eligibility. A pending covenant may be frozen only when
    ///      BOTH hold:
    ///      (1) the Creditcoin-side proof/cure deadline has passed, and
    ///      (2) the Attestcoin attestation frontier on the covenant's source chain has
    ///          advanced to at least `endSourceBlock + freezeFrontierMarginSourceBlocks`,
    ///          observed through ChainInfo at 0x…0FD3.
    ///      Condition (2) makes it impossible to punish a borrower while Attestcoin has not
    ///      yet had the chance to attest a valid source transaction.
    /// @return eligible whether freeze would succeed right now.
    function isFreezable(uint256 covenantId) public view returns (bool eligible) {
        Covenant storage covenant = covenants[covenantId];
        if (covenant.status != CovenantStatus.Pending) return false;
        if (block.number <= covenant.proofDeadlineCreditcoinBlock) return false;

        (uint64 latestHeight,,, bool exists) = CHAIN_INFO.get_latest_attestation_height_and_hash(covenant.chainKey);
        if (!exists) return false;
        return _frontierSufficient(covenant, latestHeight);
    }

    /// @notice Anyone may freeze once the immutable cure deadline passed AND the committed
    ///      Attestcoin frontier requirement is observably satisfied. Reverts otherwise.
    function freezeExpiredCovenant(uint256 covenantId) external {
        Covenant storage covenant = covenants[covenantId];
        if (covenant.status == CovenantStatus.None) revert InvalidCovenant();
        if (covenant.status != CovenantStatus.Pending) revert CovenantNotPending();
        if (block.number <= covenant.proofDeadlineCreditcoinBlock) revert ProofDeadlineNotReached();

        (uint64 latestHeight,, bool isAttestation, bool exists) =
            CHAIN_INFO.get_latest_attestation_height_and_hash(covenant.chainKey);
        if (!exists || !isAttestation) revert NoAttestationData();
        uint64 requiredHeight = covenant.endSourceBlock + covenant.freezeFrontierMarginSourceBlocks;
        if (latestHeight < requiredHeight) revert FrontierNotAdvanced(requiredHeight, latestHeight);

        Facility storage facility = facilities[covenant.facilityId];
        covenant.status = CovenantStatus.Expired;
        facility.status = FacilityStatus.Frozen;
        facility.activeCovenantId = 0;

        emit FacilityFrozen(covenant.facilityId, covenantId);
    }

    function _frontierSufficient(Covenant storage covenant, uint64 latestHeight) internal view returns (bool) {
        uint256 required = uint256(covenant.endSourceBlock) + covenant.freezeFrontierMarginSourceBlocks;
        return uint256(latestHeight) >= required;
    }

    /// @notice Lender can close a frozen or fully-used facility and recover undrawn escrow.
    function closeFacility(uint256 facilityId) external nonReentrant {
        Facility storage facility = facilities[facilityId];
        if (facility.status == FacilityStatus.None) revert InvalidFacility();
        if (msg.sender != facility.lender) revert NotLender();
        if (facility.status == FacilityStatus.Closed) revert InvalidTerms();
        if (facility.activeCovenantId != 0) revert ActiveCovenantExists();

        bool fullyUsed = facility.drawn >= facility.creditLimit;
        bool matured = block.number > facility.maturityCreditcoinBlock;
        if (facility.status != FacilityStatus.Frozen && !fullyUsed && !matured) revert FacilityNotClosable();

        uint256 refund = facility.creditLimit - facility.drawn;
        facility.status = FacilityStatus.Closed;
        facility.unlocked = facility.drawn;

        if (refund > 0) {
            (bool ok,) = payable(facility.lender).call{value: refund}("");
            if (!ok) revert NativeTransferFailed();
        }
        emit FacilityClosed(facilityId, refund);
    }

    function availableToDraw(uint256 facilityId) external view returns (uint256) {
        Facility storage facility = facilities[facilityId];
        if (
            facility.status != FacilityStatus.Active || block.number > facility.maturityCreditcoinBlock
                || facility.unlocked <= facility.drawn
        ) return 0;
        return facility.unlocked - facility.drawn;
    }

    function _satisfyCovenant(uint256 covenantId, Covenant storage covenant) internal {
        Facility storage facility = facilities[covenant.facilityId];
        covenant.status = CovenantStatus.Satisfied;
        facility.activeCovenantId = 0;

        uint256 nextUnlocked = facility.unlocked + facility.trancheSize;
        facility.unlocked = nextUnlocked > facility.creditLimit ? facility.creditLimit : nextUnlocked;

        emit CovenantSatisfied(covenantId, covenant.facilityId, facility.unlocked);
    }

    function _matchingTransferAmount(Covenant storage covenant, bytes calldata encodedTransaction)
        internal
        view
        returns (uint256 total)
    {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        if (!EvmV1Decoder.isValidTransactionType(txType)) revert InvalidTerms();

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        if (receipt.receiptStatus != 1) revert SourceTransactionFailed();

        EvmV1Decoder.LogEntry[] memory logs = EvmV1Decoder.getLogsByEventSignature(receipt, TRANSFER_EVENT_SIGNATURE);

        for (uint256 i = 0; i < logs.length; ++i) {
            EvmV1Decoder.LogEntry memory log = logs[i];
            if (log.address_ != covenant.token) continue;
            if (log.topics.length != 3) continue;
            if (log.topics[0] != TRANSFER_EVENT_SIGNATURE) continue;
            if (log.data.length != 32) continue;

            address from = address(uint160(uint256(log.topics[1])));
            address to = address(uint160(uint256(log.topics[2])));
            if (from != covenant.payer || to != covenant.recipient) continue;

            total += abi.decode(log.data, (uint256));
        }
    }

    /// @dev Matches the query identity shape used by the current official USCBase example.
    function _computeQueryId(uint64 chainKey, uint64 blockHeight, INativeQueryVerifier.MerkleProof memory merkleProof)
        internal
        view
        returns (bytes32 queryId)
    {
        uint256 txIndex = VERIFIER.calculateTxIndex(merkleProof);
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, chainKey)
            mstore(add(ptr, 32), shl(192, blockHeight))
            mstore(add(ptr, 40), txIndex)
            queryId := keccak256(ptr, 72)
        }
    }
}
