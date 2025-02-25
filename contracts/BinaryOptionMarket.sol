// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "./OracleConsumer.sol";

contract BinaryOptionMarket is Ownable {
    enum Side { Long, Short }
    enum Phase { Bidding, Trading, Maturity, Expiry }

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

    event Bid(Side side, address indexed account, uint value);
    event MarketResolved(string finalPrice, uint timeStamp);
    event RewardClaimed(address indexed account, uint value);
    event Withdrawal(address indexed user, uint amount);

    constructor(
        address _owner,
        //address _coprocessor,
        uint _strikePrice
    ) Ownable(_owner) {
        //priceFeed = OracleConsumer(_coprocessor);
        oracleDetails = OracleDetails(_strikePrice, "0");
        currentPhase = Phase.Bidding;
        transferOwnership(msg.sender); // Initialize the Ownable contract with the contract creator
    }

     function setStrikePrice(uint _strikePrice) external onlyOwner {
        oracleDetails.strikePrice = _strikePrice;
    }


    function bid(Side side) public payable {
        require(currentPhase == Phase.Trading, "Not in Trading phase");
        require(msg.value > 0, "Value must be greater than zero");

        if (side == Side.Long) {
            positions.long += msg.value;
            longBids[msg.sender] += msg.value;
        } else {
            positions.short += msg.value;
            shortBids[msg.sender] += msg.value;
        }

        totalDeposited += msg.value;
        emit Bid(side, msg.sender, msg.value);
    }

    event MarketOutcome(Side winningSide, address indexed user, bool isWinner);
    function resolveMarket() external onlyOwner {
        require(currentPhase == Phase.Trading, "Market not in trading phase");
        currentPhase = Phase.Maturity;

        string memory price = "10"; // Đây là giá giả định, sẽ lấy từ Oracle thực tế
        uint updatedAt = 1;
        oracleDetails.finalPrice = price;
        resolved = true;
        emit MarketResolved(price, updatedAt);

        // Thêm thông báo cho bên thắng
        uint finalPrice = parsePrice(oracleDetails.finalPrice);

        Side winningSide;
        if (finalPrice >= oracleDetails.strikePrice) {
            winningSide = Side.Long;
        } else {
            winningSide = Side.Short;
        }

        emit MarketOutcome(winningSide, address(0), true); // Thông báo kết quả thị trường
    }

    function claimReward() external {
        require(currentPhase == Phase.Expiry, "Market not in expiry phase");
        require(resolved, "Market is not resolved yet");
        require(!hasClaimed[msg.sender], "Reward already claimed");

        uint finalPrice = parsePrice(oracleDetails.finalPrice);

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
                isWinner = true;  // Người dùng thắng
            }
        } else {
            userDeposit = shortBids[msg.sender];
            totalWinningDeposits = positions.short;
            if (userDeposit > 0) {
                isWinner = true;  // Người dùng thắng
            }
        }

        // Gửi sự kiện kết quả thắng/thua
        emit MarketOutcome(winningSide, msg.sender, isWinner);

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

    // function oraclePriceAndTimestamp() public view returns (string memory price, uint updatedAt) {
    //     (, string memory answer, uint timeStamp, ) = priceFeed.latestRoundData();
    //     price = answer;
    //     updatedAt = timeStamp;
    // }

    function startTrading() external onlyOwner {
        require(currentPhase == Phase.Bidding, "Market not in bidding phase");
        currentPhase = Phase.Trading;
    }

    function expireMarket() external onlyOwner {
        require(currentPhase == Phase.Maturity, "Market not in maturity phase");
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