// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "./OracleConsumer.sol";

contract BinaryOptionMarket is Ownable {
    enum Side { Long, Short }
    enum Phase { Trading, Bidding, Maturity, Expiry }

    struct OracleDetails {
        uint strikePrice;
        string finalPrice;
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

    uint256 public strikePrice;
    uint256 public deployTime;
    OracleDetails public oracleDetails;
    OracleConsumer internal priceFeed;
    Position public positions;
    MarketFees public fees;
    uint public totalDeposited;
    bool public resolved;
    Phase public currentPhase;
    uint public feePercentage = 10; // 10% fee on rewards
    mapping(address => uint) public longBids;
    mapping(address => uint) public shortBids;
    mapping(address => bool) public hasClaimed;

    // Thêm biến thời gian
    uint public maturityTime; // Thời gian resolve market
    uint public resolveTime;
    string public tradingPair;
    uint public biddingStartTime; // Thêm biến state

    event Bid(Side side, address indexed account, uint value);
    event MarketResolved(string finalPrice, uint timeStamp);
    event RewardClaimed(address indexed account, uint value);
    event Withdrawal(address indexed user, uint amount);
    event PositionUpdated(
        uint timestamp,
        uint longAmount,
        uint shortAmount,
        uint totalDeposited
    );
    event MarketOutcome(Side winningSide, address indexed user, bool isWinner);

    constructor(
        uint256 _strikePrice, 
        address _owner,
        string memory _tradingPair,
        uint _maturityTime
    ) Ownable(_owner) {
        require(_maturityTime > block.timestamp, "Maturity time must be in the future");
        strikePrice = _strikePrice;
        tradingPair = _tradingPair;
        maturityTime = _maturityTime;
        deployTime = block.timestamp;
        currentPhase = Phase.Trading;
    }

    function setStrikePrice(uint _strikePrice) external onlyOwner {
        oracleDetails.strikePrice = _strikePrice;
    }

    function bid(Side side) public payable {
        require(currentPhase == Phase.Bidding, "Not in Bidding phase");
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

    function resolveMarket() external {
        require(currentPhase == Phase.Bidding, "Market not in Bidding phase");
        require(block.timestamp >= maturityTime, "Too early to resolve");
        
        currentPhase = Phase.Maturity;
        resolveTime = block.timestamp;

        string memory price = "10"; // Giá từ Oracle
        oracleDetails.finalPrice = price;
        resolved = true;

        uint finalPrice = parsePrice(oracleDetails.finalPrice);
        Side winningSide = finalPrice < oracleDetails.strikePrice ? Side.Short : Side.Long;
        
        emit MarketResolved(price, block.timestamp);
        emit MarketOutcome(winningSide, address(0), true);
    }

    function claimReward() external {
        require(currentPhase == Phase.Expiry, "Market not in expiry phase");
        require(resolved, "Market is not resolved yet");
        require(!hasClaimed[msg.sender], "Reward already claimed");

        uint finalPrice = parsePrice(oracleDetails.finalPrice);
        uint strikePrice = oracleDetails.strikePrice;
        
        Side winningSide = finalPrice < strikePrice ? Side.Short : Side.Long;

        uint userDeposit;
        uint totalWinningDeposits;

        if (winningSide == Side.Long) {
            userDeposit = longBids[msg.sender];
            totalWinningDeposits = positions.long;
        } else {
            userDeposit = shortBids[msg.sender];
            totalWinningDeposits = positions.short;
        }

        require(userDeposit > 0, "No deposits on winning side");

        uint reward = (userDeposit * totalDeposited) / totalWinningDeposits;
        uint fee = (reward * feePercentage) / 100;
        uint finalReward = reward - fee;

        hasClaimed[msg.sender] = true;

        payable(msg.sender).transfer(finalReward);
        emit RewardClaimed(msg.sender, finalReward);
    }

    function withdraw() public onlyOwner {
        uint amount = address(this).balance;
        require(amount > 0, "No balance to withdraw.");
        payable(msg.sender).transfer(amount);
        emit Withdrawal(msg.sender, amount);    
    }

    function startBidding() external onlyOwner {
        require(currentPhase == Phase.Trading, "Market not in Trading phase");
        currentPhase = Phase.Bidding;
        biddingStartTime = block.timestamp; // Set thời điểm bắt đầu bidding
    }

    function expireMarket() external {
        require(currentPhase == Phase.Maturity, "Market not in maturity phase");
        require(block.timestamp >= resolveTime + 30 seconds, "Too early to expire");
        currentPhase = Phase.Expiry;
    }

    function parsePrice(string memory priceString) internal pure returns (uint) {
        bytes memory priceBytes = bytes(priceString);
        uint price = 0;

        for (uint i = 0; i < priceBytes.length; i++) {
            require(priceBytes[i] >= 0x30 && priceBytes[i] <= 0x39, "Invalid price string");
            price = price * 10 + (uint(uint8(priceBytes[i])) - 0x30);
        }

        return price;
    }
}