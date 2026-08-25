// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {CovenantFacility} from "../src/CovenantFacility.sol";
import {NativeChainInfoLib} from "../src/VerifierInterface.sol";
import {MockChainInfo} from "./MockChainInfo.sol";

/// @notice State-machine tests that do not mock Attestcoin semantics.
/// Live proof verification belongs in the integration evidence run.
contract CovenantFacilityStateTest is Test {
    CovenantFacility internal covenant;
    address internal lender = address(0xA11CE);
    address internal borrower = address(0xB0B);

    function setUp() public {
        vm.etch(NativeChainInfoLib.PRECOMPILE_ADDRESS, address(new MockChainInfo()).code);
        covenant = new CovenantFacility();
        vm.deal(lender, 1_000 ether);
    }

    function test_CreateFacilityEscrowsAndUnlocksFirstTranche() public {
        vm.prank(lender);
        uint256 id = covenant.createFacility{value: 100 ether}(borrower, 20 ether, uint64(block.number + 1_000));
        (address gotLender, address gotBorrower, uint256 limit, uint256 tranche, uint256 unlocked, uint256 drawn,,,) =
            covenant.facilities(id);
        assertEq(gotLender, lender);
        assertEq(gotBorrower, borrower);
        assertEq(limit, 100 ether);
        assertEq(tranche, 20 ether);
        assertEq(unlocked, 20 ether);
        assertEq(drawn, 0);
    }

    function test_BorrowerCanDrawOnlyUnlockedCapital() public {
        vm.prank(lender);
        uint256 id = covenant.createFacility{value: 100 ether}(borrower, 20 ether, uint64(block.number + 1_000));
        uint256 beforeBalance = borrower.balance;
        vm.prank(borrower);
        covenant.draw(id, 20 ether);
        assertEq(borrower.balance, beforeBalance + 20 ether);
        vm.prank(borrower);
        vm.expectRevert(CovenantFacility.DrawExceedsUnlocked.selector);
        covenant.draw(id, 1 ether);
    }

    function test_OnlyLenderCreatesCovenant() public {
        vm.prank(lender);
        uint256 id = covenant.createFacility{value: 100 ether}(borrower, 20 ether, uint64(block.number + 1_000));
        vm.prank(borrower);
        vm.expectRevert(CovenantFacility.NotLender.selector);
        covenant.createCovenant(id, 1, address(0x1234), address(0xCAFE), 5e6, 100, 200, uint64(block.number + 100), 0);
    }

    function test_CovenantRequiresBorrowerAcceptance() public {
        vm.prank(lender);
        uint256 id = covenant.createFacility{value: 100 ether}(borrower, 20 ether, uint64(block.number + 1_000));
        vm.prank(lender);
        uint256 cid = covenant.createCovenant(
            id, 1, address(0x1234), address(0xCAFE), 5e6, 100, 200, uint64(block.number + 100), 0
        );
        (,,,,,,,,,,, CovenantFacility.CovenantStatus beforeStatus) = covenant.covenants(cid);
        assertEq(uint256(beforeStatus), uint256(CovenantFacility.CovenantStatus.Proposed));

        vm.prank(borrower);
        covenant.acceptCovenant(cid);
        (,,,,,,,,,,, CovenantFacility.CovenantStatus afterStatus) = covenant.covenants(cid);
        assertEq(uint256(afterStatus), uint256(CovenantFacility.CovenantStatus.Pending));
    }

    function test_LenderCannotCloseCommittedFacilityBeforeMaturity() public {
        vm.prank(lender);
        uint256 id = covenant.createFacility{value: 100 ether}(borrower, 20 ether, uint64(block.number + 1_000));
        vm.prank(lender);
        vm.expectRevert(CovenantFacility.FacilityNotClosable.selector);
        covenant.closeFacility(id);
    }

    function test_LenderCanCloseAfterMaturity() public {
        vm.prank(lender);
        uint256 id = covenant.createFacility{value: 100 ether}(borrower, 20 ether, uint64(block.number + 10));
        vm.roll(block.number + 11);
        vm.prank(lender);
        covenant.closeFacility(id);
        (,,,,,,,, CovenantFacility.FacilityStatus status) = covenant.facilities(id);
        assertEq(uint256(status), uint256(CovenantFacility.FacilityStatus.Closed));
    }

    function test_ExpiredCovenantFreezesFacility() public {
        vm.prank(lender);
        uint256 id = covenant.createFacility{value: 100 ether}(borrower, 20 ether, uint64(block.number + 1_000));
        vm.prank(lender);
        uint256 cid = covenant.createCovenant(
            id, 1, address(0x1234), address(0xCAFE), 5e6, 100, 200, uint64(block.number + 10), 0
        );
        vm.prank(borrower);
        covenant.acceptCovenant(cid);
        MockChainInfo(NativeChainInfoLib.PRECOMPILE_ADDRESS).setFrontier(1, 201 + 0); // window [100,200], margin 0
        vm.roll(block.number + 11);
        covenant.freezeExpiredCovenant(cid);
        (,,,,,,,, CovenantFacility.FacilityStatus status) = covenant.facilities(id);
        assertEq(uint256(status), uint256(CovenantFacility.FacilityStatus.Frozen));
    }
}
