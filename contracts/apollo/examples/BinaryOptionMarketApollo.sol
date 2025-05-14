// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.20;

// import "@openzeppelin/contracts/access/Ownable.sol";
// import {ApolloReceiver} from "../ApolloReceiver.sol";
// /**
//  * THIS IS AN EXAMPLE CONTRACT THAT USES HARDCODED
//  * VALUES FOR CLARITY.
//  * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
//  * DO NOT USE THIS CODE IN PRODUCTION.
//  */

// contract BinaryOptionMarketApollo is Ownable, ApolloReceiver {
//     enum Side {
//         Long,
//         Short
//     }
//     enum Phase {
//         Bidding,
//         Trading,
//         Maturity,
//         Expiry
//     }

//     struct OracleDetails {
//         int strikePrice;
//         int finalPrice;
//     }

//     struct Position {
//         uint long;
//         uint short;
//     }

//     struct MarketFees {
//         uint poolFee;
//         uint creatorFee;
//         uint refundFee;
//     }

//     OracleDetails public oracleDetails;
//     Position public positions;
//     MarketFees public fees;
//     uint public totalDeposited;
//     bool public resolved;
//     Phase public currentPhase;
//     uint public feePercentage = 10; // 10% fee on rewards
//     mapping(address => uint) public longBids;
//     mapping(address => uint) public shortBids;
//     mapping(address => bool) public hasClaimed;
    
//     // Price feed variables
//     string public priceFeedId;
//     uint256 private latestRequestId;
//     int private latestPrice;
//     uint256 private latestTimestamp;

//     event Bid(Side side, address indexed account, uint value);
//     event MarketResolved(int finalPrice, uint timeStamp);
//     event RewardClaimed(address indexed account, uint value);
//     event Withdrawal(address indexed user, uint amount);
//     event PriceFeedRequested(uint256 requestId);
//     event PriceFeedFulfilled(uint256 requestId, int price, uint256 timestamp);

//     constructor(
//         address _owner,
//         address _executorsRegistry,
//         address _apolloCoordinator,
//         string memory _priceFeedId,
//         int _strikePrice
//     ) Ownable(_owner) ApolloReceiver(_executorsRegistry, _apolloCoordinator) {
//         priceFeedId = _priceFeedId;
//         oracleDetails = OracleDetails(_strikePrice, 0);
//         currentPhase = Phase.Bidding;
//     }

//     function bid(Side side) public payable {
//         require(currentPhase == Phase.Bidding, "Not in bidding phase");
//         require(msg.value > 0, "Value must be greater than zero");

//         if (side == Side.Long) {
//             positions.long += msg.value;
//             longBids[msg.sender] += msg.value;
//         } else {
//             positions.short += msg.value;
//             shortBids[msg.sender] += msg.value;
//         }

//         totalDeposited += msg.value;
//         emit Bid(side, msg.sender, msg.value);
//     }

//     event MarketOutcome(Side winningSide, address indexed user, bool isWinner);
    
//     function requestPriceFeed() public {
//         require(currentPhase == Phase.Trading, "Market not in trading phase");
//         // Request the price feed with a specified callback gas limit
//         latestRequestId = apolloCoordinator.requestDataFeed(
//             priceFeedId,
//             300000
//         );
//         emit PriceFeedRequested(latestRequestId);
//     }

//     // Overriding the fulfillData function to handle incoming data
//     function fulfillData(bytes memory data) internal override {
//         (
//             uint256 _requestId,
//             string memory _dataFeedId,
//             uint256 _rate,
//             uint256 _decimals,
//             uint256 _timestamp
//         ) = abi.decode(data, (uint256, string, uint256, uint256, uint256));
        
//         // Convert rate to int
//         latestPrice = int(_rate);
//         latestTimestamp = _timestamp;
        
//         emit PriceFeedFulfilled(_requestId, latestPrice, latestTimestamp);
        
//         // If this is the price feed we requested for market resolution, resolve the market
//         if (_requestId == latestRequestId && !resolved) {
//             resolveWithFulfilledData(latestPrice, latestTimestamp);
//         }
//     }

//     function resolveMarket() external onlyOwner {
//         require(currentPhase == Phase.Trading, "Market not in trading phase");
//         requestPriceFeed();
//     }

//     function resolveWithFulfilledData(int _rate, uint256 _timestamp) internal {
//         int finalPrice = _rate;
//         uint updatedAt = _timestamp;

//         resolved = true;
//         currentPhase = Phase.Maturity;
//         oracleDetails.finalPrice = finalPrice;
//         emit MarketResolved(finalPrice, updatedAt);

//         Side winningSide;
//         if (finalPrice >= oracleDetails.strikePrice) {
//             winningSide = Side.Long;
//         } else {
//             winningSide = Side.Short;
//         }

//         emit MarketOutcome(winningSide, address(0), true);
//     }

//     function claimReward() external {
//         require(currentPhase == Phase.Expiry, "Market not in expiry phase");
//         require(resolved, "Market is not resolved yet");
//         require(!hasClaimed[msg.sender], "Reward already claimed");

//         int finalPrice = oracleDetails.finalPrice;

//         Side winningSide;
//         if (finalPrice >= oracleDetails.strikePrice) {
//             winningSide = Side.Long;
//         } else {
//             winningSide = Side.Short;
//         }

//         uint userDeposit;
//         uint totalWinningDeposits;
//         bool isWinner = false;

//         if (winningSide == Side.Long) {
//             userDeposit = longBids[msg.sender];
//             totalWinningDeposits = positions.long;
//             if (userDeposit > 0) {
//                 isWinner = true; // Người dùng thắng
//             }
//         } else {
//             userDeposit = shortBids[msg.sender];
//             totalWinningDeposits = positions.short;
//             if (userDeposit > 0) {
//                 isWinner = true; // Người dùng thắng
//             }
//         }

//         // Gửi sự kiện kết quả thắng/thua
//         emit MarketOutcome(winningSide, msg.sender, isWinner);

//         require(userDeposit > 0, "No deposits on winning side");

//         uint reward = (userDeposit * totalDeposited) / totalWinningDeposits;
//         uint fee = (reward * feePercentage) / 100;
//         uint finalReward = reward - fee;

//         hasClaimed[msg.sender] = true;

//         payable(msg.sender).transfer(finalReward);
//         emit RewardClaimed(msg.sender, finalReward);
//     }

//     function withdraw() public onlyOwner {
//         uint amount = address(this).balance;
//         require(amount > 0, "No balance to withdraw.");

//         payable(msg.sender).transfer(amount);

//         emit Withdrawal(msg.sender, amount);
//     }

//     function startTrading() external onlyOwner {
//         require(currentPhase == Phase.Bidding, "Market not in bidding phase");
//         currentPhase = Phase.Trading;
//     }

//     function expireMarket() external onlyOwner {
//         require(currentPhase == Phase.Maturity, "Market not in maturity phase");
//         require(resolved == true, "Market is not resolved yet");
//         currentPhase = Phase.Expiry;
//     }

//     function getFinalPrice() public view returns (int) {
//         return oracleDetails.finalPrice;
//     }

//     function getLatestPrice() public view returns (int) {
//         return latestPrice;
//     }
// }
