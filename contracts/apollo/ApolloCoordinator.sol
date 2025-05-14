// // SPDX-License-Identifier: AGPL-3.0
// pragma solidity 0.8.20;

// import {IApolloCoordinator} from "./IApolloCoordinator.sol";
// import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// /**
//  * @title ApolloCoordinator
//  * @dev This contract allows consumer contracts to request data from the Apollo Network.
//  */
// contract ApolloCoordinator is IApolloCoordinator, Initializable {
//     // Counter for generating unique request IDs
//     uint256 public requestCounter;

//     function initialize() public initializer {}

//     /**
//      * @notice Requests data from the Apollo network.
//      * @param dataFeedId The identifier of the data feed being requested.
//      * @param callbackGasLimit The gas limit for the callback transaction.
//      */
//     function requestDataFeed(
//         string calldata dataFeedId,
//         uint256 callbackGasLimit
//     ) external returns (uint256) {
//         uint256 requestId = requestCounter;
//         requestCounter++;

//         emit DataFeedRequested(requestId, dataFeedId, callbackGasLimit, msg.sender);

//         return requestId;
//     }

//     /**
//      * @notice Requests data from the Apollo network.
//      * @param callbackGasLimit The gas limit for the callback transaction.
//      * @param numWords The number of words to request.
//      */
//     function requestRandomFeed(
//         uint256 callbackGasLimit,
//         uint256 numWords
//     ) external returns (uint256) {
//         uint256 requestId = requestCounter;
//         requestCounter++;

//         emit RandomFeedRequested(requestId, callbackGasLimit, numWords, msg.sender);

//         return requestId;
//     }
// }
