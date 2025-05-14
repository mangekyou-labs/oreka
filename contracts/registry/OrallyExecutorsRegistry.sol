// // SPDX-License-Identifier: AGPL-3.0
// pragma solidity ^0.8.20;

// import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// import {IOrallyExecutorsRegistry} from "./IOrallyExecutorsRegistry.sol";

// /**
//  * @title OrallyExecutorsRegistry
//  * @notice Used to store all executor addresses
//  */
// contract OrallyExecutorsRegistry is OwnableUpgradeable, IOrallyExecutorsRegistry {
//     mapping(bytes32 => mapping(address => bool)) public executors;

//     bytes32 public PYTHIA_EXECUTOR;
//     bytes32 public APOLLO_EXECUTOR;

//     /**
//      * @notice Initialises the upgradeable contract
//      */
//     function initialize() external virtual initializer {
//         PYTHIA_EXECUTOR = keccak256("PYTHIA_EXECUTOR");
//         APOLLO_EXECUTOR = keccak256("APOLLO_EXECUTOR");
//         __Ownable_init(msg.sender);
//     }

//     function isPythiaExecutor(address _addr) public view returns (bool) {
//         return isExecutor(PYTHIA_EXECUTOR, _addr);
//     }

//     function isApolloExecutor(address _addr) public view returns (bool) {
//         return isExecutor(APOLLO_EXECUTOR, _addr);
//     }

//     function isExecutor(bytes32 _service, address _addr) public view returns (bool) {
//         return executors[_service][_addr];
//     }

//     function add(bytes32 _service, address _addr) public onlyOwner {
//         require(!executors[_service][_addr], "Executor already exists");
//         executors[_service][_addr] = true;
//         emit ExecutorAdded(_service, _addr);
//     }

//     function remove(bytes32 _service, address _addr) public onlyOwner {
//         require(executors[_service][_addr], "Executor does not exist");
//         executors[_service][_addr] = false;
//         emit ExecutorRemoved(_service, _addr);
//     }
// }
