// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./orally-sdk/IOrallyVerifierOracle.sol";
import "./orally-sdk/OrallyStructs.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BinaryOptionMarket is Ownable {
    enum Side { Long, Short }
    enum Phase { Trading, Bidding, Maturity, Expiry }

    struct OracleDetails {
        uint256 strikePrice;
        uint256 finalPrice;
    }
    struct Position {
        uint256 long;
        uint256 short;
    }

    OracleDetails public oracleDetails;
    Position      public positions;

    IOrallyVerifierOracle public oracle;
    string                public feedId;

    uint256 public latestPrice;
    uint8   public latestDecimals;
    uint256 public lastUpdated;

    uint256 public totalDeposited;
    bool    public resolved;
    Phase   public currentPhase;
    
    uint256 public deployTime;
    uint256 public biddingStartTime;
    uint256 public maturityTime;
    uint256 public resolveTime;
    uint256 public feePercentage;
    string  public tradingPair;
    uint256 public indexBg;

    mapping(address => uint256) public longBids;
    mapping(address => uint256) public shortBids;
    mapping(address => bool)    public hasClaimed;

    // --- Events ---
    event Bid(Side side, address indexed user, uint256 amount);
    event MarketResolved(uint256 finalPrice, uint256 timeStamp);
    event RewardClaimed(address indexed user, uint256 amount);
    event Withdrawal(address indexed to, uint256 amount);
    event PositionUpdated(
        uint256 timestamp,
        uint256 longAmount,
        uint256 shortAmount,
        uint256 totalDeposited
    );
    event MarketOutcome(Side winningSide, address indexed user, bool isWinner);
    event PriceUpdated(uint256 price, uint256 decimals, uint256 timestamp);

    constructor(
        address owner_,
        address oracleAddress_,
        string memory _feedId,
        uint256 strikePrice_,
        uint256 _maturityTime,
        uint256 _feePercentage,
        uint256 _indexBg
    ) Ownable(owner_) {
        require(_maturityTime > block.timestamp, "Maturity time must be in the future");
        require(_feePercentage >= 1 && _feePercentage <= 200, "Fee must be between 0.1% and 20%");
        require(_indexBg >= 1 && _indexBg <= 10, "Index background must be between 1 and 10");
        
        oracleDetails = OracleDetails(strikePrice_, strikePrice_);
        oracle        = IOrallyVerifierOracle(oracleAddress_);
        feedId        = _feedId;
        tradingPair   = _feedId;
        maturityTime  = _maturityTime;
        deployTime    = block.timestamp;
        feePercentage = _feePercentage;
        indexBg       = _indexBg;
        
        currentPhase  = Phase.Trading;
        transferOwnership(msg.sender);
    }

    // --- Bidding ---
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

    // --- Resolution via Sybil ---
    function resolveMarket(bytes calldata proofData) external onlyOwner {
        require(currentPhase == Phase.Bidding, "Not in bidding phase");
        require(block.timestamp >= maturityTime, "Too early to resolve");

        // Verify & cache in one call
        oracle.updatePriceFeed(proofData);  
        OrallyStructs.PriceFeed memory pf = oracle.getPriceFeed(feedId);

        // Store locally
        latestPrice    = pf.price;
        latestDecimals = uint8(pf.decimals);
        lastUpdated    = pf.timestamp;
        resolveTime    = block.timestamp;

        // Finalize
        resolved = true;
        currentPhase = Phase.Maturity;
        oracleDetails.finalPrice = pf.price;
        
        Side winningSide = (pf.price >= oracleDetails.strikePrice) ? Side.Long : Side.Short;
        emit MarketOutcome(winningSide, address(0), true);
        emit MarketResolved(pf.price, pf.timestamp);
    }

    // --- Direct Oracle Access ---
    function fetchOraclePrice(bytes calldata proofData) external onlyOwner returns (OrallyStructs.PriceFeed memory) {
        // Get price feed directly without caching
        OrallyStructs.PriceFeed memory pf = oracle.verifyPriceFeed(proofData);
        
        // Store price information locally
        latestPrice = pf.price;
        latestDecimals = uint8(pf.decimals);
        lastUpdated = pf.timestamp;
        
        emit PriceUpdated(pf.price, pf.decimals, pf.timestamp);
        
        return pf;
    }

    // --- Claim Rewards ---
    function claimReward() external {
        require(currentPhase == Phase.Expiry, "Market not in expiry phase");
        require(resolved, "Market is not resolved yet");
        require(!hasClaimed[msg.sender], "Reward already claimed");

        Side winningSide = (oracleDetails.finalPrice >= oracleDetails.strikePrice)
                      ? Side.Long : Side.Short;

        uint256 userDeposit = (winningSide == Side.Long)
                            ? longBids[msg.sender]
                            : shortBids[msg.sender];
                            
        bool isWinner = userDeposit > 0;
        emit MarketOutcome(winningSide, msg.sender, isWinner);
                            
        require(userDeposit > 0, "No deposits on winning side");

        uint256 totalWinningDeposits = (winningSide == Side.Long)
                           ? positions.long
                           : positions.short;

        uint256 reward = (userDeposit * totalDeposited) / totalWinningDeposits;
        uint256 fee = (reward * feePercentage) / 1000;
        uint256 finalReward = reward - fee;

        hasClaimed[msg.sender] = true;
        payable(msg.sender).transfer(finalReward);
        emit RewardClaimed(msg.sender, finalReward);
    }

    // --- Admin Controls ---
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
    
    function withdraw() external onlyOwner {
        uint256 feeAmount = (totalDeposited * feePercentage) / 1000;
        
        require(feeAmount > 0, "No fee to withdraw.");
        require(address(this).balance >= feeAmount, "Insufficient contract balance.");
        
        payable(msg.sender).transfer(feeAmount);
        emit Withdrawal(msg.sender, feeAmount);
    }

    receive() external payable {}
    fallback() external payable {}
}
