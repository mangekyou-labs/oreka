import { useState, useEffect, useCallback } from 'react';
import { ethers, BigNumber } from 'ethers';
import BinaryOptionMarket from '../abis/BinaryOptionMarketABI.json';
import { useAuth } from '../../context/AuthContext';
import { Phase } from '../types'; // Ensure this import is correct
import { formatUTCToZonedTime, calculateTimeRemaining, getCurrentUnixTimestamp } from '../../utils/timeUtils';

// Define enums and interfaces
export enum Side {
  Long = 0,
  Short = 1,
}

export interface PositionPoint {
  timestamp: number;
  longPercentage: number | null;
  shortPercentage: number | null;
  isMainPoint: boolean;
  isFixed?: boolean;
}

export interface Position {
  long: number;
  short: number;
}

export const useMarket = (contractAddress: string) => {
  const { isConnected, walletAddress } = useAuth();
  
  // Contract state
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [positions, setPositions] = useState<Position>({ long: 0, short: 0 });
  const [strikePrice, setStrikePrice] = useState('');
  const [currentPhase, setCurrentPhase] = useState<Phase>(Phase.Trading);
  const [tradingPair, setTradingPair] = useState('');
  const [deployTime, setDeployTime] = useState(0);
  const [maturityTime, setMaturityTime] = useState(0);
  const [biddingStartTime, setBiddingStartTime] = useState(0);
  const [resolveTime, setResolveTime] = useState<number>(0);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [oracleDetails, setOracleDetails] = useState({});
  const [owner, setOwner] = useState('');
  const [feePercentage, setFeePercentage] = useState(10); // Default 1%
  
  
  // User-specific state
  const [userPosition, setUserPosition] = useState<Side | null>(null);
  const [reward, setReward] = useState(0);
  const [showClaimButton, setShowClaimButton] = useState(false);
  const [canResolve, setCanResolve] = useState(false);
  const [contractBalance, setContractBalance] = useState(0);
  
  // Position history
  const [positionHistory, setPositionHistory] = useState<PositionPoint[]>([]);
  const positionHistoryKey = `position_history_${contractAddress}`;
  
  // Thêm provider state
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  
  // Khởi tạo provider
  useEffect(() => {
    if (window.ethereum) {
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(web3Provider);
    }
  }, []);

  // Khởi tạo contract khi có địa chỉ
  useEffect(() => {
    if (!contractAddress) return;

    const initializeContract = async () => {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(
          contractAddress,
          BinaryOptionMarket.abi,
          provider
        );
        setContract(contract);
        await fetchMarketDetails(contract); // Fetch market details after contract is set
      } catch (error) {
        console.error("Error initializing contract:", error);
      }
    };

    initializeContract();
  }, [contractAddress]);
  
  // Load position history from localStorage
  useEffect(() => {
    if (contractAddress) {
      const savedHistory = localStorage.getItem(positionHistoryKey);
      if (savedHistory) {
        try {
          setPositionHistory(JSON.parse(savedHistory));
        } catch (error) {
          console.error("Error parsing position history:", error);
          setDefaultPositionHistory();
        }
      } else {
        setDefaultPositionHistory();
      }
    }
  }, [contractAddress]);
  
  // Helper function to set default position history
  const setDefaultPositionHistory = () => {
    setPositionHistory([{
      timestamp: Date.now() / 1000,
      longPercentage: 50,
      shortPercentage: 50,
      isMainPoint: true,
      isFixed: true
    }]);
  };
  
  // Save position history to localStorage
  useEffect(() => {
    if (contractAddress && positionHistory.length > 0) {
      try {
        const limitedHistory = limitPositionHistorySize(positionHistory);
        localStorage.setItem(positionHistoryKey, JSON.stringify(limitedHistory));
      } catch (error) {
        console.error("Error saving position history:", error);
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          try {
            const veryLimitedHistory = positionHistory.slice(0, 50);
            localStorage.setItem(positionHistoryKey, JSON.stringify(veryLimitedHistory));
          } catch (retryError) {
            console.error("Failed to save even limited position history:", retryError);
          }
        }
      }
    }
  }, [contractAddress, positionHistory]);
  
  // Helper function to limit position history size
  const limitPositionHistorySize = (history: PositionPoint[]): PositionPoint[] => {
    if (JSON.stringify(history).length < 2000000) {
      return history;
    }
    
    // Keep only the most recent 100 points
    const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
    return sortedHistory.slice(0, 100);
  };
  
  // Fetch contract balance
  const fetchContractBalance = useCallback(async () => {
    if (!contractAddress) return;
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const balanceWei = await provider.getBalance(contractAddress);
      const balanceEth = parseFloat(ethers.utils.formatEther(balanceWei));
      setContractBalance(balanceEth);
    } catch (error) {
      console.error("Error fetching contract balance:", error);
    }
  }, [contractAddress]);
  
  // Fetch market details
  const fetchMarketDetails = useCallback(async (contract: ethers.Contract) => {
    if (!contract) return;
    
    try {
      const phase = await contract.currentPhase();
      setCurrentPhase(phase);
      const [
        strikePriceBN,
        tradingPairValue,
        resolveTimeValue,
        maturityTimeValue,
        deployTimeValue,
        biddingStartTimeValue,
        feePercentageValue,
        totalDepositedValue,
        ownerValue,
        positionsData
      ] = await Promise.all([
        contract.strikePrice(),
        contract.tradingPair(),
        contract.resolveTime(),
        contract.maturityTime(),
        contract.deployTime(),
        contract.biddingStartTime(),
        contract.feePercentage(),
        contract.totalDeposited(),
        contract.owner(),
        contract.positions()
      ]);

      setStrikePrice(ethers.utils.formatUnits(strikePriceBN, 0));
      setTradingPair(tradingPairValue);
      setResolveTime(resolveTimeValue.toNumber());
      setMaturityTime(maturityTimeValue.toNumber());
      setDeployTime(deployTimeValue.toNumber());
      setBiddingStartTime(biddingStartTimeValue.toNumber());
      setFeePercentage(feePercentageValue.toNumber());
      setTotalDeposited(parseFloat(ethers.utils.formatEther(totalDepositedValue)));
      setOwner(ownerValue);
      
      // Cập nhật positions
      setPositions({
        long: parseFloat(ethers.utils.formatEther(positionsData.long)),
        short: parseFloat(ethers.utils.formatEther(positionsData.short))
      });
      
      // Kiểm tra phase transitions dựa trên thời gian UTC hiện tại
      checkPhaseTransitions(
        phase,
        maturityTimeValue.toNumber(),
        biddingStartTimeValue.toNumber()
      );
      
      // Kiểm tra nếu user có quyền claim
      if (isConnected && walletAddress) {
        checkUserCanClaim(contract, phase);
      }
      
    } catch (error) {
      console.error("Error fetching market details:", error);
    }
  }, [isConnected, walletAddress]);
  
  // Thêm hàm để kiểm tra các phase transitions
  const checkPhaseTransitions = useCallback((
    currentPhaseValue: Phase,
    maturityTimeValue: number,
    biddingStartTimeValue: number
  ) => {
    const now = getCurrentUnixTimestamp(); // Lấy thời gian UTC hiện tại
    
    // Kiểm tra nếu phase nên được chuyển dựa trên thời gian
    if (currentPhaseValue === Phase.Trading && biddingStartTimeValue > 0 && now >= biddingStartTimeValue) {
      console.log("Should transition to Bidding phase based on time");
      // Note: Không tự động chuyển phase, chỉ log để debug
    } else if (currentPhaseValue === Phase.Bidding && maturityTimeValue > 0 && now >= maturityTimeValue) {
      console.log("Should transition to Maturity phase based on time");
      setCanResolve(true); // Cho phép resolve market
    }
  }, []);
  
  // Hàm kiểm tra xem user có thể claim reward không
  const checkUserCanClaim = useCallback(async (contract: ethers.Contract, phase: Phase) => {
    if (phase !== Phase.Expiry || !walletAddress) return;
    
    try {
      const [longBid, shortBid, hasClaimed] = await Promise.all([
        contract.longBids(walletAddress),
        contract.shortBids(walletAddress),
        contract.hasClaimed(walletAddress)
      ]);
      
      // Nếu user đã có bid và chưa claim
      if ((longBid.gt(0) || shortBid.gt(0)) && !hasClaimed) {
        // Tính toán reward (đơn giản hóa ở đây)
        const userBid = parseFloat(ethers.utils.formatEther(longBid.add(shortBid)));
        setReward(userBid * 1.5); // Giả sử reward là 1.5x bid
        setShowClaimButton(true);
      } else {
        setShowClaimButton(false);
        setReward(0);
      }
    } catch (error) {
      console.error("Error checking claim status:", error);
    }
  }, [walletAddress]);
  
  // Update position history
  const updatePositionHistory = useCallback((positionsData: any) => {
    const longAmount = parseFloat(ethers.utils.formatEther(positionsData.long));
    const shortAmount = parseFloat(ethers.utils.formatEther(positionsData.short));
    const total = longAmount + shortAmount;
    
    if (total > 0) {
      const longPercentage = (longAmount / total) * 100;
      const shortPercentage = (shortAmount / total) * 100;
      const timestamp = Math.floor(Date.now() / 1000);
      
      const newPoint: PositionPoint = {
        timestamp,
        longPercentage,
        shortPercentage,
        isMainPoint: true
      };
      
      setPositionHistory(prev => {
        // Check if the last point is very similar to avoid too many points
        const lastPoint = prev[prev.length - 1];
        if (lastPoint && 
            Math.abs(lastPoint.longPercentage! - longPercentage) < 0.5 && 
            Math.abs(lastPoint.shortPercentage! - shortPercentage) < 0.5) {
          return prev;
        }
        
        return [...prev, newPoint];
      });
    }
  }, []);
  
  // Calculate potential profit
  const calculatePotentialProfit = useCallback((amount: number, side: Side): number => {
    if (!amount || amount <= 0 || totalDeposited <= 0) return 0;
    
    // Get the total amount for the selected side
    const sideAmount = side === Side.Long ? positions.long : positions.short;
    
    // Calculate the new total after adding the bid amount
    const newSideAmount = sideAmount + amount;
    const newTotalDeposited = totalDeposited + amount;
    
    // Calculate potential reward based on contract logic
    const potentialReward = (amount * newTotalDeposited) / newSideAmount;
    
    // Calculate fee
    const fee = potentialReward * (feePercentage / 1000);
    
    // Final reward after fee
    const finalReward = potentialReward - fee;
    
    // Profit is reward minus original bet
    const profit = finalReward - amount;
    
    return profit;
  }, [positions, totalDeposited, feePercentage]);
  
  // Place bid
  const placeBid = useCallback(async (side: Side, amount: BigNumber): Promise<boolean> => {
    if (!contract || !provider) return false;
    
    try {
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      const tx = await contractWithSigner.bid(side, { value: amount });
      await tx.wait();
      
      // Refresh market details after successful bid
      await fetchMarketDetails(contract);
      return true;
    } catch (error) {
      console.error("Error placing bid:", error);
      return false;
    }
  }, [contract, provider, fetchMarketDetails]);
  
  // Resolve market
  const resolveMarket = useCallback(async (): Promise<boolean> => {
    if (!contract || !canResolve) return false;
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      const tx = await contractWithSigner.resolveMarket({
        gasLimit: 500000
      });
      
      await tx.wait();
      await fetchMarketDetails(contract);
      return true;
    } catch (error) {
      console.error("Error resolving market:", error);
      return false;
    }
  }, [contract, canResolve, fetchMarketDetails]);
  
  // Claim reward
  const claimReward = useCallback(async (): Promise<boolean> => {
    if (!contract || currentPhase !== Phase.Expiry || !showClaimButton) return false;
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      const tx = await contractWithSigner.claimReward();
      await tx.wait();
      
      await fetchMarketDetails(contract);
      setShowClaimButton(false);
      setReward(0);
      return true;
    } catch (error) {
      console.error("Error claiming reward:", error);
      return false;
    }
  }, [contract, currentPhase, showClaimButton, fetchMarketDetails]);
  
  // Expire market
  const expireMarket = useCallback(async (): Promise<boolean> => {
    if (!contract || currentPhase !== Phase.Maturity) return false;
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      const tx = await contractWithSigner.expireMarket();
      await tx.wait();
      
      await fetchMarketDetails(contract);
      return true;
    } catch (error) {
      console.error("Error expiring market:", error);
      return false;
    }
  }, [contract, currentPhase, fetchMarketDetails]);
  
  // Auto-refresh market details
  useEffect(() => {
    if (contract) {
      fetchMarketDetails(contract);
      const interval = setInterval(() => fetchMarketDetails(contract), 5000);
      return () => clearInterval(interval);
    }
  }, [contract, fetchMarketDetails]);
  
  // Cập nhật các utility functions
  const formatTimeToLocal = useCallback((timestamp: number): string => {
    return formatUTCToZonedTime(timestamp);
  }, []);

  const getTimeRemaining = useCallback((targetTimestamp: number): string => {
    return calculateTimeRemaining(targetTimestamp);
  }, []);
  
  return {
    // Contract state
    positions,
    strikePrice,
    currentPhase,
    setCurrentPhase,
    tradingPair,
    deployTime,
    maturityTime,
    biddingStartTime,
    resolveTime,
    totalDeposited,
    oracleDetails,
    owner,
    feePercentage,
    contractBalance,
    
    // User state
    userPosition,
    reward,
    showClaimButton,
    canResolve,
    
    // Position history
    positionHistory,
    setPositionHistory,
    
    // Functions
    fetchMarketDetails,
    placeBid,
    resolveMarket,
    claimReward,
    expireMarket,
    calculatePotentialProfit,
    
    // Constants
    Side,
    Phase,
    setResolveTime,
    
    // New functions
    formatTimeToLocal,
    getTimeRemaining,
  };
};

export default useMarket; 