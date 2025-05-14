// // SPDX-License-Identifier: AGPL-3.0
// pragma solidity ^0.8.20;

// import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
// import {OrallyConsumer} from "./OrallyConsumer.sol";

// contract OrallyMulticall is OrallyConsumer, Initializable {
//     function initialize(address _executorsRegistry) public initializer {
//         __OrallyConsumer_init(_executorsRegistry);
//     }

//     struct Call {
//         address target;
//         bytes callData;
//         uint256 gasLimit;
//     }

//     struct Transfer {
//         address target;
//         uint256 value;
//     }

//     struct Result {
//         bool success;
//         uint256 usedGas;
//         bytes returnData;
//     }

//     event MulticallExecuted(address indexed sender, Result[] resultExecutionData, Call[] callsData);

//     function multicall(
//         Call[] calldata calls
//     ) external onlyExecutor returns (Result[] memory) {
//         uint256 length = calls.length;
//         Result[] memory returnData = new Result[](length);
//         uint256 gasBefore;
//         for (uint256 i = 0; i < length; i++) {
//             gasBefore = gasleft();
//             if (gasBefore < (calls[i].gasLimit + 1000) && length != 1) {
//                 return returnData;
//             }

//             Result memory result = returnData[i];
//             (result.success, result.returnData) = calls[i].target.call(
//                 calls[i].callData
//             );
//             result.usedGas = gasBefore - gasleft();
//             returnData[i] = result;
//         }

//         emit MulticallExecuted(msg.sender, returnData, calls);

//         return returnData;
//     }

//     function multitransfer(Transfer[] calldata transfers) external payable onlyExecutor {
//         for (uint256 i = 0; i < transfers.length; i++) {
//             payable(transfers[i].target).transfer(transfers[i].value);
//         }
//     }
// }
