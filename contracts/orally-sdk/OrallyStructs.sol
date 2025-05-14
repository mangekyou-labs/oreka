// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

contract OrallyStructs {
    // Structure to store information about each price feed
    struct PriceFeed {
        string pairId;     // The identifier for the currency pair
        uint256 price;     // The latest price of the currency pair
        uint256 decimals;  // The decimal places for the price to ensure precision
        uint256 timestamp; // The timestamp when the price was last updated
    }

    struct Meta {
        string feedId;      // The identifier for the data feed
        uint256 timestamp;  // The timestamp HTTP Gateway response happened
        uint256 fee;        // The update fee in ether (could be zero)
//        string fee_symbol;  // The symbol of the fee token
    }

    // Structure to store custom number data
    struct CustomNumber {
        string feedId;      // The identifier for the data feed
        uint256 value;      // The custom number value
        uint256 decimals;   // The timestamp when the number was last updated
    }

    // Structure to store custom string data
    struct CustomString {
        string feedId;  // The identifier for the data feed
        string value;   // The custom string data
    }

    // Structure to store chain data feed and metadata
    struct ReadContractMetadata {
        uint256 chain_id;           // The chain ID of the contract
        address contract_address;   // The address of the contract
        string method;              // The method of the contract call
        string params;              // The parameters of the contract call
        uint256 block_number;       // The block number the contract call happened (0 if last one)
        uint256 timestamp;          // The timestamp HTTP Gateway response happened
        uint256 fee;                // The update fee in ether (could be zero)
        string fee_symbol;          // The symbol of the fee token
    }

    struct ReadLogsData {
        address addr;
        string[] topics;
        bytes data;
        string block_hash;
        uint256 block_number;
        string transaction_hash;
        uint256 transaction_index;
        string log_index;
        string transaction_log_index;
        string log_type;
        bool removed;
    }

    struct ReadLogsMetadata {
        uint256 chain_id;
        uint256 block_from;
        uint256 block_to;
        string[] topics0;
        string[] topics1;
        string[] topics2;
        string[] topics3;
        address[] addresses;
        uint256 timestamp;

        uint256 fee;        // The update fee in ether (could be zero)
        string fee_symbol;  // The symbol of the fee token
    }
}
