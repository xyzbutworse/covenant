// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {CovenantFacility} from "../src/CovenantFacility.sol";
import {INativeQueryVerifier, NativeQueryVerifierLib, NativeChainInfoLib} from "../src/VerifierInterface.sol";
import {MockNativeQueryVerifier} from "./MockNativeQueryVerifier.sol";
import {MockChainInfo} from "./MockChainInfo.sol";

/// @notice Adversarial prosecution of COVENANT's own economic invariants. Proof generation is
///         out of scope here; the etched 0x…0FD2 double only supplies native verification so
///         capital transitions can be driven through the real submission path.
contract CovenantFacilityAdversarialTest is Test {
    CovenantFacility internal covenant;
    string internal fixturesJson;
    bytes internal validTxBytes;
    bytes32 internal validRoot;
    bytes32[] internal validSibHashes;
    bool[] internal validSibIsLeft;
    bytes32 internal validLower;
    bytes32[] internal validRoots;
    bytes internal partialATxBytes;
    bytes32 internal partialARoot;
    bytes32[] internal partialASibHashes;
    bool[] internal partialASibIsLeft;
    bytes32 internal partialALower;
    bytes32[] internal partialARoots;
    uint64 internal partialAHeight;

    uint64 internal constant VALID_HEIGHT = 9_128_468;
    uint64 internal constant CHAIN_KEY = 11;
    address internal usdc;
    address internal recipientAddr;

    address internal lender = makeAddr("lender");
    address internal borrower = makeAddr("borrower");
    address internal attacker = makeAddr("attacker");

    uint256 internal constant TRANCHE = 20 ether;
    uint256 internal constant LIMIT = 100 ether;

    function setUp() public {
        fixturesJson = vm.readFile("test/fixtures/fixtures.json");
        usdc = vm.parseJsonAddress(fixturesJson, "$.meta.usdc");
        recipientAddr = vm.parseJsonAddress(fixturesJson, "$.meta.recipient");

        validTxBytes = vm.parseJsonBytes(fixturesJson, "$.scenarios.valid.txBytes");
        validRoot = vm.parseJsonBytes32(fixturesJson, "$.scenarios.valid.merkleProof.root");
        validSibHashes = vm.parseJsonBytes32Array(fixturesJson, "$.scenarios.valid.merkleProof.siblingHashes");
        validSibIsLeft = vm.parseJsonBoolArray(fixturesJson, "$.scenarios.valid.merkleProof.siblingIsLeft");
        validLower = vm.parseJsonBytes32(fixturesJson, "$.scenarios.valid.continuityProof.lowerEndpointDigest");
        validRoots = vm.parseJsonBytes32Array(fixturesJson, "$.scenarios.valid.continuityProof.roots");

        partialATxBytes = vm.parseJsonBytes(fixturesJson, "$.scenarios.partialA.txBytes");
        partialARoot = vm.parseJsonBytes32(fixturesJson, "$.scenarios.partialA.merkleProof.root");
        partialASibHashes = vm.parseJsonBytes32Array(fixturesJson, "$.scenarios.partialA.merkleProof.siblingHashes");
        partialASibIsLeft = vm.parseJsonBoolArray(fixturesJson, "$.scenarios.partialA.merkleProof.siblingIsLeft");
        partialALower = vm.parseJsonBytes32(fixturesJson, "$.scenarios.partialA.continuityProof.lowerEndpointDigest");
        partialARoots = vm.parseJsonBytes32Array(fixturesJson, "$.scenarios.partialA.continuityProof.roots");
        partialAHeight = uint64(vm.parseJsonUint(fixturesJson, "$.scenarios.partialA.headerNumber"));

        MockNativeQueryVerifier mockImpl = new MockNativeQueryVerifier();
        vm.etch(NativeQueryVerifierLib.PRECOMPILE_ADDRESS, address(mockImpl).code);
        vm.etch(NativeChainInfoLib.PRECOMPILE_ADDRESS, address(new MockChainInfo()).code);
        covenant = new CovenantFacility();
        vm.deal(lender, 1_000 ether);

        // COVENANT binds covenant payer == facility.borrower on-chain, so the suite borrows
        // as borrower exactly the address the SDK-generated fixtures pay from.
        borrower = vm.parseJsonAddress(fixturesJson, "$.meta.payer");
        vm.deal(borrower, 1_000 ether);
    }

    // ------------------------------------------------------------ shared helpers

    function _entries(bytes32[] memory hashes, bool[] memory isLeft)
        internal
        pure
        returns (INativeQueryVerifier.MerkleProofEntry[] memory s)
    {
        s = new INativeQueryVerifier.MerkleProofEntry[](hashes.length);
        for (uint256 i; i < hashes.length; ++i) {
            s[i] = INativeQueryVerifier.MerkleProofEntry({hash: hashes[i], isLeft: isLeft[i]});
        }
    }

    function _openFacility() internal returns (uint256 id) {
        vm.prank(lender);
        id = covenant.createFacility{value: LIMIT}(borrower, TRANCHE, uint64(block.number + 1_000));
    }

    function _proposeAccepted(uint256 facilityId) internal returns (uint256 covenantId) {
        vm.prank(lender);
        covenantId = covenant.createCovenant(
            facilityId,
            CHAIN_KEY,
            usdc,
            recipientAddr,
            5e6,
            VALID_HEIGHT - 50,
            partialAHeight + 50,
            uint64(block.number + 500),
            0
        );
        vm.prank(borrower);
        covenant.acceptCovenant(covenantId);
    }

    function _submitValid(uint256 covenantId) internal returns (bytes32 queryId, uint256 matched) {
        (queryId, matched) = covenant.submitEvidence(
            covenantId,
            CHAIN_KEY,
            VALID_HEIGHT,
            validTxBytes,
            validRoot,
            _entries(validSibHashes, validSibIsLeft),
            validLower,
            validRoots
        );
    }

    // --------------------------------------------------------- capital & escrow

    function test_NoDrawWithoutEscrowedCapital() public {
        vm.prank(borrower);
        vm.expectRevert(CovenantFacility.InvalidFacility.selector);
        covenant.draw(999, 1 ether);
    }

    function test_EscrowLandsBeforeAnyDrawIsPossible() public {
        uint256 beforeBalance = address(covenant).balance;
        uint256 id = _openFacility();
        assertEq(address(covenant).balance, beforeBalance + LIMIT);
        (,, uint256 creditLimit,,,,,,) = covenant.facilities(id);
        assertEq(creditLimit, LIMIT);
    }

    function test_InitialTrancheCapitalNotDoubleDrawable() public {
        uint256 id = _openFacility();
        vm.startPrank(borrower);
        covenant.draw(id, 12 ether);
        covenant.draw(id, 8 ether); // tranche fully consumed in aggregate
        vm.expectRevert(CovenantFacility.DrawExceedsUnlocked.selector);
        covenant.draw(id, 1 wei);
        vm.stopPrank();

        (,,,, uint256 unlocked, uint256 drawn,,,) = covenant.facilities(id);
        assertEq(drawn, TRANCHE);
    }

    function test_BorrowerCannotDrawBeyondCommittedFacility(uint160 excessSeed) public {
        uint256 id = _openFacility();
        uint256 amount = TRANCHE + 1 + uint256(excessSeed);
        vm.prank(borrower);
        vm.expectRevert(CovenantFacility.DrawExceedsUnlocked.selector);
        covenant.draw(id, amount);
    }

    function test_FutureTrancheLockedUntilItsOwnCovenantSatisfies() public {
        uint256 id = _openFacility();
        uint256 other = _openFacility();
        vm.startPrank(lender);
        uint256 otherCov = covenant.createCovenant(
            other,
            CHAIN_KEY,
            usdc,
            recipientAddr,
            5e6,
            VALID_HEIGHT - 50,
            VALID_HEIGHT + 50,
            uint64(block.number + 500),
            0
        );
        vm.stopPrank();
        vm.prank(borrower);
        covenant.acceptCovenant(otherCov);
        _submitValid(otherCov);

        // The unrelated facility gained nothing.
        assertEq(covenant.availableToDraw(id), TRANCHE);
    }

    function test_SubThresholdPaymentNeverUnlocksCapital() public {
        uint256 id = _openFacility();
        uint256 cid = _proposeAccepted(id);

        vm.prank(attacker); // permissionless submission cannot change economics either
        covenant.submitEvidence(
            cid,
            CHAIN_KEY,
            partialAHeight,
            partialATxBytes,
            partialARoot,
            _entries(partialASibHashes, partialASibIsLeft),
            partialALower,
            partialARoots
        );

        // $3M verified against a $5M requirement: covenant stays binding, capital stays put.
        (,,,,,, uint256 verified,,,,,) = covenant.covenants(cid);
        assertEq(verified, 3e6);
        assertLt(verified, 5e6);
        assertEq(covenant.availableToDraw(id), TRANCHE);

        (,,,, uint256 unlocked,,,, CovenantFacility.FacilityStatus st) = covenant.facilities(id);
        assertEq(unlocked, TRANCHE);

        (,,,,,,,,,,, CovenantFacility.CovenantStatus cst) = covenant.covenants(cid);
        assertEq(uint8(cst), uint8(CovenantFacility.CovenantStatus.Pending));
    }

    function test_MultiTransactionAccumulationThenImmediateDraw() public {
        uint256 id = _openFacility();
        uint256 cid = _proposeAccepted(id);

        vm.prank(attacker);
        covenant.submitEvidence(
            cid,
            CHAIN_KEY,
            partialAHeight,
            partialATxBytes,
            partialARoot,
            _entries(partialASibHashes, partialASibIsLeft),
            partialALower,
            partialARoots
        );
        assertEq(covenant.availableToDraw(id), TRANCHE); // still below threshold

        (bytes32 q2,) = _submitValid(cid); // second distinct transaction completes the requirement
        assertTrue(covenant.processedQueries(q2));
        assertEq(covenant.availableToDraw(id), 2 * TRANCHE);

        vm.prank(borrower);
        covenant.draw(id, TRANCHE);
    }

    function test_StalePeriodEvidenceCannotSatisfyCurrentPeriod() public {
        uint256 id = _openFacility();
        // Current period lives far above the historical fixture blocks.
        vm.prank(lender);
        uint256 cid = covenant.createCovenant(
            id,
            CHAIN_KEY,
            usdc,
            recipientAddr,
            5e6,
            VALID_HEIGHT + 10_000,
            VALID_HEIGHT + 11_000,
            uint64(block.number + 500),
            0
        );
        vm.prank(borrower);
        covenant.acceptCovenant(cid);

        Scenario memory s;
        s.txBytes = validTxBytes;
        s.chainKey = CHAIN_KEY;
        s.height = VALID_HEIGHT - 40; // prior period
        vm.expectRevert(CovenantFacility.SourceBlockOutsideWindow.selector);
        _submitScenario(cid, s);

        s.height = VALID_HEIGHT + 11_001; // after the eligible range
        vm.expectRevert(CovenantFacility.SourceBlockOutsideWindow.selector);
        _submitScenario(cid, s);
    }

    struct Scenario {
        bytes txBytes;
        uint64 chainKey;
        uint64 height;
    }

    function _submitScenario(uint256 covenantId, Scenario memory s) internal returns (bytes32, uint256) {
        return covenant.submitEvidence(
            covenantId,
            s.chainKey,
            s.height,
            s.txBytes,
            validRoot,
            _entries(validSibHashes, validSibIsLeft),
            validLower,
            validRoots
        );
    }

    function test_SourceTransactionCannotServeTwoCovenantsOrTwoFacilities() public {
        uint256 f1 = _openFacility();
        vm.prank(lender);
        uint256 c1 = covenant.createCovenant(
            f1, CHAIN_KEY, usdc, recipientAddr, 5e6, VALID_HEIGHT - 50, VALID_HEIGHT + 50, uint64(block.number + 500), 0
        );
        vm.prank(borrower);
        covenant.acceptCovenant(c1);
        _submitValid(c1);

        // Identical policy on a second facility: same source transaction identity is spent.
        uint256 f2 = _openFacility();
        vm.prank(lender);
        uint256 c2 = covenant.createCovenant(
            f2, CHAIN_KEY, usdc, recipientAddr, 5e6, VALID_HEIGHT - 50, VALID_HEIGHT + 50, uint64(block.number + 500), 0
        );
        vm.prank(borrower);
        covenant.acceptCovenant(c2);

        vm.expectRevert(CovenantFacility.QueryAlreadyProcessed.selector);
        _submitValid(c2);
        assertEq(covenant.availableToDraw(f2), TRANCHE);
    }

    // ------------------------------------------------------- immutability of terms

    function test_AcceptedTermsImmutableAcrossAllTransitionsAndAttackers() public {
        uint256 id = _openFacility();
        vm.prank(lender);
        uint256 cid = covenant.createCovenant(
            id,
            CHAIN_KEY,
            usdc,
            recipientAddr,
            5e6,
            VALID_HEIGHT - 50,
            partialAHeight + 50,
            uint64(block.number + 500),
            0
        );
        CovenantFields memory proposed = _fields(cid);
        vm.prank(borrower);
        covenant.acceptCovenant(cid);
        CovenantFields memory accepted = _fields(cid);

        // Acceptance changed only the status bit; every committed term identical.
        assertEq(proposed.facilityId, accepted.facilityId);
        assertEq(proposed.chainKey, accepted.chainKey);
        assertEq(proposed.token, accepted.token);
        assertEq(proposed.payer, accepted.payer);
        assertEq(proposed.recipient, accepted.recipient);
        assertEq(proposed.requiredAmount, accepted.requiredAmount);
        assertEq(proposed.startSourceBlock, accepted.startSourceBlock);
        assertEq(proposed.endSourceBlock, accepted.endSourceBlock);
        assertEq(proposed.proofDeadlineCreditcoinBlock, accepted.proofDeadlineCreditcoinBlock);

        // Attackers hammer every entry point with crafted arguments; nothing mutates terms.
        vm.startPrank(attacker);
        (bool ok1) = _tryCreateMutatingCovenant(id);
        (bool ok2) = _tryCancel(cid);
        vm.stopPrank();
        assertFalse(ok1);
        assertFalse(ok2);

        _submitValid(cid); // Pending -> Satisfied through the only legitimate path
        CovenantFields memory satisfied = _fields(cid);
        assertEq(satisfied.chainKey, accepted.chainKey);
        assertEq(satisfied.token, accepted.token);
        assertEq(satisfied.payer, accepted.payer);
        assertEq(satisfied.recipient, accepted.recipient);
        assertEq(satisfied.requiredAmount, accepted.requiredAmount);
        assertEq(satisfied.startSourceBlock, accepted.startSourceBlock);
        assertEq(satisfied.endSourceBlock, accepted.endSourceBlock);
        assertEq(satisfied.proofDeadlineCreditcoinBlock, accepted.proofDeadlineCreditcoinBlock);
        assertGt(satisfied.verifiedAmount, accepted.verifiedAmount); // only accumulation moves
    }

    struct CovenantFields {
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
        CovenantFacility.CovenantStatus status;
    }

    function _fields(uint256 cid) internal view returns (CovenantFields memory f) {
        (
            f.facilityId,
            f.chainKey,
            f.token,
            f.payer,
            f.recipient,
            f.requiredAmount,
            f.verifiedAmount,
            f.startSourceBlock,
            f.endSourceBlock,
            f.proofDeadlineCreditcoinBlock,
            f.freezeFrontierMarginSourceBlocks,
            f.status
        ) = covenant.covenants(cid);
    }

    function _tryCreateMutatingCovenant(uint256 id) internal returns (bool ok) {
        // Any second proposal while one is active must fail outright.
        try covenant.createCovenant(
            id, CHAIN_KEY, address(0xBEEF), address(0xF00D), 1, 1, 2, uint64(block.number + 10), 0
        ) returns (uint256) {
            ok = true;
        } catch {
            ok = false;
        }
    }

    function _tryCancel(uint256 cid) internal returns (bool ok) {
        try covenant.cancelProposedCovenant(cid) {
            ok = true;
        } catch {
            ok = false;
        }
    }

    // ----------------------------------------------- lender/borrower capital controls

    function test_LenderCannotWithdrawUndrawnCommittedCapitalEarly() public {
        uint256 id = _openFacility();
        uint256 escrowedBefore = address(covenant).balance;

        vm.prank(lender);
        vm.expectRevert(CovenantFacility.FacilityNotClosable.selector);
        covenant.closeFacility(id);
        assertEq(address(covenant).balance, escrowedBefore);

        // Even a pending proposal blocks closure outright.
        vm.prank(lender);
        covenant.createCovenant(
            id, CHAIN_KEY, usdc, recipientAddr, 5e6, VALID_HEIGHT - 50, VALID_HEIGHT + 50, uint64(block.number + 400), 0
        );
        vm.prank(lender);
        vm.expectRevert(CovenantFacility.ActiveCovenantExists.selector);
        covenant.closeFacility(id);
        assertEq(address(covenant).balance, escrowedBefore);
    }

    function test_ClosureReconcilesFundsExactlyOnPermittedPaths() public {
        // Path 1: maturity.
        uint256 idM = _openFacility();
        vm.prank(borrower);
        covenant.draw(idM, 7 ether);
        vm.roll(block.number + 1_001);
        uint256 balBefore = lender.balance;
        vm.prank(lender);
        covenant.closeFacility(idM);
        assertEq(lender.balance, balBefore + (LIMIT - 7 ether));
        (,,,, uint256 unlockedAfterClose,,,,) = covenant.facilities(idM);
        assertEq(unlockedAfterClose, 7 ether); // allowance collapses to drawn; history intact
        vm.prank(borrower);
        vm.expectRevert(CovenantFacility.FacilityNotActive.selector);
        covenant.draw(idM, 1 ether);
        vm.prank(lender);
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.closeFacility(idM); // double close

        // Path 2: freeze via missed proof deadline, then recovery.
        uint256 idF = _openFacility();
        vm.prank(lender);
        uint256 cidF = covenant.createCovenant(
            idF,
            CHAIN_KEY,
            usdc,
            recipientAddr,
            5e6,
            VALID_HEIGHT - 50,
            VALID_HEIGHT + 50,
            uint64(block.number + 100),
            0
        );
        vm.prank(borrower);
        covenant.acceptCovenant(cidF);
        vm.roll(block.number + 101);
        MockChainInfo(NativeChainInfoLib.PRECOMPILE_ADDRESS).setFrontier(CHAIN_KEY, VALID_HEIGHT + 50);
        covenant.freezeExpiredCovenant(cidF); // permissionless
        vm.prank(lender);
        covenant.closeFacility(idF);
        // Both facilities closed and fully reconciled: contract retains nothing.
        assertEq(address(covenant).balance, 0);
    }

    function test_FreezeBlocksFutureDrawsButPreservesHistory() public {
        uint256 id = _openFacility();
        vm.prank(borrower);
        covenant.draw(id, 5 ether);
        vm.prank(lender);
        uint256 cid = covenant.createCovenant(
            id, CHAIN_KEY, usdc, recipientAddr, 5e6, VALID_HEIGHT - 50, VALID_HEIGHT + 50, uint64(block.number + 100), 0
        );
        vm.prank(borrower);
        covenant.acceptCovenant(cid);

        (,,,,, uint256 drawnBeforeFreeze,, uint64 maturityBeforeFreeze,) = covenant.facilities(id);
        MockChainInfo(NativeChainInfoLib.PRECOMPILE_ADDRESS).setFrontier(CHAIN_KEY, VALID_HEIGHT + 50);
        vm.roll(block.number + 101);
        covenant.freezeExpiredCovenant(cid);

        (
            ,
            ,
            uint256 limit,
            uint256 tranche,
            uint256 unlocked,
            uint256 drawn,
            ,
            uint64 maturity,
            CovenantFacility.FacilityStatus status
        ) = covenant.facilities(id);
        assertEq(limit, LIMIT);
        assertEq(tranche, TRANCHE);
        assertEq(unlocked, TRANCHE);
        assertEq(drawn, 5 ether);
        assertEq(drawn, drawnBeforeFreeze); // history intact
        assertEq(maturity, maturityBeforeFreeze); // freeze rewrites nothing
        assertEq(uint8(status), uint8(CovenantFacility.FacilityStatus.Frozen));

        vm.prank(borrower);
        vm.expectRevert(CovenantFacility.FacilityNotActive.selector);
        covenant.draw(id, 1 wei);
    }

    // ------------------------------------------------------------------ access control

    function test_AccessControlMatrix() public {
        uint256 id = _openFacility();

        vm.prank(attacker);
        vm.expectRevert(CovenantFacility.NotBorrower.selector);
        covenant.draw(id, 1 ether);

        vm.prank(borrower);
        vm.expectRevert(CovenantFacility.NotLender.selector);
        covenant.createCovenant(id, CHAIN_KEY, usdc, recipientAddr, 5e6, 1, 2, uint64(block.number + 10), 0);

        vm.prank(attacker);
        vm.expectRevert(CovenantFacility.NotLender.selector);
        covenant.closeFacility(id);

        vm.prank(lender);
        uint256 cid = covenant.createCovenant(
            id, CHAIN_KEY, usdc, recipientAddr, 5e6, VALID_HEIGHT - 50, VALID_HEIGHT + 50, uint64(block.number + 100), 0
        );

        // Lender cannot self-accept.
        vm.prank(lender);
        vm.expectRevert(CovenantFacility.NotBorrower.selector);
        covenant.acceptCovenant(cid);

        // Freeze is meaningless on a mere proposal.
        vm.expectRevert(CovenantFacility.CovenantNotPending.selector);
        covenant.freezeExpiredCovenant(cid);

        // Cancellation pre-acceptance is restricted to facility parties...
        vm.prank(attacker);
        vm.expectRevert(CovenantFacility.NotFacilityParty.selector);
        covenant.cancelProposedCovenant(cid);

        // ...and either party may exercise it against a mere proposal.
        vm.prank(borrower);
        covenant.cancelProposedCovenant(cid);

        // Fresh proposal for the acceptance/deadline phase.
        vm.prank(lender);
        uint256 cid2 = covenant.createCovenant(
            id, CHAIN_KEY, usdc, recipientAddr, 5e6, VALID_HEIGHT - 50, VALID_HEIGHT + 50, uint64(block.number + 100), 0
        );
        vm.prank(borrower);
        covenant.acceptCovenant(cid2);

        vm.expectRevert(CovenantFacility.ProofDeadlineNotReached.selector);
        covenant.freezeExpiredCovenant(cid2);
        vm.prank(lender);
        vm.expectRevert(CovenantFacility.ProofDeadlineNotReached.selector);
        covenant.freezeExpiredCovenant(cid2);
    }

    // ------------------------------------------------------------------ configuration

    function test_NonsensicalConfigurationsRejected() public {
        vm.startPrank(lender);
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createFacility{value: 1 ether}(address(0), 1 ether, uint64(block.number + 10));
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createFacility{value: 1 ether}(borrower, 0, uint64(block.number + 10));
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createFacility{value: 0}(borrower, 1 ether, uint64(block.number + 10));
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createFacility{value: 1 ether}(borrower, 2 ether, uint64(block.number + 10)); // tranche > limit
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createFacility{value: 1 ether}(borrower, 1 ether, uint64(block.number)); // maturity not future
        vm.stopPrank();

        uint256 id = _openFacility();
        vm.startPrank(lender);
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createCovenant(id, 0, usdc, recipientAddr, 5e6, 1, 2, uint64(block.number + 10), 0); // chainKey 0
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createCovenant(id, CHAIN_KEY, address(0), recipientAddr, 5e6, 1, 2, uint64(block.number + 10), 0);
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createCovenant(id, CHAIN_KEY, usdc, address(0), 5e6, 1, 2, uint64(block.number + 10), 0);
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createCovenant(id, CHAIN_KEY, usdc, recipientAddr, 0, 1, 2, uint64(block.number + 10), 0);
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createCovenant(id, CHAIN_KEY, usdc, recipientAddr, 5e6, 0, 2, uint64(block.number + 10), 0);
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createCovenant(id, CHAIN_KEY, usdc, recipientAddr, 5e6, 5, 4, uint64(block.number + 10), 0);
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createCovenant(id, CHAIN_KEY, usdc, recipientAddr, 5e6, 1, 2, uint64(block.number), 0); // past deadline
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createCovenant(id, CHAIN_KEY, usdc, recipientAddr, 5e6, 1, 2, uint64(block.number + 1_001), 0); // deadline beyond facility maturity
        vm.stopPrank();

        // Nothing left to unlock: a proposal would be meaningless.
        uint256 full = _openFacilityWithTranche(LIMIT);
        vm.prank(lender);
        vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        covenant.createCovenant(full, CHAIN_KEY, usdc, recipientAddr, 5e6, 1, 2, uint64(block.number + 10), 0);
    }

    function _openFacilityWithTranche(uint256 tranche) internal returns (uint256) {
        vm.prank(lender);
        return covenant.createFacility{value: LIMIT}(borrower, tranche, uint64(block.number + 1_000));
    }

    // ---------------------------------------------------------------------- fuzzing

    function testFuzz_DrawOnlyWithinAvailableAllowance(uint256 amount, uint8 actorSelector) public {
        uint256 id = _openFacility();
        uint256 available = covenant.availableToDraw(id);
        amount = bound(amount, 0, available * 2);

        if (actorSelector % 2 == 0) {
            vm.prank(attacker);
            vm.expectRevert(CovenantFacility.NotBorrower.selector);
            covenant.draw(id, amount);
        } else if (amount == 0 || amount > available) {
            vm.prank(borrower);
            vm.expectRevert(CovenantFacility.DrawExceedsUnlocked.selector);
            covenant.draw(id, amount);
        } else {
            uint256 beforeBal = borrower.balance;
            vm.prank(borrower);
            covenant.draw(id, amount);
            assertEq(borrower.balance, beforeBal + amount);
            (,,,,, uint256 drawn,,,) = covenant.facilities(id);
            assertLe(drawn, available);
        }
    }

    function testFuzz_DeadlineNeverExceedsMaturity(uint64 maturityOffset, uint96 deadlineSeed) public {
        maturityOffset = uint64(bound(maturityOffset, 2, 10_000));
        uint256 id;
        vm.prank(lender);
        id = covenant.createFacility{value: LIMIT}(borrower, TRANCHE, uint64(block.number + maturityOffset));

        uint256 deadlineOffset = bound(uint256(deadlineSeed), 1, 20_000);
        bool beyondMaturity = block.number + deadlineOffset > block.number + maturityOffset;
        vm.prank(lender);
        if (beyondMaturity) {
            vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        }
        uint256 cid = covenant.createCovenant(
            id,
            CHAIN_KEY,
            usdc,
            recipientAddr,
            5e6,
            VALID_HEIGHT - 50,
            VALID_HEIGHT + 50,
            uint64(block.number + deadlineOffset),
            0
        );
        if (!beyondMaturity) {
            (,,,,,,,,, uint64 storedDeadline,,) = covenant.covenants(cid);
            assertLe(storedDeadline, uint64(block.number + maturityOffset));
        }
    }

    function testFuzz_WindowEnforcement(int256 heightShift) public {
        vm.assume(heightShift >= -120 && heightShift <= 120);
        uint256 id = _openFacility();
        vm.prank(lender);
        uint256 cid = covenant.createCovenant(
            id, CHAIN_KEY, usdc, recipientAddr, 5e6, VALID_HEIGHT - 50, VALID_HEIGHT + 50, uint64(block.number + 500), 0
        );
        vm.prank(borrower);
        covenant.acceptCovenant(cid);

        int256 submitted = int256(uint256(VALID_HEIGHT)) + heightShift;
        assertGt(submitted, 0);
        bool inside = submitted >= int256(uint256(VALID_HEIGHT)) - 50 && submitted <= int256(uint256(VALID_HEIGHT)) + 50;

        Scenario memory s;
        s.txBytes = validTxBytes;
        s.chainKey = CHAIN_KEY;
        s.height = uint64(uint256(submitted));
        if (inside) {
            (, uint256 matched) = _submitScenario(cid, s);
            assertGe(matched, 5e6);
        } else {
            vm.expectRevert(CovenantFacility.SourceBlockOutsideWindow.selector);
            _submitScenario(cid, s);
        }
    }
}
