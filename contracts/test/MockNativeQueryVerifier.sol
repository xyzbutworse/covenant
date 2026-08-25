// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {INativeQueryVerifier} from "../src/VerifierInterface.sol";

/// @notice Foundry-only stand-in etched at 0x…0FD2 so unit tests drive COVENANT's exact
///         production call surface. Live continuity/attestation math belongs to the real
///         native precompile; this double reproduces its documented observable behavior:
///         Merkle inclusion over keccak256(abi.encodePacked(uint8(0x00), encodedTransaction))
///         leaves with keccak256(abi.encodePacked(uint8(0x01), left, right)) inner nodes,
///         structural continuity requirements, TransactionVerified emission, and the same
///         transaction-index recovery from the sibling path.
contract MockNativeQueryVerifier is INativeQueryVerifier {
    event TransactionVerified(uint64 indexed chainKey, uint64 indexed height, uint64 indexed transactionIndex);

    error InvalidMerkleProof();
    error InvalidContinuityProof();

    bool public failNextVerify;
    /// @dev Research escape hatch: skip inclusion checks so tests can drive COVENANT's
    ///      post-verification decoding logic with otherwise-unverifiable byte inputs.
    bool public acceptAny;

    function setFailNextVerify(bool value) external {
        failNextVerify = value;
    }

    function setAcceptAny(bool value) external {
        acceptAny = value;
    }

    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external returns (bool) {
        if (failNextVerify) {
            failNextVerify = false;
            return false;
        }
        if (!acceptAny && _rootFromSiblings(encodedTransaction, merkleProof) != merkleProof.root) {
            revert InvalidMerkleProof();
        }
        if (continuityProof.lowerEndpointDigest == bytes32(0) || continuityProof.roots.length == 0) {
            revert InvalidContinuityProof();
        }
        emit TransactionVerified(chainKey, height, calculateTxIndex(merkleProof));
        return true;
    }

    function verify(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external view returns (bool) {
        if (!acceptAny && _rootFromSiblings(encodedTransaction, merkleProof) != merkleProof.root) return false;
        if (continuityProof.lowerEndpointDigest == bytes32(0) || continuityProof.roots.length == 0) return false;
        chainKey;
        height;
        return true;
    }

    /// @dev Recovers the transaction index by walking the sibling path leaf -> root.
    function calculateTxIndex(MerkleProof calldata merkleProof) public pure returns (uint64) {
        uint256 index;
        uint256 length = merkleProof.siblings.length;
        for (uint256 i; i < length; ++i) {
            index = index * 2 + (merkleProof.siblings[i].isLeft ? 1 : 0);
        }
        return uint64(index);
    }

    function _rootFromSiblings(bytes calldata encodedTransaction, MerkleProof calldata merkleProof)
        internal
        pure
        returns (bytes32)
    {
        bytes32 acc = keccak256(abi.encodePacked(uint8(0x00), encodedTransaction));
        uint256 length = merkleProof.siblings.length;
        for (uint256 i; i < length; ++i) {
            bytes32 sibling = merkleProof.siblings[i].hash;
            acc = merkleProof.siblings[i].isLeft ? _hashInner(sibling, acc) : _hashInner(acc, sibling);
        }
        return acc;
    }

    function _hashInner(bytes32 left, bytes32 right) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(uint8(0x01), left, right));
    }
}
