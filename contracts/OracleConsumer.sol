// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.16;

import {OrallyPythiaConsumer} from "@orally-network/solidity-sdk/OrallyPythiaConsumer.sol";
import {IApolloCoordinator} from "@orally-network/solidity-sdk/IApolloCoordinator.sol";

contract OracleConsumer is OrallyPythiaConsumer {
    uint8 public decimals;
    string public description;
    uint256 public version;
    uint80 public currentRoundId;

    IApolloCoordinator public apolloCoordinator;
    
    mapping(uint80 => Round) public rounds;
    
    event AnswerUpdated(string indexed pairId, int256 answer, uint256 rate, uint256 decimals, uint256 timestamp);
    event NewRequest(uint256 requestId, string pairId);

    struct Round {
        string answer;
        uint256 updatedAt;
        uint80 answeredInRound;
    }

    constructor(
        address _pythiaRegistry,
        address _apolloCoordinator,
        address _owner
    ) OrallyPythiaConsumer(_pythiaRegistry, _owner) {
        decimals = 9;
        apolloCoordinator = IApolloCoordinator(_apolloCoordinator);
    }

    function getRoundData(uint80 _roundId)
        external
        view
        returns (uint80 roundId, string memory answer, uint256 updatedAt, uint80 answeredInRound)
    {
        return (_roundId, rounds[_roundId].answer, rounds[_roundId].updatedAt, rounds[_roundId].answeredInRound);
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, string memory answer, uint256 updatedAt, uint80 answeredInRound)
    {
        uint80 round = currentRoundId > 0 ? currentRoundId - 1 : 0;
        return (round, rounds[round].answer, rounds[round].updatedAt, rounds[round].answeredInRound);
    }
    
    function requestPriceFeed(string memory pairId, uint256 callbackGasLimit) public returns (uint256) {
        // Request data from Apollo
        uint256 requestId = apolloCoordinator.requestDataFeed(pairId, callbackGasLimit);
        emit NewRequest(requestId, pairId);
        return requestId;
    }

    // This function will be called by the Orally executor with the requested data
    function updateRate(
        string memory pairId,
        uint256 rate,
        uint256 _decimals,
        uint256 timestamp
    ) external onlyExecutor(workflowId) {
        rounds[currentRoundId].answer = _formatRate(rate, _decimals);
        rounds[currentRoundId].updatedAt = timestamp;
        rounds[currentRoundId].answeredInRound = currentRoundId;
        
        emit AnswerUpdated(pairId, int256(rate), rate, _decimals, timestamp);
        
        currentRoundId++;
    }
    
    // Helper function to format rate as a string with proper decimals
    function _formatRate(uint256 rate, uint256 _decimals) internal pure returns (string memory) {
        // Basic conversion of rate to string considering decimals
        // This is a simplified example and might need refinement
        return _uintToString(rate);
    }
    
    // Helper function to convert uint to string
    function _uintToString(uint256 _value) internal pure returns (string memory) {
        if (_value == 0) {
            return "0";
        }
        
        uint256 temp = _value;
        uint256 digits;
        
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (_value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + _value % 10));
            _value /= 10;
        }
        
        return string(buffer);
    }
}