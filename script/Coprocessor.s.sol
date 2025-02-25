// // SPDX-License-Identifier: UNLICENSED
// pragma solidity ^0.8.13;

// import "forge-std/Script.sol";
// import "../contracts/OracleConsumer.sol";
// import "../contracts/BinaryOptionMarketChainlink.sol";

// contract MyScript is Script {
//     function run(address chain_fusion_canister_address) external {
//         // the private key of the deployer is the first private key printed by running anvil

//         uint256 deployerPrivateKey = 0x2ad3e29873166ca988150e65c1ec355015cf423197b100ebd63ed6d28e269966;
//         address ownerPublicKey = 0xc4A68589759A1403c5F3754Aa889656E9A96f49e;
//         // we use that key to broadcast all following transactions
//         vm.startBroadcast(deployerPrivateKey);

//         // this creates the contract. it will have the same address every time if we use a
//         // new instance of anvil for every deployment.

//         // OracleConsumer coprocessor = new OracleConsumer(
//         //     chain_fusion_canister_address
//         // );

//         // we create 1 job
//         // for (uint256 index = 0; index < 1; index++) {
//         //     coprocessor.newJob{value: 0.1 ether}();
//         // }

//         // Sepolia SNX/USD feed address: 0xc0F82A46033b8BdBA4Bb0B0e28Bc2006F64355bC

//         // demo example: define strikePrice for WIF/USD pair at 1.66USD and owner will call the resolveMarket() around August 13th 2024.
//         BinaryOptionMarket binaryOptionMarket = new BinaryOptionMarket(
//             ownerPublicKey,
//             0xc0F82A46033b8BdBA4Bb0B0e28Bc2006F64355bC,
//             166000
//         );
//         vm.stopBroadcast();
//     }
// }
