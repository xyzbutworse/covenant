// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {CovenantFacility} from "../src/CovenantFacility.sol";
import {INativeQueryVerifier, NativeQueryVerifierLib, NativeChainInfoLib} from "../src/VerifierInterface.sol";
import {MockNativeQueryVerifier} from "./MockNativeQueryVerifier.sol";
import {MockChainInfo} from "./MockChainInfo.sol";

/// @notice Expiry/freeze lifecycle prosecution: PENDING -> window closes -> Attestcoin frontier
///         advances beyond the eligible range (+ committed margin) -> cure deadline passes ->
///         SATISFIED or deterministically FREEZABLE. A borrower must never be punished merely
///         because Attestcoin has not yet attested a valid source transaction.
contract CovenantExpiryLifecycleTest is Test {
    CovenantFacility internal covenant;
    MockChainInfo internal chainInfoImpl;

    string internal fixturesJson;
    bytes internal validTxBytes;
    bytes32 internal validRoot;
    bytes32[] internal validSibHashes;
    bool[] internal validSibIsLeft;
    bytes32 internal validLower;
    bytes32[] internal validRoots;
    uint64 internal constant H = 9_128_468; // fixture source height
    uint64 internal constant CHAIN_KEY = 11;

    address internal lender = makeAddr("lender");
    address internal borrower = makeAddr("borrower");
    address internal anyone = makeAddr("anyone");

    function setUp() public {
        fixturesJson = vm.readFile("test/fixtures/fixtures.json");
        validTxBytes = vm.parseJsonBytes(fixturesJson, "$.scenarios.valid.txBytes");
        validRoot = vm.parseJsonBytes32(fixturesJson, "$.scenarios.valid.merkleProof.root");
        validSibHashes = vm.parseJsonBytes32Array(fixturesJson, "$.scenarios.valid.merkleProof.siblingHashes");
        validSibIsLeft = vm.parseJsonBoolArray(fixturesJson, "$.scenarios.valid.merkleProof.siblingIsLeft");
        validLower = vm.parseJsonBytes32(fixturesJson, "$.scenarios.valid.continuityProof.lowerEndpointDigest");
        validRoots = vm.parseJsonBytes32Array(fixturesJson, "$.scenarios.valid.continuityProof.roots");

        MockNativeQueryVerifier verifier = new MockNativeQueryVerifier();
        vm.etch(NativeQueryVerifierLib.PRECOMPILE_ADDRESS, address(verifier).code);
        chainInfoImpl = new MockChainInfo();
        vm.etch(NativeChainInfoLib.PRECOMPILE_ADDRESS, address(chainInfoImpl).code);

        covenant = new CovenantFacility();
        vm.deal(lender, 1_000 ether);

        // Covenant payer binds to facility.borrower on-chain; use the fixture payer.
        borrower = vm.parseJsonAddress(fixturesJson, "$.meta.payer");
        vm.deal(borrower, 1_000 ether);
    }

    struct Setup {
        uint256 facilityId;
        uint256 covenantId;
        uint64 endSourceBlock;
        uint64 margin;
        uint64 deadline;
    }

    /// Standard layout: window [H-100, H+100], margin 30 => required frontier H+130,
    /// cure deadline 500 Creditcoin blocks after proposal.
    function _setup(uint64 margin) internal returns (Setup memory s) {
        s.margin = margin;
        s.endSourceBlock = H + 100;
        s.deadline = uint64(block.number + 500);
        vm.prank(lender);
        s.facilityId = covenant.createFacility{value: 100 ether}(borrower, 20 ether, uint64(block.number + 2_000));
        vm.prank(lender);
        s.covenantId = covenant.createCovenant(
            s.facilityId,
            CHAIN_KEY,
            vm.parseJsonAddress(fixturesJson, "$.meta.usdc"),
            vm.parseJsonAddress(fixturesJson, "$.meta.recipient"),
            5e6,
            H - 100,
            s.endSourceBlock,
            s.deadline,
            margin
        );
        vm.prank(borrower);
        covenant.acceptCovenant(s.covenantId);
        assertEq(uint8(_status(s.covenantId)), uint8(CovenantFacility.CovenantStatus.Pending));
    }

    function _status(uint256 cid) internal view returns (CovenantFacility.CovenantStatus) {
        (,,,,,,,,,,, CovenantFacility.CovenantStatus status) = covenant.covenants(cid);
        return status;
    }

    function _submit(Setup memory s) internal returns (bytes32 queryId) {
        uint256 matched;
        vm.prank(anyone);
        (queryId, matched) = covenant.submitEvidence(
            s.covenantId,
            CHAIN_KEY,
            H, // fixture's own source height; inside [H-100, H+100]
            validTxBytes,
            validRoot,
            _siblings(),
            validLower,
            validRoots
        );
        matched; // callers assert economic effects through state reads
    }

    function _siblings() internal view returns (INativeQueryVerifier.MerkleProofEntry[] memory s) {
        s = new INativeQueryVerifier.MerkleProofEntry[](validSibHashes.length);
        for (uint256 i; i < validSibHashes.length; ++i) {
            s[i] = INativeQueryVerifier.MerkleProofEntry({hash: validSibHashes[i], isLeft: validSibIsLeft[i]});
        }
    }

    // ------------------------------------------------------------------ scenarios

    /// Source obligation window has closed and even the cure deadline passed, but Attestcoin's
    /// observable frontier is still behind end+margin: freeze MUST be impossible and the
    /// borrower must keep full use of already-unlocked capital.
    function test_WindowClosedButFrontierBehind_NeverFreezes() public {
        Setup memory s = _setup(30);
        vm.roll(s.deadline + 1);
        uint64 requiredFrontier = s.endSourceBlock + s.margin; // H+130
        MockChainInfo(NativeChainInfoLib.PRECOMPILE_ADDRESS).setFrontier(CHAIN_KEY, requiredFrontier - 1);

        assertFalse(covenant.isFreezable(s.covenantId));
        vm.expectRevert(
            abi.encodeWithSelector(
                CovenantFacility.FrontierNotAdvanced.selector, requiredFrontier, requiredFrontier - 1
            )
        );
        covenant.freezeExpiredCovenant(s.covenantId);

        assertFalse(covenant.isFreezable(s.covenantId));
        assertEq(covenant.availableToDraw(s.facilityId), 20 ether); // untouched, not punished
        (,,,,,,,, CovenantFacility.FacilityStatus facilityStatus) = covenant.facilities(s.facilityId);
        assertEq(uint8(facilityStatus), uint8(CovenantFacility.FacilityStatus.Active));
    }

    /// No attestation data at all for the chain: equally unfreezable.
    function test_NoAttestationData_NeverFreezes() public {
        Setup memory s = _setup(0); // margin irrelevant without any frontier
        vm.roll(s.deadline + 1);
        // frontier left at zero => exists == false
        vm.expectRevert(CovenantFacility.NoAttestationData.selector);
        covenant.freezeExpiredCovenant(s.covenantId);
        assertFalse(covenant.isFreezable(s.covenantId));
    }

    /// A transaction mined at exactly the last eligible source block still counts.
    function test_ValidTransactionAtLastEligibleBlockCounts() public {
        // Window ends exactly at the fixture's own height.
        Setup memory s;
        s.endSourceBlock = H;
        s.margin = 0;
        s.deadline = uint64(block.number + 500);
        vm.prank(lender);
        s.facilityId = covenant.createFacility{value: 100 ether}(borrower, 20 ether, uint64(block.number + 2_000));
        vm.prank(lender);
        s.covenantId = covenant.createCovenant(
            s.facilityId,
            CHAIN_KEY,
            vm.parseJsonAddress(fixturesJson, "$.meta.usdc"),
            vm.parseJsonAddress(fixturesJson, "$.meta.recipient"),
            5e6,
            H - 200, // eligible range [H-200, H]
            s.endSourceBlock,
            s.deadline,
            s.margin
        );
        vm.prank(borrower);
        covenant.acceptCovenant(s.covenantId);

        MockChainInfo(NativeChainInfoLib.PRECOMPILE_ADDRESS).setFrontier(CHAIN_KEY, H + 50);
        (bytes32 q, uint256 matched) = covenant.submitEvidence(
            s.covenantId, CHAIN_KEY, H, validTxBytes, validRoot, _siblings(), validLower, validRoots
        );
        assertTrue(covenant.processedQueries(q));
        assertEq(matched, 5e6);
        assertEq(covenant.availableToDraw(s.facilityId), 40 ether);
    }

    /// The proof arrives AFTER the source window closed but within the cure period with the
    /// frontier already advanced: satisfaction wins; freeze stays illegal until the deadline.
    function test_ProofArrivesLateWithinCureWindow_Satisfies() public {
        Setup memory s = _setup(30);
        MockChainInfo(NativeChainInfoLib.PRECOMPILE_ADDRESS).setFrontier(CHAIN_KEY, s.endSourceBlock + 130);

        // Roll well past the source window close but before the cure deadline.
        vm.roll(block.number + 300);
        assertFalse(covenant.isFreezable(s.covenantId));
        vm.expectRevert(CovenantFacility.ProofDeadlineNotReached.selector);
        covenant.freezeExpiredCovenant(s.covenantId);

        bytes32 q = _submit(s);
        assertTrue(covenant.processedQueries(q));
        assertEq(uint8(_status(s.covenantId)), uint8(CovenantFacility.CovenantStatus.Satisfied));

        // A satisfied covenant can never be frozen afterwards.
        vm.roll(s.deadline + 1);
        vm.expectRevert(CovenantFacility.CovenantNotPending.selector);
        covenant.freezeExpiredCovenant(s.covenantId);
        assertEq(covenant.availableToDraw(s.facilityId), 40 ether);
    }

    /// Lender attempts to freeze early in every sense of the word.
    function test_LenderCannotFreezeEarly() public {
        Setup memory s = _setup(30);

        // Before anything at all.
        vm.prank(lender);
        vm.expectRevert(CovenantFacility.ProofDeadlineNotReached.selector);
        covenant.freezeExpiredCovenant(s.covenantId);

        // Frontier fully advanced, deadline still in the future: still not freezable.
        MockChainInfo(NativeChainInfoLib.PRECOMPILE_ADDRESS).setFrontier(CHAIN_KEY, s.endSourceBlock + 500);
        vm.roll(block.number + 499);
        assertFalse(covenant.isFreezable(s.covenantId));
        vm.prank(lender);
        vm.expectRevert(CovenantFacility.ProofDeadlineNotReached.selector);
        covenant.freezeExpiredCovenant(s.covenantId);

        // Deadline passed on the exact block boundary is still not enough.
        vm.roll(s.deadline);
        assertFalse(covenant.isFreezable(s.covenantId));
        vm.prank(lender);
        vm.expectRevert(CovenantFacility.ProofDeadlineNotReached.selector);
        covenant.freezeExpiredCovenant(s.covenantId);
    }

    /// Frontier eventually advances, no proof ever arrives: freeze becomes deterministically
    /// available to ANYONE, exactly once.
    function test_FrontierAdvancesWithoutProof_BecomesDeterministicallyFreezable() public {
        Setup memory s = _setup(30);

        vm.roll(s.deadline + 1);
        MockChainInfo(NativeChainInfoLib.PRECOMPILE_ADDRESS).setFrontier(CHAIN_KEY, s.endSourceBlock + 130);

        assertTrue(covenant.isFreezable(s.covenantId));
        vm.prank(anyone);
        covenant.freezeExpiredCovenant(s.covenantId);

        assertEq(uint8(_status(s.covenantId)), uint8(CovenantFacility.CovenantStatus.Expired));
        (,,,,,,,, CovenantFacility.FacilityStatus facilityStatus) = covenant.facilities(s.facilityId);
        assertEq(uint8(facilityStatus), uint8(CovenantFacility.FacilityStatus.Frozen));

        vm.prank(borrower);
        vm.expectRevert(CovenantFacility.FacilityNotActive.selector);
        covenant.draw(s.facilityId, 1 wei);
        assertEq(covenant.availableToDraw(s.facilityId), 0);

        vm.expectRevert(CovenantFacility.CovenantNotPending.selector);
        covenant.freezeExpiredCovenant(s.covenantId); // double freeze rejected
    }

    /// Margin is part of the immutable accepted terms.
    function test_MarginCommittedAndImmutable() public {
        Setup memory s = _setup(777);
        (,,,,,,,,,, uint64 storedMargin,) = covenant.covenants(s.covenantId);
        assertEq(storedMargin, 777);
    }
}
