// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "node_modules/@openzeppelin/contracts/access/Ownable.sol";

import {AggregatorV3Interface} from "node_modules/@chainlink/contracts/src/v0.4/interfaces/AggregatorV3Interface.sol";

/**
 * THIS IS AN EXAMPLE CONTRACT THAT USES HARDCODED
 * VALUES FOR CLARITY.
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */

/**
 * If you are reading data feeds on L2 networks, you must
 * check the latest answer from the L2 Sequencer Uptime
 * Feed to ensure that the data is accurate in the event
 * of an L2 sequencer outage. See the
 * https://docs.chain.link/data-feeds/l2-sequencer-feeds
 * page for details.
 */

contract BinaryOptionMarket is Ownable {
    enum Side {
        Long,
        Short
    }
    enum Phase {
        Trading,
        Bidding,
        Maturity,
        Expiry
    }

    struct OracleDetails {
        int strikePrice;
        int finalPrice;
    }

    struct Position {
        uint long;
        uint short;
    }

    struct MarketFees {
        uint poolFee;
        uint creatorFee;
        uint refundFee;
    }

    OracleDetails public oracleDetails;
    //OracleConsumer internal priceFeed;
    AggregatorV3Interface internal dataFeed;
    uint8 public priceDecimals;


    uint256 public strikePrice;
    uint256 public deployTime;
    uint public biddingStartTime;
    uint256 public maturityTime;
    uint256 public resolveTime;

    Position public positions;
    MarketFees public fees;
    uint public totalDeposited;
    bool public resolved;
    Phase public currentPhase;
    uint public feePercentage;
    string public tradingPair;
    uint public indexBg;

    mapping(address => uint) public longBids;
    mapping(address => uint) public shortBids;
    mapping(address => bool) public hasClaimed;

    event Bid(Side side, address indexed account, uint value);
    event MarketResolved(int finalPrice, uint timeStamp);
    event RewardClaimed(address indexed account, uint value);
    event Withdrawal(address indexed user, uint amount);
    event PositionUpdated(
        uint timestamp,
        uint longAmount,
        uint shortAmount,
        uint totalDeposited
    );

    
    constructor(
        int _strikePrice,
        address _owner,
        string memory _tradingPair,
        address _priceFeedAddress,
        uint _maturityTime,
        uint _feePercentage,
        uint _indexBg
    ) Ownable(_owner) {

        require(_maturityTime > block.timestamp, "Maturity time must be in the future");
        require(_feePercentage >= 1 && _feePercentage <= 200, "Fee must be between 0.1% and 20%");
        require(_indexBg >= 1 && _indexBg <= 10, "Index background must be between 1 and 10");

        oracleDetails = OracleDetails(_strikePrice, _strikePrice);
        tradingPair = _tradingPair;
        maturityTime = _maturityTime;
        deployTime = block.timestamp;
        feePercentage = _feePercentage;
        indexBg = _indexBg;

        dataFeed = AggregatorV3Interface(_priceFeedAddress);
        priceDecimals = dataFeed.decimals();

        currentPhase = Phase.Trading;
        transferOwnership(msg.sender); // Initialize the Ownable contract with the contract creator
    }

    function bid(Side side) public payable {
        require(currentPhase == Phase.Bidding, "Not in bidding phase");
        require(msg.value > 0, "Value must be greater than zero");
        
        if (side == Side.Long) {
            positions.long += msg.value;
            longBids[msg.sender] += msg.value;
        } else {
            positions.short += msg.value;
            shortBids[msg.sender] += msg.value;
        }

        totalDeposited += msg.value;

        emit PositionUpdated(
            block.timestamp,
            positions.long,
            positions.short,
            totalDeposited
        );

        emit Bid(side, msg.sender, msg.value);
    }

    event MarketOutcome(Side winningSide, address indexed user, bool isWinner);

    function resolveMarket() external {
        require(currentPhase == Phase.Bidding, "Market not in bidding phase");
        require(block.timestamp >= maturityTime, "Too early to resolve");

        currentPhase = Phase.Maturity;
        resolveTime = block.timestamp;

        // Get the price from the smart contract itself
        // requestPriceFeed();

        (
            ,
            /* uint80 roundID */ int answer,
            ,
            /*uint startedAt*/ uint timeStamp /*uint80 answeredInRound*/,

        ) = dataFeed.latestRoundData();

        resolveWithFulfilledData(answer, timeStamp);
    }

    function resolveWithFulfilledData(int _rate, uint256 _timestamp) internal {
        // Parse price from string to uint
        // uint finalPrice = parsePrice(oracleDetails.finalPrice);

        int finalPrice = _rate;
        uint updatedAt = _timestamp;

        uint normalizedPrice = normalizePrice(finalPrice);

        resolved = true;
        currentPhase = Phase.Maturity;
        oracleDetails.finalPrice = int256(normalizedPrice);
        emit MarketResolved(finalPrice, updatedAt);

        Side winningSide;
        if (finalPrice >= oracleDetails.strikePrice) {
            winningSide = Side.Long;
        } else {
            winningSide = Side.Short;
        }

        emit MarketOutcome(winningSide, address(0), true);
    }

    function claimReward() external {
        require(currentPhase == Phase.Expiry, "Market not in expiry phase");
        require(resolved, "Market is not resolved yet");
        require(!hasClaimed[msg.sender], "Reward already claimed");

        int finalPrice = oracleDetails.finalPrice;

        Side winningSide;
        if (finalPrice >= oracleDetails.strikePrice) {
            winningSide = Side.Long;
        } else {
            winningSide = Side.Short;
        }

        uint userDeposit;
        uint totalWinningDeposits;
        bool isWinner = false;

        if (winningSide == Side.Long) {
            userDeposit = longBids[msg.sender];
            totalWinningDeposits = positions.long;
            if (userDeposit > 0) {
                isWinner = true; // Người dùng thắng
            }
        } else {
            userDeposit = shortBids[msg.sender];
            totalWinningDeposits = positions.short;
            if (userDeposit > 0) {
                isWinner = true; // Người dùng thắng
            }
        }

        // Gửi sự kiện kết quả thắng/thua
        emit MarketOutcome(winningSide, msg.sender, isWinner);

        require(userDeposit > 0, "No deposits on winning side");

        uint reward = (userDeposit * totalDeposited) / totalWinningDeposits;
        uint fee = (reward * feePercentage) / 1000;
        uint finalReward = reward - fee;

        hasClaimed[msg.sender] = true;

        payable(msg.sender).transfer(finalReward);
        emit RewardClaimed(msg.sender, finalReward);
    }

    function withdraw() external onlyOwner {
    uint feeAmount = (totalDeposited * feePercentage) / 1000; 

    require(feeAmount > 0, "No fee to withdraw.");
    require(address(this).balance >= feeAmount, "Insufficient contract balance.");

    payable(msg.sender).transfer(feeAmount);

    emit Withdrawal(msg.sender, feeAmount);
}

    function startBidding() external onlyOwner {
        require(currentPhase == Phase.Trading, "Market not in trading phase");
        biddingStartTime = block.timestamp;
        currentPhase = Phase.Bidding;
    }

    function expireMarket() external onlyOwner {
        require(currentPhase == Phase.Maturity, "Market not in maturity phase");
        require(resolved == true, "Market is not resolved yet");
        currentPhase = Phase.Expiry;
    }

    function parsePrice(
        string memory priceString
    ) internal pure returns (uint) {
        bytes memory priceBytes = bytes(priceString);
        uint price = 0;

        for (uint i = 0; i < priceBytes.length; i++) {
            require(
                priceBytes[i] >= 0x30 && priceBytes[i] <= 0x39,
                "Invalid price string"
            );
            price = price * 10 + (uint(uint8(priceBytes[i])) - 0x30);
        }

        return price;
    }

    function getFinalPrice() public view returns (int) {
        return oracleDetails.finalPrice;
    }

    function getChainlinkDataFeedLatestAnswer() public view returns (int) {
        // prettier-ignore
        (
            /* uint80 roundID */,
            int answer,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = dataFeed.latestRoundData();
        return answer;
    }

    function normalizePrice(int rawPrice) internal view returns (uint256) {
        require(rawPrice >= 0, "Invalid negative price");
        uint8 decimalsFromFeed = priceDecimals;

        if (decimalsFromFeed == 8) {
            return uint256(rawPrice);
        } else if (decimalsFromFeed < 8) {
            return uint256(rawPrice) * (10 ** (8 - decimalsFromFeed));
        } else {
            return uint256(rawPrice) / (10 ** (decimalsFromFeed - 8));
        }
    }
}
