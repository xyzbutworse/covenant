// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {CovenantFacility} from "../src/CovenantFacility.sol";

contract Deploy is Script {
    function run() external returns (CovenantFacility facility) {
        uint256 privateKey = vm.envUint("CREDITCOIN_WALLET_PRIVATE_KEY");
        vm.startBroadcast(privateKey);
        facility = new CovenantFacility();
        vm.stopBroadcast();
    }
}
