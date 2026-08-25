// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {StdAssertions} from "forge-std/StdAssertions.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {CommonBase} from "forge-std/Base.sol";
import {CovenantFacility} from "../src/CovenantFacility.sol";
import {INativeQueryVerifier, NativeQueryVerifierLib, NativeChainInfoLib} from "../src/VerifierInterface.sol";
import {MockNativeQueryVerifier} from "./MockNativeQueryVerifier.sol";
import {MockChainInfo} from "./MockChainInfo.sol";

/// @notice Ghost-accounting state machine driving COVENANT through arbitrary operation
///         sequences. All economically relevant flows (escrow, draws, proposals, acceptance,
///         evidence, expiry, closure) are exercised against randomized inputs; the host test
///         then asserts protocol-level invariants after every call.
contract FacilityHandler is CommonBase, StdAssertions, StdCheats, StdUtils {
    CovenantFacility public covenant;
    address public fixedBorrower;
    address internal usdc;
    address internal recipientAddr;

    bytes[3] internal txBytesSet;
    bytes32[3] internal roots;
    bytes32[][3] internal sibHashes;
    bool[][3] internal sibIsLeft;
    bytes32[3] internal lowers;
    bytes32[][3] internal rootSets;
    uint64[3] internal heights;

    uint256[] public facilityIds;
    mapping(uint256 => bool) public tracked;
    mapping(uint256 => uint256) public satisfiedCount;
    mapping(uint256 => uint256) public evidenceStep;
    mapping(uint256 => bool) public queryConsumed; // fixture index -> consumed somewhere

    uint256[] public covenantIds;
    mapping(uint256 => bool) public acceptedRecorded;
    mapping(uint256 => CovenantTerms) public acceptedTerms;

    struct CovenantTerms {
        uint64 chainKey;
        address token;
        address payer;
        address recipient;
        uint256 requiredAmount;
        uint64 startSourceBlock;
        uint64 endSourceBlock;
        uint64 proofDeadlineCreditcoinBlock;
        uint256 facilityId;
    }

    constructor() {
        string memory json = vm.readFile("test/fixtures/fixtures.json");
        usdc = vm.parseJsonAddress(json, "$.meta.usdc");
        recipientAddr = vm.parseJsonAddress(json, "$.meta.recipient");
        fixedBorrower = vm.parseJsonAddress(json, "$.meta.payer");
        deal(fixedBorrower, 1_000 ether);

        txBytesSet[0] = vm.parseJsonBytes(json, "$.scenarios.valid.txBytes");
        roots[0] = vm.parseJsonBytes32(json, "$.scenarios.valid.merkleProof.root");
        sibHashes[0] = vm.parseJsonBytes32Array(json, "$.scenarios.valid.merkleProof.siblingHashes");
        sibIsLeft[0] = vm.parseJsonBoolArray(json, "$.scenarios.valid.merkleProof.siblingIsLeft");
        lowers[0] = vm.parseJsonBytes32(json, "$.scenarios.valid.continuityProof.lowerEndpointDigest");
        rootSets[0] = vm.parseJsonBytes32Array(json, "$.scenarios.valid.continuityProof.roots");
        heights[0] = uint64(vm.parseJsonUint(json, "$.scenarios.valid.headerNumber"));

        txBytesSet[1] = vm.parseJsonBytes(json, "$.scenarios.partialA.txBytes");
        roots[1] = vm.parseJsonBytes32(json, "$.scenarios.partialA.merkleProof.root");
        sibHashes[1] = vm.parseJsonBytes32Array(json, "$.scenarios.partialA.merkleProof.siblingHashes");
        sibIsLeft[1] = vm.parseJsonBoolArray(json, "$.scenarios.partialA.merkleProof.siblingIsLeft");
        lowers[1] = vm.parseJsonBytes32(json, "$.scenarios.partialA.continuityProof.lowerEndpointDigest");
        rootSets[1] = vm.parseJsonBytes32Array(json, "$.scenarios.partialA.continuityProof.roots");
        heights[1] = uint64(vm.parseJsonUint(json, "$.scenarios.partialA.headerNumber"));

        txBytesSet[2] = vm.parseJsonBytes(json, "$.scenarios.partialB.txBytes");
        roots[2] = vm.parseJsonBytes32(json, "$.scenarios.partialB.merkleProof.root");
        sibHashes[2] = vm.parseJsonBytes32Array(json, "$.scenarios.partialB.merkleProof.siblingHashes");
        sibIsLeft[2] = vm.parseJsonBoolArray(json, "$.scenarios.partialB.merkleProof.siblingIsLeft");
        lowers[2] = vm.parseJsonBytes32(json, "$.scenarios.partialB.continuityProof.lowerEndpointDigest");
        rootSets[2] = vm.parseJsonBytes32Array(json, "$.scenarios.partialB.continuityProof.roots");
        heights[2] = uint64(vm.parseJsonUint(json, "$.scenarios.partialB.headerNumber"));

        MockNativeQueryVerifier mockImpl = new MockNativeQueryVerifier();
        vm.etch(NativeQueryVerifierLib.PRECOMPILE_ADDRESS, address(mockImpl).code);
        vm.etch(NativeChainInfoLib.PRECOMPILE_ADDRESS, address(new MockChainInfo()).code);
        covenant = new CovenantFacility();
    }

    function _entries(uint256 fixtureIdx) internal view returns (INativeQueryVerifier.MerkleProofEntry[] memory s) {
        bytes32[] memory hashes = sibHashes[fixtureIdx];
        bool[] memory isLeft = sibIsLeft[fixtureIdx];
        s = new INativeQueryVerifier.MerkleProofEntry[](hashes.length);
        for (uint256 i; i < hashes.length; ++i) {
            s[i] = INativeQueryVerifier.MerkleProofEntry({hash: hashes[i], isLeft: isLeft[i]});
        }
    }

    function _pick(uint256 seed) internal view returns (uint256 id) {
        if (facilityIds.length == 0) return 0;
        id = facilityIds[seed % facilityIds.length];
    }

    // ------------------------------------------------------------- actions

    function createFacility(uint256 lenderSeed, uint256 limitSeed, uint256 trancheSeed) external {
        address lender = vm.addr(uint256(keccak256(abi.encode("lender", lenderSeed))));
        deal(lender, 1_000 ether);
        uint256 limit = bound(limitSeed, 2 ether, 60 ether);
        uint256 tranche = bound(trancheSeed, 1 ether, limit / 2 + 1 ether);
        vm.prank(lender);
        uint256 id = covenant.createFacility{value: limit}(fixedBorrower, tranche, uint64(block.number + 3_000));
        facilityIds.push(id);
        tracked[id] = true;
    }

    function draw(uint256 seed, uint256 actorSeed, uint256 amountSeed) external {
        uint256 id = _pick(seed);
        if (!tracked[id]) return;
        (,,, uint256 unlocked, uint256 drawn,,,,) = covenant.facilities(id);
        uint256 available = unlocked - drawn;
        uint256 amount = bound(amountSeed, 0, available + 1 ether);

        if (actorSeed % 4 == 0) {
            // Wrong actor always reverts.
            vm.prank(address(uint160(0xA11CE + actorSeed)));
            vm.expectRevert(CovenantFacility.NotBorrower.selector);
            covenant.draw(id, amount);
        } else if (amount == 0 || amount > available) {
            vm.prank(fixedBorrower);
            vm.expectRevert(CovenantFacility.DrawExceedsUnlocked.selector);
            covenant.draw(id, amount);
        } else {
            vm.prank(fixedBorrower);
            covenant.draw(id, amount);
        }
    }

    function proposeCovenant(uint256 seed, uint256 lenderSeed) external {
        uint256 id = _pick(seed);
        if (!tracked[id]) return;
        address lender = vm.addr(uint256(keccak256(abi.encode("lender", lenderSeed))));
        (,,,, uint256 unlocked,, uint256 activeId,, CovenantFacility.FacilityStatus status) = covenant.facilities(id);
        bool nothingToUnlock = unlocked >= _limitOf(id);
        vm.startPrank(lender);
        if (nothingToUnlock || activeId != 0 || status != CovenantFacility.FacilityStatus.Active) {
            vm.expectRevert();
            covenant.createCovenant(
                id, 11, usdc, recipientAddr, 5e6, heights[0] - 50, heights[2] + 50, uint64(block.number + 400), 0
            );
        } else {
            uint256 cid = covenant.createCovenant(
                id, 11, usdc, recipientAddr, 5e6, heights[0] - 50, heights[2] + 50, uint64(block.number + 400), 0
            );
            covenantIds.push(cid);
        }
        vm.stopPrank();
    }

    function acceptCovenant(uint256 seed) external {
        uint256 id = _pick(seed);
        if (!tracked[id]) return;
        uint256 activeId = _activeOf(id);
        if (activeId == 0 || _statusOf(activeId) != CovenantFacility.CovenantStatus.Proposed) return;
        vm.prank(fixedBorrower);
        covenant.acceptCovenant(activeId);
        _recordAccepted(activeId);
    }

    function cancelProposal(uint256 seed, uint256 asBorrowerFlag) external {
        uint256 id = _pick(seed);
        if (!tracked[id]) return;
        uint256 activeId = _activeOf(id);
        if (activeId == 0 || _statusOf(activeId) != CovenantFacility.CovenantStatus.Proposed) return;
        if (asBorrowerFlag % 2 == 0) {
            vm.prank(fixedBorrower);
            covenant.cancelProposedCovenant(activeId);
        } else {
            vm.prank(address(uint160(0xBEEF)));
            vm.expectRevert(CovenantFacility.NotFacilityParty.selector);
            covenant.cancelProposedCovenant(activeId);
        }
    }

    function submitEvidence(uint256 seed, uint256 outsiderSeed) external {
        uint256 id = _pick(seed);
        if (!tracked[id]) return;
        uint256 activeId = _activeOf(id);
        if (_statusOf(activeId) != CovenantFacility.CovenantStatus.Pending) return;

        uint256 step = evidenceStep[activeId]++;
        uint256 fixtureIdx = step % 3;
        bool consumed = queryConsumed[fixtureIdx];

        vm.prank(address(uint160(0xC0FFEE + outsiderSeed)));
        if (consumed) {
            vm.expectRevert(CovenantFacility.QueryAlreadyProcessed.selector);
        }
        (bool ok, bytes memory reason) = address(covenant).call(
            abi.encodeCall(
                CovenantFacility.submitEvidence,
                (
                    activeId,
                    uint64(11),
                    heights[fixtureIdx],
                    txBytesSet[fixtureIdx],
                    roots[fixtureIdx],
                    this.entriesPublic(fixtureIdx),
                    lowers[fixtureIdx],
                    rootSets[fixtureIdx]
                )
            )
        );
        if (ok) {
            queryConsumed[fixtureIdx] = true;
            if (_statusOf(activeId) == CovenantFacility.CovenantStatus.Satisfied) {
                satisfiedCount[_facilityOf(activeId)] += 1;
            }
        } else if (!consumed) {
            // Unpredicted failure can only be a lapsed proof deadline after warps.
            bytes4 selector = bytes4(reason);
            assertTrue(
                selector == CovenantFacility.ProofDeadlinePassed.selector
                    || selector == CovenantFacility.QueryAlreadyProcessed.selector,
                "unexpected evidence revert"
            );
        }
    }

    // Expose sibling construction to the external try-call above.
    function entriesPublic(uint256 fixtureIdx) external view returns (INativeQueryVerifier.MerkleProofEntry[] memory) {
        return _entries(fixtureIdx);
    }

    function warpForward(uint256 blocks) external {
        vm.roll(block.number + bound(blocks, 1, 40));
    }

    function freezeExpired(uint256 seed) external {
        uint256 id = _pick(seed);
        if (!tracked[id]) return;
        uint256 activeId = _activeOf(id);
        CovenantFacility.CovenantStatus st = _statusOf(activeId);
        if (activeId == 0 || st != CovenantFacility.CovenantStatus.Pending) return;
        (,,,,,,,,, uint64 deadline, uint64 margin,) = covenant.covenants(activeId);
        // Advance the Attestcoin frontier beyond the covenant's committed requirement so the
        // only remaining gate under test is the cure deadline itself.
        MockChainInfo(NativeChainInfoLib.PRECOMPILE_ADDRESS).setFrontier(11, type(uint64).max - 1);
        if (block.number <= deadline) {
            vm.expectRevert(CovenantFacility.ProofDeadlineNotReached.selector);
        }
        covenant.freezeExpiredCovenant(activeId);
    }

    function closeAttempt(uint256 seed, uint256 lenderSeed) external {
        uint256 id = _pick(seed);
        if (!tracked[id]) return;
        address realLender = _lenderOf(id);
        address caller = lenderSeed % 3 == 0 ? address(uint160(0xDEAD)) : realLender;
        (,, uint256 limit,,, uint256 drawn, uint256 activeId, uint64 maturity, CovenantFacility.FacilityStatus status) =
            covenant.facilities(id);
        bool permitted = status == CovenantFacility.FacilityStatus.Frozen || drawn >= limit || block.number > maturity;

        vm.prank(caller);
        if (caller != realLender) {
            vm.expectRevert(CovenantFacility.NotLender.selector);
        } else if (activeId != 0) {
            vm.expectRevert(CovenantFacility.ActiveCovenantExists.selector);
        } else if (status == CovenantFacility.FacilityStatus.Closed) {
            vm.expectRevert(CovenantFacility.InvalidTerms.selector);
        } else if (!permitted) {
            vm.expectRevert(CovenantFacility.FacilityNotClosable.selector);
        }
        covenant.closeFacility(id);
    }

    // ------------------------------------------------------------ views/ghosts

    function _recordAccepted(uint256 cid) internal {
        (
            uint256 facilityId,
            uint64 chainKey,
            address token,
            address payer,
            address recipient,
            uint256 requiredAmount,
            ,
            uint64 startSourceBlock,
            uint64 endSourceBlock,
            uint64 proofDeadlineCreditcoinBlock,
            ,
        ) = covenant.covenants(cid);
        acceptedTerms[cid] = CovenantTerms({
            chainKey: chainKey,
            token: token,
            payer: payer,
            recipient: recipient,
            requiredAmount: requiredAmount,
            startSourceBlock: startSourceBlock,
            endSourceBlock: endSourceBlock,
            proofDeadlineCreditcoinBlock: proofDeadlineCreditcoinBlock,
            facilityId: facilityId
        });
        acceptedRecorded[cid] = true;
    }

    function _limitOf(uint256 id) internal view returns (uint256) {
        (,, uint256 limit,,,,,,) = covenant.facilities(id);
        return limit;
    }

    function _activeOf(uint256 id) internal view returns (uint256) {
        (,,,,,, uint256 activeId,,) = covenant.facilities(id);
        return activeId;
    }

    function _lenderOf(uint256 id) internal view returns (address) {
        (address lender,,,,,,,,) = covenant.facilities(id);
        return lender;
    }

    function _facilityOf(uint256 cid) internal view returns (uint256) {
        (uint256 facilityId,,,,,,,,,,,) = covenant.covenants(cid);
        return facilityId;
    }

    function _statusOf(uint256 cid) internal view returns (CovenantFacility.CovenantStatus) {
        (,,,,,,,,,,, CovenantFacility.CovenantStatus status) = covenant.covenants(cid);
        return status;
    }

    function facilityCount() external view returns (uint256) {
        return facilityIds.length;
    }

    function covenantCount() external view returns (uint256) {
        return covenantIds.length;
    }
}

