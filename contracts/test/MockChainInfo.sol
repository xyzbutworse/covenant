// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice Foundry-only ChainInfo double etched at 0x…0FD3 so expiry/freeze semantics can be
///         driven deterministically. Mirrors the canonical precompile surface used by COVENANT.
contract MockChainInfo {
    mapping(uint64 => uint64) public frontier;

    function setFrontier(uint64 chainKey, uint64 latestAttestedHeight) external {
        frontier[chainKey] = latestAttestedHeight;
    }

    function get_latest_attestation_height_and_hash(uint64 chainKey)
        external
        view
        returns (uint64 height, bytes32 hash, bool isAttestation, bool exists)
    {
        uint64 h = frontier[chainKey];
        return (h, bytes32(uint256(chainKey)), true, h != 0);
    }

    function is_height_attested(uint64 chainKey, uint64 targetHeight) external view returns (bool) {
        return frontier[chainKey] != 0 && frontier[chainKey] >= targetHeight;
    }
}
