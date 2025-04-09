// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.20;

// import "node_modules/@openzeppelin/contracts/access/Ownable.sol";
// import "./OracleConsumer.sol";

// import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

// /**
//  * THIS IS AN EXAMPLE CONTRACT THAT USES HARDCODED
//  * VALUES FOR CLARITY.
//  * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
//  * DO NOT USE THIS CODE IN PRODUCTION.
//  */

// /**
//  * If you are reading data feeds on L2 networks, you must
//  * check the latest answer from the L2 Sequencer Uptime
//  * Feed to ensure that the data is accurate in the event
//  * of an L2 sequencer outage. See the
//  * https://docs.chain.link/data-feeds/l2-sequencer-feeds
//  * page for details.
//  */

// contract BinaryOptionMarket is Ownable {
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
//     OracleConsumer internal priceFeed;
//     AggregatorV3Interface internal dataFeed;

//     Position public positions;
//     MarketFees public fees;
//     uint public totalDeposited;
//     bool public resolved;
//     Phase public currentPhase;
//     uint public feePercentage = 10; // 10% fee on rewards
//     mapping(address => uint) public longBids;
//     mapping(address => uint) public shortBids;
//     mapping(address => bool) public hasClaimed;

//     event Bid(Side side, address indexed account, uint value);
//     event MarketResolved(int finalPrice, uint timeStamp);
//     event RewardClaimed(address indexed account, uint value);
//     event Withdrawal(address indexed user, uint amount);

//     // The problem may lie in the oracle. It should be deployed on Sepolia
//     // FUCK!
//     constructor(
//         address _owner,
//         address _priceFeedAddress,
//         int _strikePrice
//     ) Ownable(_owner) {
//         dataFeed = AggregatorV3Interface(_priceFeedAddress);
//         oracleDetails = OracleDetails(_strikePrice, _strikePrice);
//         currentPhase = Phase.Bidding;
//         transferOwnership(msg.sender); // Initialize the Ownable contract with the contract creator
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
//     function resolveMarket() external onlyOwner {
//         require(currentPhase == Phase.Trading, "Market not in trading phase");

//         // Get the price from the smart contract itself
//         // requestPriceFeed();

//         (
//             ,
//             /* uint80 roundID */ int answer,
//             ,
//             /*uint startedAt*/ uint timeStamp /*uint80 answeredInRound*/,

//         ) = dataFeed.latestRoundData();

//         resolveWithFulfilledData(answer, timeStamp);
//     }

//     function resolveWithFulfilledData(int _rate, uint256 _timestamp) internal {
//         // Parse price from string to uint
//         // uint finalPrice = parsePrice(oracleDetails.finalPrice);

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

//     // question how should we call this frequently?
//     // answer we're going to call it from the resolveMarket - NAIVE method
//     // function requestPriceFeed() internal {
//     //     // Requesting the ICP/USD price feed with a specified callback gas limit
//     //     uint256 requestId = apolloCoordinator.requestDataFeed(
//     //         "ICP/USD",
//     //         300000
//     //     );
//     // }

//     function startTrading() external onlyOwner {
//         require(currentPhase == Phase.Bidding, "Market not in bidding phase");
//         currentPhase = Phase.Trading;
//     }

//     function expireMarket() external onlyOwner {
//         require(currentPhase == Phase.Maturity, "Market not in maturity phase");
//         require(resolved == true, "Market is not resolved yet");
//         currentPhase = Phase.Expiry;
//     }

//     function parsePrice(
//         string memory priceString
//     ) internal pure returns (uint) {
//         bytes memory priceBytes = bytes(priceString);
//         uint price = 0;

//         for (uint i = 0; i < priceBytes.length; i++) {
//             require(
//                 priceBytes[i] >= 0x30 && priceBytes[i] <= 0x39,
//                 "Invalid price string"
//             );
//             price = price * 10 + (uint(uint8(priceBytes[i])) - 0x30);
//         }

//         return price;
//     }

//     function getFinalPrice() public view returns (int) {
//         return oracleDetails.finalPrice;
//     }

//     function getChainlinkDataFeedLatestAnswer() public view returns (int) {
//         // prettier-ignore
//         (
//             /* uint80 roundID */,
//             int answer,
//             /*uint startedAt*/,
//             /*uint timeStamp*/,
//             /*uint80 answeredInRound*/
//         ) = dataFeed.latestRoundData();
//         return answer;
//     }
// }