contract CovenantFacilityInvariants is Test {
    FacilityHandler internal handler;

    function setUp() public {
        handler = new FacilityHandler();
        // Invariants enumerate every facility/covenant through the contract's public counters,
        // so even a stray direct call into CovenantFacility remains inside the checked universe.
    }

    function _facilityCount() internal view returns (uint256) {
        return handler.covenant().nextFacilityId() - 1;
    }

    function _covenantCount() internal view returns (uint256) {
        return handler.covenant().nextCovenantId() - 1;
    }

    /// INVARIANT I1 — Escrow conservation:
    /// contract native balance always equals sum over open facilities of (creditLimit - drawn).
    function invariant_BalanceEqualsUndrawnEscrow() public view {
        uint256 expected;
        uint256 n = _facilityCount();
        for (uint256 id = 1; id <= n; ++id) {
            (,, uint256 limit,,, uint256 drawn,,, CovenantFacility.FacilityStatus status) =
                handler.covenant().facilities(id);
            if (status != CovenantFacility.FacilityStatus.Closed) {
                expected += limit - drawn;
            }
        }
        assertEq(address(handler.covenant()).balance, expected, "escrow conservation violated");
    }

    /// INVARIANT I2 — Allowance bounds: drawn <= unlocked <= creditLimit, always.
    function invariant_DrawnNeverExceedsUnlockedNeverExceedsLimit() public view {
        uint256 n = _facilityCount();
        for (uint256 id = 1; id <= n; ++id) {
            (,, uint256 limit,, uint256 unlocked, uint256 drawn,,, CovenantFacility.FacilityStatus status) =
                handler.covenant().facilities(id);
            status;
            assertLe(drawn, unlocked, "drawn exceeded allowance");
            assertLe(unlocked, limit, "unlocked exceeded commitment");
        }
    }

    /// INVARIANT I3 — Unlock exactness: unlocked == min(limit, tranche * (1 + satisfiedCovenants))
    /// while active; closure collapses the allowance to drawn. Capital can only have been
    /// expanded by whole satisfied covenants.
    function invariant_UnlockedTracksSatisfiedCovenantsExactly() public view {
        uint256 n = _facilityCount();
        for (uint256 id = 1; id <= n; ++id) {
            (
                ,
                ,
                uint256 limit,
                uint256 tranche,
                uint256 unlocked,
                uint256 drawn,
                ,
                ,
                CovenantFacility.FacilityStatus status
            ) = handler.covenant().facilities(id);
            if (status == CovenantFacility.FacilityStatus.Closed) {
                assertEq(unlocked, drawn, "closed facility allowance not collapsed to drawn");
                continue;
            }
            uint256 expected = handler.satisfiedCount(id) * tranche + tranche;
            expected = expected > limit ? limit : expected;
            assertEq(unlocked, expected, "unlock does not match satisfied-covenant arithmetic");
        }
    }

    /// INVARIANT I4 — Frozen/Closed facilities expose zero drawable capital.
    function invariant_FrozenOrClosedMeansNothingDrawable() public view {
        uint256 n = _facilityCount();
        for (uint256 id = 1; id <= n; ++id) {
            (,,,,,,,, CovenantFacility.FacilityStatus status) = handler.covenant().facilities(id);
            if (status == CovenantFacility.FacilityStatus.Frozen || status == CovenantFacility.FacilityStatus.Closed) {
                assertEq(handler.covenant().availableToDraw(id), 0, "dead facility still drawable");
            }
        }
    }

    /// INVARIANT I5 — Covenant linkage integrity: an active covenant pointer is bidirectional
    /// and only ever references Proposed/Pending covenants; Pending covenants are linked back.
    function invariant_CovenantLinkageIntegrity() public view {
        uint256 n = _facilityCount();
        for (uint256 id = 1; id <= n; ++id) {
            (,,,,,, uint256 activeId,,) = handler.covenant().facilities(id);
            if (activeId != 0) {
                (uint256 backRef,,,,,,,,,,, CovenantFacility.CovenantStatus st) = handler.covenant().covenants(activeId);
                assertEq(backRef, id, "active covenant points at wrong facility");
                assertTrue(
                    st == CovenantFacility.CovenantStatus.Proposed || st == CovenantFacility.CovenantStatus.Pending,
                    "dangling active covenant"
                );
            }
        }
        uint256 m = _covenantCount();
        for (uint256 cid = 1; cid <= m; ++cid) {
            (uint256 facilityId,,,,,,,,,,, CovenantFacility.CovenantStatus st) = handler.covenant().covenants(cid);
            if (st == CovenantFacility.CovenantStatus.Pending) {
                assertEq(_activeOf(facilityId), cid, "pending covenant not linked from facility");
            }
        }
    }

    /// INVARIANT I6 — Accepted-term immutability under arbitrary sequences:
    /// every policy field snapshotted at acceptance stays identical afterwards forever.
    function invariant_AcceptedCovenantTermsAreImmutable() public view {
        uint256 m = _covenantCount();
        for (uint256 cid = 1; cid <= m; ++cid) {
            if (!handler.acceptedRecorded(cid)) continue;
            // Public mapping getters expose the struct flattened: chainKey, token, payer,
            // recipient, requiredAmount, startSourceBlock, endSourceBlock, deadline, facilityId.
            (
                uint64 sChainKey,
                address sToken,
                address sPayer,
                address sRecipient,
                uint256 sRequired,
                uint64 sStart,
                uint64 sEnd,
                uint64 sDeadline,
                uint256 sFacilityId
            ) = handler.acceptedTerms(cid);
            (
                uint256 facilityId,
                uint64 chainKey,
                address token,
                address payer,
                address recipient,
                uint256 requiredAmount,
                ,
                uint64 startSourceBlock,
                uint64 endSourceBlock,
                uint64 proofDeadlineCreditcoinBlock,
                ,
            ) = handler.covenant().covenants(cid);
            assertEq(facilityId, sFacilityId, "facilityId mutated");
            assertEq(chainKey, sChainKey, "chainKey mutated");
            assertEq(token, sToken, "token mutated");
            assertEq(payer, sPayer, "payer mutated");
            assertEq(recipient, sRecipient, "recipient mutated");
            assertEq(requiredAmount, sRequired, "requiredAmount mutated");
            assertEq(startSourceBlock, sStart, "window start mutated");
            assertEq(endSourceBlock, sEnd, "window end mutated");
            assertEq(proofDeadlineCreditcoinBlock, sDeadline, "deadline mutated");
        }
    }

    /// INVARIANT I7 — Proof deadlines never exceed their facility maturity.
    function invariant_DeadlineWithinMaturity() public view {
        uint256 m = _covenantCount();
        for (uint256 cid = 1; cid <= m; ++cid) {
            (uint256 facilityId,,,,,,,,, uint64 deadline,,) = handler.covenant().covenants(cid);
            (,,,,,,, uint64 maturity,) = handler.covenant().facilities(facilityId);
            assertLe(deadline, maturity, "proof deadline beyond facility maturity");
        }
    }

    function _activeOf(uint256 id) internal view returns (uint256) {
        (,,,,,, uint256 activeId,,) = handler.covenant().facilities(id);
        return activeId;
    }
}
