/**
 * Customer Component
 * 
 * This component represents the main customer interface for the binary options market.
 * It allows users to view market details, place bids, track positions, and claim rewards.
 * The component manages the entire lifecycle of market participation from the customer perspective.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCallback } from 'react';
import {
  Flex, Box, Text, Button, VStack, useToast, Input, Heading, Image,
  HStack, Icon, Tab, Spacer, Tabs, TabList, TabPanels, TabPanel, Circle, FormControl, FormLabel,
  Link, Skeleton, UnorderedList, ListItem
} from '@chakra-ui/react';
import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import { FaWallet, FaChevronLeft, FaArrowUp, FaArrowDown, FaCoins, FaChevronRight, FaRegClock } from 'react-icons/fa';
import { PiChartLineUpLight } from "react-icons/pi";
import { CheckIcon } from '@chakra-ui/icons';
import { GrInProgress } from "react-icons/gr";
import { ethers } from 'ethers';
import { motion, useAnimation } from 'framer-motion';
import BinaryOptionMarket from '../contracts/abis/BinaryOptionMarketChainlinkABI.json';
import { PriceService, PriceData } from '../services/PriceService';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import MarketCharts from './charts/MarketCharts';

import { format } from 'date-fns';
import { formatTimeToLocal, getCurrentTimestamp, getTimeRemaining } from '../utils/timeUtils';
import { STRIKE_PRICE_MULTIPLIER } from '../utils/constants';
import {
  getTradingPairFromPriceFeed,
  getChartSymbolFromTradingPair,
  formatStrikePriceFromContract,
  formatStrikePriceForContract
} from '../utils/priceFeeds';

import { determineMarketResult } from '../utils/market';
/**
 * Enums for market sides and phases
 */
enum Side { Long, Short }
enum Phase { Trading, Bidding, Maturity, Expiry }


/**
 * Interface for position data tracking
 */
interface PositionData {
  timestamp: number;
  longPercentage: number;
  shortPercentage: number;
  isVisible: boolean;
}

/**
 * Interface for position point used in charts and history
 */
interface PositionPoint {
  timestamp: number;
  longPercentage: number | null;
  shortPercentage: number | null;
  isMainPoint: boolean;
  isFixed?: boolean;
  isCurrentPoint?: boolean;
}

/**
 * Props interface for the Customer component
 */
interface CustomerProps {
  contractAddress?: string;
}

/**
 * Utility function to fetch market details from a contract
 * @param contract - The ethers.js contract instance
 * @returns Object containing phase and oracle details
 */
export const fetchMarketDetails = async (contract: ethers.Contract) => {
  try {
    const phase = await contract.currentPhase();
    const oracleDetails = await contract.oracleDetails();

    return { phase, oracleDetails };
  } catch (error) {
    console.error("Error fetching market details:", error);
    throw error;
  }
};

/**
 * Helper function to get Ethereum provider and signer
 * @returns Object containing provider and signer
 */
const getProviderAndSigner = async () => {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();

  // Log network information for debugging
  const network = await provider.getNetwork();
  console.log("Connected to network:", network.name, network.chainId);

  return { provider, signer };
};

// Define the function at the top of your file
const createInitialPositionHistory = (biddingStartTime: number) => {
  // Logic to create initial position history
  return []; // Replace with actual logic
};

/**
 * Main Customer component
 * @param param0 - Component props including optional initial contract address
 */
function Customer({ contractAddress: initialContractAddress }: CustomerProps) {
  // Auth context and router
  const { isConnected, walletAddress, balance, connectWallet, refreshBalance } = useAuth();
  const router = useRouter();

  // Contract and market state
  const [selectedSide, setSelectedSide] = useState<Side | null>(null);
  const [contractBalance, setContractBalance] = useState(0);
  const [bidAmount, setBidAmount] = useState("");
  const [currentPhase, setCurrentPhase] = useState<Phase>(Phase.Trading);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [strikePrice, setStrikePrice] = useState<string>('');
  const [finalPrice, setFinalPrice] = useState<string>('');
  const [showClaimButton, setShowClaimButton] = useState(false);
  const [reward, setReward] = useState(0);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [positions, setPositions] = useState<{ long: number; short: number }>({ long: 0, short: 0 });
  const [contractAddress, setContractAddress] = useState(initialContractAddress || '');
  const [indexBg, setIndexBg] = useState(0);

  // Price and chart data
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartSymbol, setChartSymbol] = useState('BTCUSDT');
  const [tradingPair, setTradingPair] = useState('');

  // Market phase flags
  const [canResolve, setCanResolve] = useState(false);
  const [canExpire, setCanExpire] = useState(false);
  const [marketResult, setMarketResult] = useState<string>('');

  // User-related state
  const [userPosition, setUserPosition] = useState<Side | null>(null);
  const [userPositions, setUserPositions] = useState<{ long: number; short: number }>({ long: 0, short: 0 });
  const [isOwner, setIsOwner] = useState(false);

  // Time-related state
  const [biddingStartTime, setBiddingStartTime] = useState<number>(0);
  const [deployTime, setDeployTime] = useState<number>(0);
  const [maturityTime, setMaturityTime] = useState<number>(0);
  const [resolveTime, setResolveTime] = useState<number>(0);

  // Position history and data
  const [positionHistory, setPositionHistory] = useState<PositionPoint[]>([]);
  const positionHistoryKey = useMemo(() => {
    return `positionHistory_${contractAddress}`;
  }, [contractAddress]);
  const [positionData, setPositionData] = useState<PositionData[]>([]);
  const [enhancedPositionData, setEnhancedPositionData] = useState<PositionPoint[]>([]);

  // Oracle details
  const [oracleDetails, setOracleDetails] = useState<any>(null);

  // UI state
  const [isResolving, setIsResolving] = useState(false);
  const [isExpiring, setIsExpiring] = useState(false);
  const [priceTimeRange, setPriceTimeRange] = useState<string>('1w');
  const [positionTimeRange, setPositionTimeRange] = useState<string>('all');
  const [isResolvingMarket, setIsResolvingMarket] = useState<boolean>(false);
  const [isExpiringMarket, setIsExpiringMarket] = useState<boolean>(false);
  const [potentialProfit, setPotentialProfit] = useState<string>("0.0000");
  const [profitPercentage, setProfitPercentage] = useState<number>(0);
  const [feePercentage, setFeePercentage] = useState<string>('0');
  const [isLoadingContractData, setIsLoadingContractData] = useState<boolean>(true);
  const [isLoadingPositionHistory, setIsLoadingPositionHistory] = useState(true);
  const [contractOwner, setContractOwner] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

  // Toast
  const toast = useToast();
  // Query params
  const { data } = router.query;

  // Memoized parsed contract data
  const parsedContractData = useMemo(() => {
    if (!data) return null;
    try {
      return JSON.parse(data as string);
    } catch (err) {
      return null;
    }
  }, [data]);

  // Effect to update state with query params
  useEffect(() => {
    if (data) {
      const parsed = JSON.parse(data as string);
      setStrikePrice(parsed.strikePrice);
      setTradingPair(parsed.tradingPair);
      setCurrentPhase(parsed.phase);
      setMaturityTime(parsed.maturityTime);
      setPositions({
        long: parsed.longAmount,
        short: parsed.shortAmount,
      });

    }
  }, [router.query]);

  /**
 * Effect to load contract data from localStorage when component mounts
 * Takes advantage of preloaded data to render UI immediately
 */
  useEffect(() => {
    const cachedData = localStorage.getItem('contractData');
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        const timestamp = parsedData.timestamp || 0;
        const now = Date.now();

        // Use cache data if it was saved recently (within 5 minutes)
        if (now - timestamp < 5 * 60 * 1000) {
          console.log("Using enhanced cached contract data");

          // Update all required state variables from cache
          if (parsedData.tradingPair) {
            setTradingPair(parsedData.tradingPair);
            setChartSymbol(parsedData.chartSymbol || getChartSymbolFromTradingPair(parsedData.tradingPair));
          }

          // Use pre-formatted strike price if available
          if (parsedData.formattedStrikePrice) {
            setStrikePrice(parsedData.formattedStrikePrice);
          } else {
            setStrikePrice(
              parsedData.strikePrice ?
                (parseInt(parsedData.strikePrice.toString()) / 10 ** 8).toFixed(4) :
                '0'
            );
          }

          // Set phase information
          setCurrentPhase(parseInt(parsedData.phase));
          setMaturityTime(parseInt(parsedData.maturityTime));

          // Set time-related data
          if (parsedData.deployTime) setDeployTime(parseInt(parsedData.deployTime));
          if (parsedData.biddingStartTime) setBiddingStartTime(parseInt(parsedData.biddingStartTime));
          if (parsedData.resolveTime) setResolveTime(parseInt(parsedData.resolveTime));

          // Set position data
          if (parsedData.positionData) {
            setPositions(parsedData.positionData);
          } else if (parsedData.longAmount && parsedData.shortAmount) {
            setPositions({
              long: parseFloat(parsedData.longAmount),
              short: parseFloat(parsedData.shortAmount)
            });
          }

          // Add initial position history point if available
          if (parsedData.positionPercentages) {
            setPositionHistory([{
              timestamp: Math.floor(timestamp / 1000),
              longPercentage: parsedData.positionPercentages.long,
              shortPercentage: parsedData.positionPercentages.short,
              isMainPoint: true
            }]);
          }

          // Mark as loaded initial data
          setIsLoadingContractData(false);
        }
      } catch (error) {
        console.error("Error parsing cached contract data:", error);
      }
    }
  }, []);
  /**
 * Effect to initialize contract address from props or localStorage
 */
  useEffect(() => {
    if (initialContractAddress) {
      setContractAddress(initialContractAddress);
    }
    else {
      const savedAddress = localStorage.getItem('selectedContractAddress');
      if (savedAddress) {
        setContractAddress(savedAddress);
      }
    }
  }, [initialContractAddress]);

  /**
   * Effect to clean up localStorage when component unmounts
   */
  useEffect(() => {
    return () => {
      localStorage.removeItem('selectedContractAddress');
    };
  }, []);

  /**
 * Effect to initialize contract when wallet is connected and address is available
 */
  useEffect(() => {
    const initContract = async () => {
      if (isConnected && contractAddress) {
        try {
          const { signer } = await getProviderAndSigner();
          const newContract = new ethers.Contract(
            contractAddress,
            BinaryOptionMarket.abi,
            signer
          );
          setContract(newContract);
          await fetchMarketDetails();
        } catch (error) {
          console.error("Error initializing contract:", error);
        }
      }
    };
    initContract();
  }, [isConnected, contractAddress]);

  /**
   * Effect to fetch market details periodically
   */
  useEffect(() => {
    const interval = setInterval(() => {
      if (contract) {
        fetchMarketDetails();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [contract]);

  /**
   * Effect to fetch contract balance when contract address changes
   */
  useEffect(() => {
    if (contractAddress) {
      fetchContractBalance();
    }
  }, [contractAddress]);

  /**
   * Effect to load position history when contract address changes
   */
  useEffect(() => {
    if (contractAddress) {
      // Load position history from localStorage
      const savedHistory = localStorage.getItem(positionHistoryKey);
      if (savedHistory) {
        setPositionHistory(JSON.parse(savedHistory));
      } else {
        // Initialize new history if not available
        setPositionHistory([{
          timestamp: Date.now(),
          longPercentage: 50,
          shortPercentage: 50,
          isMainPoint: true,
          isFixed: true
        }]);
      }
    }
  }, [contractAddress]);

  const formatTradingPairForApi = (pair: string): string => {
    return pair.replace('/', '-');
  };

  /**
   * Function to fetch market details and update state
   */
  const fetchMarketDetails = async () => {
    if (!contract || !walletAddress) return;

    // Check if we have recent cached data
    const cachedData = localStorage.getItem('contractData');
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        const timestamp = parsedData.timestamp || 0;
        const now = Date.now();

        // If we have very recent data (within 30 seconds), prioritize user-specific data only
        if (now - timestamp < 30 * 1000 && parsedData.isPreloaded) {
          console.log("Using very recent cached data, only fetching user-specific data");

          // Only fetch user-specific data
          const [longPosition, shortPosition] = await Promise.all([
            contract.longBids(walletAddress),
            contract.shortBids(walletAddress)
          ]);

          // Update user positions from mappings
          setUserPositions({
            long: parseFloat(ethers.utils.formatEther(longPosition)),
            short: parseFloat(ethers.utils.formatEther(shortPosition))
          });

          // Update userPosition based on current position
          if (parseFloat(ethers.utils.formatEther(longPosition)) > 0) {
            setUserPosition(Side.Long);
          } else if (parseFloat(ethers.utils.formatEther(shortPosition)) > 0) {
            setUserPosition(Side.Short);
          } else {
            setUserPosition(null);
          }

          // Also fetch contract balance which can change frequently
          await fetchContractBalance();
          return;
        }
      } catch (error) {
        console.error("Error checking recent cached data:", error);
      }
    }

    // If no recent cache or error occurred, fetch everything as normal
    try {
      const [
        positions,
        phase,
        deployTime,
        maturityTime,
        oracleDetails,
        totalDeposited,
        biddingStartTime,
        resolveTime,
        longPosition,
        shortPosition,
        feePercentage,
        tradingPair
      ] = await Promise.all([
        contract.positions(),
        contract.currentPhase(),
        contract.deployTime(),
        contract.maturityTime(),
        contract.oracleDetails(),
        contract.totalDeposited(),
        contract.biddingStartTime(),
        contract.resolveTime(),
        contract.longBids(walletAddress),
        contract.shortBids(walletAddress),
        contract.feePercentage(),
        contract.tradingPair()
      ]);

      // Map the price feed address to trading pair
      //const tradingPair = contract.tradingPair();

      // Save trading pair to state
      setTradingPair(tradingPair);
      setCurrentPhase(phase);

      // Format trading pair for API and save to chartSymbol
      const formattedSymbol = getChartSymbolFromTradingPair(tradingPair);
      setChartSymbol(formattedSymbol);

      // Update total positions
      setPositions({
        long: parseFloat(ethers.utils.formatEther(positions.long)),
        short: parseFloat(ethers.utils.formatEther(positions.short))
      });

      // Update user positions from mappings
      setUserPositions({
        long: parseFloat(ethers.utils.formatEther(longPosition)),
        short: parseFloat(ethers.utils.formatEther(shortPosition))
      });

      // Update userPosition based on current position
      if (parseFloat(ethers.utils.formatEther(longPosition)) > 0) {
        setUserPosition(Side.Long);
      } else if (parseFloat(ethers.utils.formatEther(shortPosition)) > 0) {
        setUserPosition(Side.Short);
      } else {
        setUserPosition(null);
      }

      // Update strikePrice - convert from integer (stored in blockchain) to float
      //const oracleDetails = await contract.oracleDetails();
      const strikePriceRaw = oracleDetails.strikePrice;
      const strikePriceFormatted = (parseInt(strikePriceRaw.toString()) / 10 ** 8).toFixed(4);
      setStrikePrice(strikePriceFormatted);

      setMaturityTime(maturityTime.toNumber());
      setOracleDetails(oracleDetails);
      setTotalDeposited(parseFloat(ethers.utils.formatEther(totalDeposited)));
      setDeployTime(deployTime.toNumber());
      setBiddingStartTime(Number(biddingStartTime));
      setResolveTime(Number(resolveTime));
      setFeePercentage(feePercentage.toString());
      setIndexBg(indexBg);
      // Check if can resolve and expire
      const now = Math.floor(Date.now() / 1000);
      setCanResolve(phase === Phase.Bidding && now >= maturityTime.toNumber());
      setCanExpire(
        phase === Phase.Maturity &&
        resolveTime.toNumber() > 0 &&
        now >= resolveTime.toNumber() + 30
      );

      // Get finalPrice from oracleDetails when at phase Maturity or Expiry
      if (phase === Phase.Maturity || phase === Phase.Expiry) {
        const finalPriceFormatted = (parseInt(oracleDetails.finalPrice.toString()) / 10 ** 8).toFixed(4);
        setFinalPrice(finalPriceFormatted);
      }

      const updatedContractData = {
        address: contractAddress,
        timestamp: Date.now(),
        tradingPair,
        chartSymbol: getChartSymbolFromTradingPair(tradingPair),
        phase: phase.toString(),
        formattedStrikePrice: strikePriceFormatted,
        strikePrice: oracleDetails.strikePrice.toString(),
        maturityTime: maturityTime.toString(),
        deployTime: deployTime.toString(),
        biddingStartTime: biddingStartTime.toString(),
        resolveTime: resolveTime.toString(),
        longAmount: ethers.utils.formatEther(positions.long),
        shortAmount: ethers.utils.formatEther(positions.short),
        positionData: {
          long: parseFloat(ethers.utils.formatEther(positions.long)),
          short: parseFloat(ethers.utils.formatEther(positions.short))
        },
        positionPercentages: {
          long: positions.long.gt(0) || positions.short.gt(0) ?
            (parseFloat(ethers.utils.formatEther(positions.long)) /
              (parseFloat(ethers.utils.formatEther(positions.long)) +
                parseFloat(ethers.utils.formatEther(positions.short)))) * 100 : 50,
          short: positions.long.gt(0) || positions.short.gt(0) ?
            (parseFloat(ethers.utils.formatEther(positions.short)) /
              (parseFloat(ethers.utils.formatEther(positions.long)) +
                parseFloat(ethers.utils.formatEther(positions.short)))) * 100 : 50
        },
        totalDeposited: ethers.utils.formatEther(totalDeposited),
        isPreloaded: true
      };

      localStorage.setItem('contractData', JSON.stringify(updatedContractData));

    } catch (error) {
      console.error("Error fetching market details:", error);
    }
  };

  /**
   * Function to fetch contract balance
   */
  const fetchContractBalance = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contractBalanceWei = await provider.getBalance(contractAddress);
      const contractBalanceEth = parseFloat(ethers.utils.formatEther(contractBalanceWei));
      setContractBalance(contractBalanceEth); // Update state
    } catch (error) {
      console.error("Failed to fetch contract balance:", error);
    }
  };

  /**
   * Function to check market result
   */
  const checkMarketResult = async () => {
    if (!contract) return;

    try {
      const oracleDetails = await contract.oracleDetails();
      const finalPrice = parseFloat(oracleDetails.finalPrice);
      const strikePrice = parseFloat(oracleDetails.strikePrice);

      setMarketResult(determineMarketResult(finalPrice, strikePrice));

      if (finalPrice < strikePrice) {
        setMarketResult('SHORT');
      } else {
        setMarketResult('LONG');
      }
    } catch (error) {
      console.error("Error checking market result:", error);
    }
  };

  /**
   * Effect to check market result when phase changes
   */
  useEffect(() => {
    if (currentPhase === Phase.Maturity || currentPhase === Phase.Expiry) {
      checkMarketResult();
    } else {
      setMarketResult('');
    }
  }, [currentPhase, contract]);

  /**
   * Effect to check timing when phase changes
   */
  useEffect(() => {
    const checkTiming = async () => {
      if (!contract) return;

      try {
        const biddingStartTime = await contract.biddingStartTime();
        const resolveTime = await contract.resolveTime();
        const maturityTime = await contract.maturityTime();

        const now = Math.floor(Date.now() / 1000);

        // Có thể resolve khi đã đến maturityTime
        setCanResolve(currentPhase === Phase.Bidding && now >= maturityTime.toNumber());

        // Có thể expire sau 30 giây kể từ khi resolve
        setCanExpire(
          currentPhase === Phase.Maturity &&
          resolveTime.toNumber() > 0 &&
          now >= resolveTime.toNumber() + 30 // 30 seconds delay hardcoded in contract
        );

      } catch (error) {
        console.error("Error checking timing:", error);
      }
    };

    const interval = setInterval(checkTiming, 1000);
    return () => clearInterval(interval);
  }, [contract, currentPhase]);


  /**
   * Function to create time points
   */
  const createTimePoints = (startTime: number, endTime: number, numPoints: number = 20) => {
    const points: PositionData[] = [];
    const interval = Math.floor((endTime - startTime) / (numPoints - 1));
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i < numPoints; i++) {
      const timestamp = startTime + (interval * i);
      points.push({
        timestamp,
        longPercentage: 50,
        shortPercentage: 50,
        isVisible: timestamp <= now
      });
    }
    return points;
  };

  /**
   * Effect to handle position data in component
   */
  useEffect(() => {
    if (!contract || currentPhase !== Phase.Bidding) return;

    // Initialize position data
    const initializePositionData = async () => {
      const biddingStartTime = await contract.biddingStartTime();
      const maturityTime = await contract.maturityTime();
      const timePoints = createTimePoints(
        biddingStartTime.toNumber(),
        maturityTime.toNumber()
      );
      setPositionData(timePoints);
    };

    // Effect to update position data
    const updatePositionData = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const longAmount = positions.long;
        const shortAmount = positions.short;
        const total = longAmount + shortAmount;

        if (total > 0) {
          const longPercentage = (longAmount / total) * 100;
          const shortPercentage = (shortAmount / total) * 100;

          setPositionData(prevData => {
            return prevData.map(point => {
              if (point.timestamp <= now) {
                const timeProgress = (point.timestamp - prevData[0].timestamp) /
                  (now - prevData[0].timestamp);
                return {
                  ...point,
                  longPercentage: 50 + (longPercentage - 50) * timeProgress,
                  shortPercentage: 50 + (shortPercentage - 50) * timeProgress,
                  isVisible: true
                };
              }
              return {
                ...point,
                isVisible: false
              };
            });
          });
        }
      } catch (error) {
        console.error("Error updating position data:", error);
      }
    };

    // Initialize initial data
    initializePositionData();

    // Update data every second
    const interval = setInterval(updatePositionData, 1000);
    return () => clearInterval(interval);
  }, [contract, currentPhase, positions]);


  // Function to calculate potential profit - improved to handle empty bidAmount
  const calculatePotentialProfit = useCallback((side: Side, amount: string) => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0 || !positions) {
      setPotentialProfit("0.0000");
      setProfitPercentage(0);
      return;
    }

    // Convert bid amount to ETH
    const bidAmountInEth = parseFloat(amount);
    let potentialReturn = 0;
    let profitPercentage = 0;

    // Total current bid amount
    const longAmount = positions.long;
    const shortAmount = positions.short;
    const totalBids = longAmount + shortAmount;

    // Apply fee
    const feeAmount = bidAmountInEth * (Number(feePercentage) / 1000);
    const bidAmountAfterFee = bidAmountInEth - feeAmount;

    if (side === Side.Long) {
      // If choose LONG
      const newLongAmount = longAmount + bidAmountInEth;

      if (shortAmount === 0) {
        // If no one bid SHORT, only get back bid amount after fee
        potentialReturn = bidAmountAfterFee;
        profitPercentage = -1 * (Number(feePercentage) / 10); // Only lose fee
      } else {
        // Calculate profit percentage based on LONG/SHORT ratio
        const totalPool = totalBids + bidAmountInEth;
        const poolAfterFee = totalPool - feeAmount;

        // Win ratio based on SHORT amount
        const winRatio = shortAmount / newLongAmount;
        potentialReturn = bidAmountInEth + (bidAmountAfterFee * winRatio);
        profitPercentage = ((potentialReturn - bidAmountInEth) / bidAmountInEth) * 100;
      }
    } else {
      // If choose SHORT
      const newShortAmount = shortAmount + bidAmountInEth;

      if (longAmount === 0) {
        // If no one bid LONG, only get back bid amount after fee
        potentialReturn = bidAmountAfterFee;
        profitPercentage = -1 * (Number(feePercentage) / 10); // Only lose fee
      } else {
        // Calculate profit percentage based on LONG/SHORT ratio
        const totalPool = totalBids + bidAmountInEth;
        const poolAfterFee = totalPool - feeAmount;

        // Win ratio based on LONG amount
        const winRatio = longAmount / newShortAmount;
        potentialReturn = bidAmountInEth + (bidAmountAfterFee * winRatio);
        profitPercentage = ((potentialReturn - bidAmountInEth) / bidAmountInEth) * 100;
      }
    }

    // Update potential profit and profit percentage
    setPotentialProfit(potentialReturn.toFixed(8));
    setProfitPercentage(profitPercentage);
  }, [positions, feePercentage]);

  // Function to handle side selection (UP/DOWN)
  const handleSelectSide = (side: Side) => {
    setSelectedSide(side);
    calculatePotentialProfit(side, bidAmount);
  };

  // Effect to handle bid amount change
  useEffect(() => {
    if (selectedSide !== null && bidAmount) {
      calculatePotentialProfit(selectedSide, bidAmount);
    }
  }, [bidAmount, selectedSide, calculatePotentialProfit]);

  // Improved handleBid function to use selectedSide
  const handleBid = async (side?: Side) => {
    const bidSide = side !== undefined ? side : selectedSide;

    if (bidSide === null) {
      toast({
        title: "Error",
        description: "Please select UP or DOWN first",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Check bidAmount
    if (!bidAmount || isNaN(parseFloat(bidAmount)) || parseFloat(bidAmount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!contract || !bidAmount || parseFloat(bidAmount) <= 0) return;

    try {
      const { provider } = await getProviderAndSigner();
      const network = await provider.getNetwork();

      // Fix options type to allow gasLimit property
      const options: { value: ethers.BigNumber; gasLimit?: any } = {
        value: ethers.utils.parseEther(bidAmount)
      };

      if (network.chainId === 1) {
        // Mainnet
        options.gasLimit = ethers.utils.hexlify(300000);
      } else if (network.chainId === 11155111) {
        // Sepolia
        options.gasLimit = ethers.utils.hexlify(300000);
      }

      const side = bidSide === Side.Long ? 0 : 1;
      const tx = await contract.bid(side, options);

      setIsResolving(true);
      await tx.wait();
      setIsResolving(false);

      // Refresh data
      resetBettingForm();
      fetchMarketDetails();

      toast({
        title: "Bid Placed Successfully",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error placing bid:", error);
      setIsResolving(false);

      toast({
        title: "Error Placing Bid",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Function to check if user can claim reward
  const canClaimReward = useCallback(async () => {
    if (!contract || currentPhase !== Phase.Expiry) return;

    try {


      // Check if already claimed
      const hasClaimed = await contract.hasClaimed(walletAddress);
      console.log("Has claimed:", hasClaimed);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      const tx = await contractWithSigner.claimReward();
      await tx.wait();

      await Promise.all([
        fetchMarketDetails(),
        fetchContractBalance(),
        canClaimReward(), 
      ]);

      // Get oracle details
      const oracleDetails = await contract.oracleDetails();
      const finalPrice = parseFloat(oracleDetails.finalPrice);
      const strikePrice = parseFloat(oracleDetails.strikePrice);
      console.log("Prices:", { finalPrice, strikePrice });

      // Improved logic: finalPrice < strikePrice then SHORT win
      const winningSide = finalPrice < strikePrice ? Side.Short : Side.Long;
      console.log("Winning side:", winningSide);

      // Check user's deposit
      const userDeposit = winningSide === Side.Long ?
        await contract.longBids(walletAddress) :
        await contract.shortBids(walletAddress);
      console.log("User deposit:", userDeposit.toString());

      // Show claim button if:
      // 1. Not claimed yet
      // 2. Has deposit on winning side
      // 3. Currently in Expiry phase
      if (!hasClaimed && userDeposit.gt(0) && currentPhase === Phase.Expiry) {
        setShowClaimButton(true);

        // Calculate reward
        const positions = await contract.positions();
        const totalWinningDeposits = winningSide === Side.Long ? positions.long : positions.short;
        const totalDeposited = positions.long.add(positions.short);

        const reward = userDeposit.mul(totalDeposited).div(totalWinningDeposits);
        const fee = (reward * Number(feePercentage)) / 100;
        const finalReward = reward.sub(fee);

        setReward(parseFloat(ethers.utils.formatEther(finalReward)));
      } else {
        setShowClaimButton(false);
      }

    } catch (error) {
      console.error("Error checking claim eligibility:", error);
      setShowClaimButton(false);
    }
  }, [contract, currentPhase, walletAddress]);

  // Effect to check claim eligibility
  useEffect(() => {
    if (currentPhase === Phase.Expiry) {
      canClaimReward();
    }
  }, [currentPhase, canClaimReward]);

  // Function to start bidding
  const startBidding = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddress, BinaryOptionMarket.abi, signer);

      const tx = await contract.startBidding();
      await tx.wait();

      // Update phase after transaction success
      await fetchMarketDetails();

      // Update UI immediately
      setCurrentPhase(Phase.Bidding);

      toast({
        title: "Bidding phase started!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error("Failed to start bidding:", error);
      toast({
        title: "Failed to start bidding",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Effect to update the price chart
  useEffect(() => {
    const priceService = PriceService.getInstance();

    const handlePriceUpdate = (priceData: PriceData) => {
      setCurrentPrice(priceData.price);
    };

    // Subscribe to price updates when component mounts
    priceService.subscribeToPriceUpdates(handlePriceUpdate, chartSymbol, 5000);

    // Cleanup subscription when component unmounts
    return () => {
      priceService.unsubscribeFromPriceUpdates(handlePriceUpdate);
    };
  }, []);

  // Effect to update the price chart
  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
        if (!chartSymbol || chartSymbol === 'Unknown') {
          console.log('Invalid chart symbol, cannot fetch price history');
          return;
        }

        console.log('Fetching price history for symbol:', chartSymbol);
        const priceService = PriceService.getInstance();
        const klines = await priceService.fetchKlines(chartSymbol, '1m', 100);
        setChartData(klines);
      } catch (error) {
        console.error("Error fetching price history:", error);
      }
    };

    fetchPriceHistory();
    const interval = setInterval(fetchPriceHistory, 60000);
    return () => clearInterval(interval);
  }, [chartSymbol]);

  // Function to expire market
  const handleExpireMarket = async () => {
    if (!contract) return;
    try {
      console.log("Attempting to expire market...");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      // Show processing message
      toast({
        title: "Expiring market...",
        description: "Please wait while the transaction is being processed",
        status: "info",
        duration: 5000,
        isClosable: true,
      });

      const tx = await contractWithSigner.expireMarket({
        gasLimit: 500000
      });

      console.log("Transaction sent:", tx.hash);

      // Show transaction sent message
      toast({
        title: "Transaction sent",
        description: `Transaction hash: ${tx.hash.substring(0, 10)}...`,
        status: "info",
        duration: 5000,
        isClosable: true,
      });

      await tx.wait();

      // Show success message
      toast({
        title: "Market expired successfully!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Refresh market details
      await fetchMarketDetails();

      // Update UI immediately
      setCurrentPhase(Phase.Expiry);
      setCanExpire(false);

      return true;
    } catch (error: any) {
      console.error("Error expiring market:", error);
      toast({
        title: "Failed to expire market",
        description: error.message || "An unexpected error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return false;
    }
  };

  // Effect to load contract data
  useEffect(() => {
    const loadContractData = async () => {
      try {
        const contractAddress = localStorage.getItem('selectedContractAddress');
        if (!contractAddress) return;

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(
          contractAddress,
          BinaryOptionMarket.abi,
          provider
        );

        // Get all necessary data from contract
        try {
          const [
            positions,
            strikePriceBN,
            phase,
            biddingStartTime,
            maturityTime,
            //oracleDetails,
            totalDeposited,
            feePercentage,
            dataFeedAddress,
            indexBg
          ] = await Promise.all([
            contract.positions(),
            contract.currentPhase(),
            contract.biddingStartTime(),
            contract.maturityTime(),
            contract.oracleDetails(),
            contract.totalDeposited(),
            contract.feePercentage(),
            contract.dataFeed(),
            contract.indexBg()
          ]);

          // Update states
          setContract(contract);
          setContractAddress(contractAddress);
          // Get strikePrice
          const oracleDetails = await contract.oracleDetails();
          const strikePriceRaw = oracleDetails.strikePrice;
          const strikePriceFormatted = (parseInt(strikePriceRaw.toString()) / 10 ** 8).toFixed(2);
          setStrikePrice(strikePriceFormatted);
          setCurrentPhase(phase);
          setMaturityTime(maturityTime.toNumber());
          setOracleDetails(oracleDetails);
          setTotalDeposited(parseFloat(ethers.utils.formatEther(totalDeposited)));
          setFeePercentage(feePercentage.toString());
          setIndexBg(indexBg);
          // Map the price feed address to trading pair
          const tradingPair = getTradingPairFromPriceFeed(dataFeedAddress);

          // Save trading pair to state
          setTradingPair(tradingPair);

          // Format trading pair for API and save to chartSymbol
          const formattedSymbol = getChartSymbolFromTradingPair(tradingPair);
          setChartSymbol(formattedSymbol);

          // Update positions
          setPositions({
            long: parseFloat(ethers.utils.formatEther(positions.long)),
            short: parseFloat(ethers.utils.formatEther(positions.short))
          });

        } catch (error) {
          console.error("Error loading contract data:", error);
          // Set default values if there's an error
          setTradingPair('Unknown');
          //setChartSymbol('BTCUSDT');
        }

      } catch (error) {
        console.error("Error:", error);
      }
    };

  }, []);

  // Function to resolve market
  const resolve = async () => {
    if (!contract) return;

    try {
      console.log("Attempting to resolve market...");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      // Show processing message
      toast({
        title: "Resolving market...",
        description: "Please wait while the transaction is being processed",
        status: "info",
        duration: 5000,
        isClosable: true,
      });

      const tx = await contractWithSigner.resolveMarket({
        gasLimit: 500000
      });

      console.log("Transaction sent:", tx.hash);

      // Show transaction sent message
      toast({
        title: "Transaction sent",
        description: `Transaction hash: ${tx.hash.substring(0, 10)}...`,
        status: "info",
        duration: 5000,
        isClosable: true,
      });

      await tx.wait();

      // Show success message
      toast({
        title: "Market resolved successfully!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Refresh market details
      await fetchMarketDetails();

      // Update UI immediately
      setCurrentPhase(Phase.Maturity);
      setCanResolve(false);

      return true;
    } catch (error: any) {
      console.error("Error resolving market:", error);
      toast({
        title: "Failed to resolve market",
        description: error.message || "An unexpected error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return false;
    }
  };

  // Function to claim reward for customer
  const claimReward = async () => {
    if (!contract || currentPhase !== Phase.Expiry) return;

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      const tx = await contractWithSigner.claimReward();
      await tx.wait();

      // Update states after successful claim
      await Promise.all([
        fetchMarketDetails(),
        fetchContractBalance()
      ]);

      await refreshBalance();
      setShowClaimButton(false);
      setReward(0);

      toast({
        title: "Success",
        description: "Successfully claimed reward!",
        status: "success",
        duration: 3000,
      });

    } catch (error) {
      console.error("Error claiming reward:", error);
      toast({
        title: "Error claiming reward",
        description: error.message,
        status: "error",
        duration: 3000,
      });
    }
  };

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState(0);
  // Function to withdraw funds
  const handleWithdraw = async () => {
    if (!contract || !isOwner) return;

    try {
      setIsWithdrawing(true);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      // Fetch totalDeposited & feePercentage
      const [longAmount, shortAmount, fee] = await Promise.all([
        contract.positions().then(p => p.long),
        contract.positions().then(p => p.short),
        contract.feePercentage()
      ]);

      const totalDeposited = longAmount.add(shortAmount);
      const feeAmount = totalDeposited.mul(fee).div(1000); // fee unit = tenth of percent

      const feeAmountEth = parseFloat(ethers.utils.formatEther(feeAmount));
      setWithdrawalAmount(feeAmountEth);

      toast({
        title: "Processing withdrawal",
        description: `Withdrawing ${feeAmountEth.toFixed(4)} ETH to your wallet`,
        status: "info",
        duration: 2000,
        isClosable: true,
      });

      const tx = await contractWithSigner.withdraw();
      await tx.wait();

      toast({
        title: "Withdraw successful",
        description: `${feeAmountEth.toFixed(4)} ETH has been withdrawn`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });

      await fetchContractBalance();
      await refreshBalance();
    } catch (error) {
      console.error("Error withdrawing funds:", error);
      toast({
        title: "Withdraw failed",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsWithdrawing(false);
    }
  };



  // Improved fetchPositionHistory
  const fetchPositionHistory = useCallback(async () => {
    if (!contract) return [];

    setIsLoadingPositionHistory(true);

    try {
      // Get current block
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const currentBlock = await provider.getBlockNumber();

      // Get all PositionUpdated events from block 0 to current block
      const events = await contract.queryFilter(
        contract.filters.PositionUpdated(),
        0,
        currentBlock
      );

      // Sort events by time
      const sortedEvents = events.sort((a, b) =>
        a.args.timestamp.toNumber() - b.args.timestamp.toNumber()
      );

      // Convert to format for chart
      const positionPoints = sortedEvents.map(event => {
        const timestamp = event.args.timestamp.toNumber();
        const longAmount = parseFloat(ethers.utils.formatEther(event.args.longAmount));
        const shortAmount = parseFloat(ethers.utils.formatEther(event.args.shortAmount));
        const total = longAmount + shortAmount;

        let longPercentage = 50;
        let shortPercentage = 50;

        if (total > 0) {
          longPercentage = (longAmount / total) * 100;
          shortPercentage = (shortAmount / total) * 100;
        }

        return {
          timestamp,
          longPercentage,
          shortPercentage,
          isMainPoint: true,
          isFixed: false
        };
      });

      // Add initial point if needed
      if (positionPoints.length === 0 && biddingStartTime) {
        positionPoints.push({
          timestamp: biddingStartTime,
          longPercentage: 50,
          shortPercentage: 50,
          isMainPoint: true,
          isFixed: true
        });
      }

      setIsLoadingPositionHistory(false);
      return positionPoints;
    } catch (error) {
      console.error("Error fetching position history:", error);
      setIsLoadingPositionHistory(false);
      return [];
    }
  }, [contract, biddingStartTime]);

  // Improved useEffect to get position history from on-chain
  useEffect(() => {
    if (contract && currentPhase >= Phase.Bidding) {
      fetchPositionHistory().then(history => {
        if (history.length > 0) {
          setPositionHistory(history);
        } else if (biddingStartTime) {
          // Fallback if no data
          setPositionHistory(createInitialPositionHistory(biddingStartTime));
        }
      });
    }
  }, [contract, currentPhase, biddingStartTime, fetchPositionHistory, positions]);

  // Effect to add event listener for PositionUpdated events realtime
  useEffect(() => {
    if (!contract || currentPhase < Phase.Bidding) return;

    const handlePositionUpdate = (timestamp, longAmount, shortAmount) => {
      const ts = timestamp.toNumber();
      const longAmt = parseFloat(ethers.utils.formatEther(longAmount));
      const shortAmt = parseFloat(ethers.utils.formatEther(shortAmount));
      const total = longAmt + shortAmt;

      let longPercentage = 50;
      let shortPercentage = 50;

      if (total > 0) {
        longPercentage = (longAmt / total) * 100;
        shortPercentage = (shortAmt / total) * 100;
      }

      // Update positionHistory with new point
      setPositionHistory(prev => {
        // Update isCurrentPoint for all points
        const updatedHistory = prev.map(point => ({
          ...point,
          isCurrentPoint: false
        }));

        // Add new point
        const newPoint = {
          timestamp: ts,
          longPercentage,
          shortPercentage,
          isMainPoint: true,
          isFixed: false,
          isCurrentPoint: true
        };

        return [...updatedHistory, newPoint];
      });

      // Update positions state
      setPositions({
        long: longAmt,
        short: shortAmt
      });
    };

    // Register event listener
    contract.on("PositionUpdated", handlePositionUpdate);

    // Cleanup when component unmounts
    return () => {
      contract.off("PositionUpdated", handlePositionUpdate);
    };
  }, [contract, currentPhase]);


  // Function to check permissions 
  const checkPermissions = async () => {
    if (!contract || !walletAddress) return;

    try {
      // check if contract has owner() function
      let owner;
      try {
        owner = await contract.owner();
        setIsOwner(owner.toLowerCase() === walletAddress.toLowerCase());
        console.log("Contract owner:", owner);
        console.log("Current wallet:", walletAddress);
        console.log("Is owner:", owner.toLowerCase() === walletAddress.toLowerCase());
      } catch (e) {
        console.log("Contract does not have owner() function or error occurred:", e);
      }

      // check if can call resolveMarket function
      try {
        // check if function exists, not actually call it
        const resolveFunction = contract.resolveMarket;
        console.log("resolveMarket function exists:", !!resolveFunction);
      } catch (e) {
        console.log("Error checking resolveMarket function:", e);
      }

      // check if can call expireMarket function
      try {
        // check if function exists, not actually call it
        const expireFunction = contract.expireMarket;
        console.log("expireMarket function exists:", !!expireFunction);
      } catch (e) {
        console.log("Error checking expireMarket function:", e);
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  // check permission when component mount
  useEffect(() => {
    if (contract && walletAddress) {
      checkPermissions();
    }
  }, [contract, walletAddress]);

  const isMarketEnded = (maturityTime: any, phase: string): boolean => {
    const currentTime = new Date();
    const maturityDate = new Date(maturityTime * 1000);
    return currentTime.getTime() >= maturityDate.getTime();
  };


  // replace logic check phase based on time
  useEffect(() => {
    // check and update phase based on current time
    const checkPhaseBasedOnTime = () => {
      const now = getCurrentTimestamp();

      if (currentPhase === Phase.Bidding && now >= maturityTime) {
        setCanResolve(true);
      }

      if (currentPhase === Phase.Maturity && resolveTime > 0 && now >= resolveTime + 30) {
        setCanExpire(true);
      }
    };

    checkPhaseBasedOnTime();
    const interval = setInterval(checkPhaseBasedOnTime, 1000);
    return () => clearInterval(interval);
  }, [currentPhase, maturityTime, resolveTime]);

  // Calculate long percentages
  const longPercentage = useMemo(() => {
    const total = positions.long + positions.short;
    return total > 0 ? (positions.long / total) * 100 : 50;
  }, [positions]);

  // Calculate short percentage
  const shortPercentage = useMemo(() => {
    const total = positions.long + positions.short;
    return total > 0 ? (positions.short / total) * 100 : 50;
  }, [positions]);


  const formatMaturityTime = (timestamp: number): string => {
    if (!timestamp) return 'Pending';
    return format(new Date(timestamp * 1000), 'MMM dd, yyyy HH:mm');
  };

  // Handle time range changes
  const handleTimeRangeChange = (range: string, chartType: 'price' | 'position') => {
    if (chartType === 'price') {
      setPriceTimeRange(range);
    } else {
      setPositionTimeRange(range);
    }
  };
  // Handle resolve market
  const handleResolveMarket = async () => {
    if (!contract) return;

    try {
      setIsResolvingMarket(true);

      const result = await resolve();

      if (result) {
        toast({
          title: "Market resolved successfully",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error("Error resolving market:", error);
      toast({
        title: "Failed to resolve market",
        description: error.message || "An unexpected error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsResolvingMarket(false);
    }
  };

  // call calculatePotentialProfit when user input ETH
  const handleBidAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setBidAmount(value);

    // calculate potential profit
    const numValue = parseFloat(value);
    calculatePotentialProfit(selectedSide, value);
  };

  // load contract data from localStorage when component mount
  useEffect(() => {
    // check if contract data in localStorage
    const cachedData = localStorage.getItem('contractData');

    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        const timestamp = parsedData.timestamp || 0;
        const now = Date.now();

        // only use cache data if it was saved in the last 5 minutes
        if (now - timestamp < 5 * 60 * 1000) {
          console.log("Using cached contract data");

          // update trading pair and chart symbol
          if (parsedData.tradingPair) {
            setTradingPair(parsedData.tradingPair);
            const formattedSymbol = getChartSymbolFromTradingPair(parsedData.tradingPair);
            setChartSymbol(formattedSymbol);
          }

          // update state from cache data
          setStrikePrice(parsedData.strikePrice.toString());
          setMaturityTime(parseInt(parsedData.maturityTime));
          setCurrentPhase(parseInt(parsedData.phase));

          // update positions if have
          if (parsedData.longAmount && parsedData.shortAmount) {
            setPositions({
              long: parseFloat(parsedData.longAmount),
              short: parseFloat(parsedData.shortAmount)
            });
          }

          // mark as loaded initial data
          setIsLoadingContractData(false);
        }
      } catch (error) {
        console.error("Error parsing cached contract data:", error);
      }
    }
  }, []);

  // load contract data from blockchain
  useEffect(() => {
    const fetchContractData = async () => {
      if (!contract) return;

      try {
        // if have data from cache, mark as loading new data in background
        const isBackgroundUpdate = !isLoadingContractData;

        if (!isBackgroundUpdate) {
          setIsLoadingContractData(true);
        }

        // load all needed data in parallel
        const [
          strikePriceResult,
          maturityTimeResult,
          tradingPairResult,
          currentPhaseResult,
          biddingStartTimeResult,
          //feePercentageResult,
          positionsResult
        ] = await Promise.all([
          contract.oracleDetails(),
          contract.maturityTime(),
          contract.tradingPair(),
          contract.currentPhase(),
          contract.biddingStartTime(),
          contract.feePercentage(),
          contract.positions()
        ]);

        // process result
        const strikePrice = parseFloat(ethers.utils.formatEther(strikePriceResult));
        const maturityTime = maturityTimeResult.toNumber();
        const tradingPair = tradingPairResult;
        const currentPhase = currentPhaseResult;
        const biddingStartTime = biddingStartTimeResult.toNumber();
        const feePercentageResult = await contract.feePercentage();
        const feePercentage = feePercentageResult.toNumber();

        // update state
        setStrikePrice(strikePrice.toString());
        setMaturityTime(maturityTime);
        setTradingPair(tradingPair);
        setCurrentPhase(currentPhase);
        setBiddingStartTime(biddingStartTime);
        setFeePercentage(feePercentage);

        // update positions
        setPositions({
          long: parseFloat(ethers.utils.formatEther(positionsResult.long)),
          short: parseFloat(ethers.utils.formatEther(positionsResult.short))
        });

        // save new data to localStorage for future use
        localStorage.setItem('contractData', JSON.stringify({
          address: contract.address,
          strikePrice: strikePrice.toString(),
          maturityTime: maturityTime.toString(),
          tradingPair: tradingPair,
          phase: currentPhase.toString(),
          longAmount: ethers.utils.formatEther(positionsResult.long),
          shortAmount: ethers.utils.formatEther(positionsResult.short),
          owner: await contract.owner(),
          timestamp: Date.now()
        }));

      } catch (error) {
        // console.error("Error fetching contract data:", error);
        // toast({
        //   title: "Error loading contract data",
        //   description: error.message || "An unexpected error occurred",
        //   status: "error",
        //   duration: 5000,
        //   isClosable: true,
        // });
      } finally {
        setIsLoadingContractData(false);
      }
    };

    fetchContractData();
  }, [contract]);

  // Add this function to reset the betting form
  const resetBettingForm = () => {
    setSelectedSide(null);
    setBidAmount("");
    setPotentialProfit(0);
    setProfitPercentage(0);
  };

  // check owner
  const checkOwner = async () => {
    try {
      if (!contract) return;

      const ownerAddress = await contract.owner();
      setContractOwner(ownerAddress);

      // check if current wallet address is owner
      if (walletAddress) {
        setIsOwner(walletAddress.toLowerCase() === ownerAddress.toLowerCase());
      } else {
        setIsOwner(false);
      }
    } catch (error) {
      console.error("Error checking owner:", error);
      setIsOwner(false);
    }
  };

  // check owner when contract or walletAddress changes
  useEffect(() => {
    if (contract && walletAddress) {
      checkOwner();
    }
  }, [contract, walletAddress]);

  // get bg color for strike price
  const bgColors = ["#A56DFF", "#26D1E6", "#FEDF56", "#7EFEB2", "#FF6492"]; // same as used in ListAddressOwner
  const strikeColor = bgColors[indexBg % bgColors.length];


  return (
    <Box bg="black" minH="100vh">
      {/* Header Section */}
      <Flex px={6} py={4} alignItems="center">
        <Button
          leftIcon={<FaChevronLeft />}
          variant="ghost"
          color="gray.400"
          _hover={{
            color: "white",
          }}
          onClick={() => {
            // Clear contract-specific data from localStorage when returning to markets
            //localStorage.removeItem('contractData');

            const cachedContracts = localStorage.getItem('deployedContracts');
            if (cachedContracts) {
              try {
                const parsed = JSON.parse(cachedContracts);

                // Save current contract list to sessionStorage for passing
                sessionStorage.setItem('cachedDeployedContracts', JSON.stringify(parsed));

                // Redirect to page containing ListAddressOwner
                router.push('/listaddress/1');
              } catch (err) {
                console.error("Failed to parse deployed contracts cache:", err);
                router.push('/listaddress/1');
              }
            } else {
              router.push('/listaddress/1');
            }
          }}
        >
          Markets
        </Button>


        <HStack spacing={4} ml="auto">
          {/* Balance Box */}
          <Box
            p="2px"
            borderRadius="md"
            bg="transparent"
            sx={{
              backgroundImage: "linear-gradient(270deg, #ff0059, #5a73d8, #5858b5 , #77efef, #4a63c8)",
              backgroundSize: "400% 400%",
              animation: "gradient-border 8s ease infinite",
              borderRadius: "8px"
            }}
          >
            <HStack
              p={2}
              bg="#1A1C21"
              borderRadius="md"
              w="full"
            >
              <Text color="white" fontWeight="medium">
                {Number(balance).toFixed(4)} ETH
              </Text>
            </HStack>

            {/* Inject CSS animation */}
            <style jsx>{`
                  @keyframes gradient-border {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                  }
                `}
            </style>
          </Box>

          {/* Wallet Address Box */}
          <Box
            p="2px"
            borderRadius="lg"
            sx={{
              backgroundImage: "linear-gradient(270deg, #eaea72, #f49a24, #e25375, #f2f2bf, #f2f2cd)",
              backgroundSize: "400% 400%",
              animation: "gradient-border 6s ease infinite",
              display: "inline-block",
              backgroundColor: "transparent"
            }}
          >
            <Box
              display="flex"
              alignItems="center"
              bg="gray.800"
              borderRadius="lg"
              px={4}
              py={2}
              boxShadow="md"
              transition="all 0.2s"
              _hover={{ bg: "gray.700" }}
            >
              <Text color="white" fontWeight="semibold" fontSize="md">
                {walletAddress
                  ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`
                  : 'Not Connected'}
              </Text>
            </Box>

            <style jsx>{`
    @keyframes gradient-border {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `}</style>
          </Box>

        </HStack>

      </Flex>

      {/* Second line - Market Info */}
      <Box display="flex" alignItems="center" mb={6} ml={10}>
        <HStack>
          {/* Coin Image */}
          {isLoadingContractData ? (
            <Skeleton boxSize="50px" mr={4} />
          ) : (
            <Image
              src={`/images/${tradingPair.split('/')[0].toLowerCase()}-logo.png`}
              alt={tradingPair}
              boxSize="50px"
              mr={4}
            />
          )}

          <Box>
            <Heading size="md" fontSize="30px">
              <HStack>
                {isLoadingContractData ? (
                  <Skeleton height="30px" width="200px" />
                ) : (
                  <>
                    <Text color="#FEDF56" fontSize="30px">
                      {tradingPair}
                    </Text>
                    <Text color="white" fontSize="25px">
                      will reach <Text as="span" color={strikeColor}>${strikePrice}</Text> by {formatMaturityTime(maturityTime)}
                    </Text>

                  </>
                )}
              </HStack>
            </Heading>
            <HStack spacing={2}>
              {isLoadingContractData ? (
                <Skeleton height="20px" width="300px" />
              ) : (
                <>
                  <HStack color="gray.400">
                    <PiChartLineUpLight />
                    <Text color="gray.400" fontSize="sm">
                      {totalDeposited.toFixed(8)} ETH |
                    </Text>
                  </HStack>
                  <HStack color="gray.400">
                    <FaRegClock />
                    <Text color="gray.400" fontSize="sm">
                      {formatMaturityTime(maturityTime)} |
                    </Text>
                  </HStack>
                  <HStack color="gray.400">
                    <GrInProgress />
                    <Text color="gray.400" fontSize="sm">
                      Phase: {Phase[currentPhase]}
                    </Text>
                  </HStack>
                </>
              )}
            </HStack>
          </Box>
        </HStack>
      </Box>


      {/* Main Content */}
      <Flex direction={{ base: 'column', md: 'row' }} gap={6}>
        {/* Left Side - Charts and Rules */}
        <Box width={{ base: '100%', md: '80%' }} pr={{ base: 0, md: 4 }} ml={4} >
          <Tabs variant="line" colorScheme="yellow" border="1px solid" borderColor="gray.700" borderRadius="xl" pb={2} >
            <Box pb={1} >
              <TabList
                borderBottom="2px solid"
                borderColor="gray.600"
                px={6}
                py={3}
                display="grid"
                gridTemplateColumns="1fr 1fr"
                alignItems="center"
              >
                <Flex justify="center">
                  <Tab
                    fontWeight="bold"
                    fontSize="sm"
                    _selected={{
                      bg: "blue.600",
                      color: "white",
                      borderRadius: "md",
                      boxShadow: "md",
                    }}
                    _hover={{
                      bg: "gray.700",
                      color: "white",
                    }}
                    px={6}
                    py={2}
                    transition="all 0.2s"
                  >
                    Price Chart
                  </Tab>
                </Flex>

                <Flex justify="center">
                  <Tab
                    fontWeight="bold"
                    fontSize="sm"
                    _selected={{
                      bg: "green.500",
                      color: "white",
                      borderRadius: "md",
                      boxShadow: "md",
                    }}
                    _hover={{
                      bg: "gray.700",
                      color: "white",
                    }}
                    px={6}
                    py={2}
                    transition="all 0.2s"
                  >
                    Position Chart
                  </Tab>
                </Flex>
              </TabList>

            </Box>

            <TabPanels>
              <TabPanel p={0} pt={4}>
                <Box position="relative" width="100%">
                  <MarketCharts
                    chartData={chartData}
                    positionHistory={positionHistory}
                    positions={positions}
                    strikePrice={parseFloat(strikePrice)}
                    timeRange={priceTimeRange}
                    chartType="price"
                    onTimeRangeChange={handleTimeRangeChange}
                    chartSymbol={chartSymbol}
                    biddingStartTime={biddingStartTime}
                    maturityTime={maturityTime}
                    enhancedPositionData={enhancedPositionData}
                    setEnhancedPositionData={setEnhancedPositionData}

                  />
                </Box>
              </TabPanel>

              <TabPanel p={0} pt={4}>
                <Box position="relative" width="100%">
                  <MarketCharts
                    chartData={[]}
                    positionHistory={positionHistory}
                    positions={positions}
                    strikePrice={parseFloat(strikePrice)}
                    timeRange={positionTimeRange}
                    chartType="position"
                    onTimeRangeChange={handleTimeRangeChange}
                    chartSymbol={chartSymbol}
                    biddingStartTime={biddingStartTime}
                    maturityTime={maturityTime}
                    enhancedPositionData={enhancedPositionData}
                    setEnhancedPositionData={setEnhancedPositionData}
                  />
                </Box>
              </TabPanel>
            </TabPanels>
          </Tabs>

          <Box mt={8} border="1px solid #2D3748" borderRadius="xl" p={4}>
            <Flex justify="space-between" align="center" onClick={() => setShowRules(!showRules)} cursor="pointer">
              <Heading size="md" color="#F0F8FF" fontSize="25px">Rules</Heading>
              <Icon as={showRules ? ChevronUpIcon : ChevronDownIcon} color="gray.400" boxSize="30px" />
            </Flex>

            {showRules && (
              <Box mt={4}>
                <Text color="gray.400" mb={3}>
                  This is a binary option market where users can place bids on whether the price of {tradingPair} will be above (LONG) or below (SHORT) the strike price: {strikePrice} USD at maturity.
                </Text>

                <Text fontWeight="semibold" color="gray.300" mt={4} mb={2}>Market Phases:</Text>
                <UnorderedList color="gray.400" spacing={2} pl={5} mb={4}>
                  <ListItem><strong>Trading Phase:</strong> The market is visible but not yet open for bidding.</ListItem>
                  <ListItem><strong>Bidding Phase:</strong> Users can place LONG/SHORT bids with ETH.</ListItem>
                  <ListItem><strong>Maturity Phase:</strong> The final price is determined and the market outcome is resolved.</ListItem>
                  <ListItem><strong>Expiry Phase:</strong> Winners can claim rewards proportional to their bid amount.</ListItem>
                </UnorderedList>

                <Text fontWeight="semibold" color="gray.300" mt={4} mb={2}>Yes/No Criteria:</Text>
                <UnorderedList color="gray.400" spacing={2} pl={5} mb={4}>
                  <ListItem>Resolves to <strong>"Yes"</strong> (LONG wins) if the final price is strictly above {strikePrice} USD at maturity time.</ListItem>
                  <ListItem>Resolves to <strong>"No"</strong> (SHORT wins) if the final price is {strikePrice} USD or below at maturity time.</ListItem>
                </UnorderedList>

                <Text fontWeight="semibold" color="gray.300" mt={4} mb={2}>Resolution:</Text>
                <UnorderedList color="gray.400" spacing={2} pl={5} mb={4}>
                  <ListItem>We will use the Orally oracle price feed at the exact maturity time: {new Date(maturityTime * 1000).toLocaleString()}.</ListItem>
                  <ListItem>Specifically, we will look at the closing USD value of {tradingPair} at that exact minute.</ListItem>
                  <ListItem>If the price is strictly above {strikePrice} USD, the market resolves as <strong>"Yes"</strong>. Otherwise, it resolves as <strong>"No"</strong>.</ListItem>
                </UnorderedList>

                <Text fontWeight="semibold" color="gray.300" mt={4} mb={2}>Profit Calculation:</Text>
                <Text color="gray.400" mb={3}>
                  Your potential profit depends on the ratio between LONG and SHORT bids. If most users bet against your position, your potential profit increases. A fee of {Number(feePercentage) / 10}% is charged on winning positions.
                </Text>

                <Text fontWeight="semibold" color="gray.300" mt={4} mb={2}>Cancellation (Invalidity) Conditions:</Text>
                <UnorderedList color="gray.400" spacing={2} pl={5} mb={4}>
                  <ListItem>If the price feed is unavailable at the resolution time.</ListItem>
                  <ListItem>If market data is not available at the resolution time.</ListItem>
                  <ListItem>Any other circumstance that makes resolution impossible or unreliable.</ListItem>
                </UnorderedList>
                <Text color="gray.400" mb={4}>
                  If the market is canceled, participants can withdraw their full bid amount without any fees.
                </Text>

                {/* Resolution Source Box */}
                <Box
                  mt={4}
                  p={3}
                  //bg="gray.800"
                  borderRadius="md"
                  border="1px solid"
                  borderColor="gray.700"
                >
                  <Flex align="center" fontSize="25px" fontWeight="bold">
                    <Image src="/images/coinbase.png" alt="Coinbase" boxSize="50px" display="inline" mx={1} borderRadius="full" mr={6} />
                    <Box>
                      <Text color="gray.400" fontSize="lg">Resolution Source</Text>
                      <Link color="blue.400" href="https://www.coinbase.com" isExternal>
                        Coinbase
                      </Link>
                    </Box>
                  </Flex>
                </Box>
              </Box>
            )}
          </Box>
        </Box>

        {/* Right Side - Bid Panel and Market Info */}


        <Box width={{ base: '100%', md: '20%' }} mr={4}>
          {/* Strike Price */}
          <Box
            bg="gray.800"
            p={4}
            borderRadius="xl"
            mb={4}
            borderWidth={1}
            borderColor="gray.700"
          >
            <Flex justify="space-between" align="center" textAlign="center" fontSize="20px" color="#FEDF56">
              <HStack justify="center" align="center">
                <Text color="gray.400">Strike Price: </Text>
                <Text fontWeight="bold">{strikePrice} USD</Text>
              </HStack>
            </Flex>

            {/* Show Final Price in Maturity and Expiry phases */}
            {(currentPhase === Phase.Maturity || currentPhase === Phase.Expiry) && (
              <Flex justify="space-between" align="center" mt={2} textAlign="center" fontSize="20px" color="#FEDF56">
                <HStack justify="center" align="center">
                  <Text color="gray.400">Final Price: </Text>
                  {finalPrice > strikePrice ? (
                    <>
                      <Text fontWeight="bold" color="green">{finalPrice} </Text>
                      <Text fontWeight="bold" color="#FEDF56">USD</Text>
                    </>
                  ) : (
                    <>
                      <Text fontWeight="bold" color="red">{finalPrice} </Text>
                      <Text fontWeight="bold" color="#FEDF56">USD</Text>
                    </>
                  )}
                </HStack>
              </Flex>
            )}

            {reward > 0 && currentPhase === Phase.Expiry && (
              <Button
                onClick={claimReward}
                colorScheme="yellow"
                bg="#FEDF56"
                color="white"
                _hover={{ bg: "#FFE56B" }}
                isDisabled={reward === 0}
                width="100%"
                mt={4}
              >
                Claim {reward.toFixed(4)} ETH
              </Button>
            )}
            {isOwner && contractBalance > 0 && currentPhase === Phase.Expiry && (
              <Button
                onClick={handleWithdraw}
                colorScheme="yellow"
                bg="#FEDF56"
                color="white"
                _hover={{ bg: "#FFE56B" }}
                width="100%"
                mt={2}
              >
                Withdraw {withdrawalAmount.toFixed(4)} ETH
              </Button>
            )}
          </Box>
          {(currentPhase === Phase.Trading || currentPhase === Phase.Bidding) && (
          <Box
            bg="gray.800"
            p={4}
            borderRadius="xl"
            mb={4}
            borderWidth={1}
            borderColor="gray.700"
          >
            {/* LONG/SHORT Ratio */}
            <HStack align="center" spacing={3} w="100%">
              {longPercentage > 8 && (
                <Text
                  fontSize="sm"
                  fontWeight="bold"
                  color="whiteAlpha.800"
                  whiteSpace="nowrap"
                  mb={4}
                >
                  {longPercentage.toFixed(0)}%
                </Text>
              )}
              <Flex
                flex="1"
                align="center"
                w="100%"
                h="18px"
                borderRadius="full"
                bg="gray.800"
                border="5px solid"
                borderColor="gray.400"
                position="relative"
                overflow="hidden"
                boxShadow="inset 0 1px 3px rgba(0,0,0,0.6)"
                mb={4}
                p={0}
              >


                {/* LONG Section */}
                <Box
                  position="absolute"
                  width={`${longPercentage}%`}
                  bgGradient="linear(to-r, #00ea00, #56ff56, #efef8b)"
                  transition="width 0.6s ease"
                  h="100%"

                  display="flex"
                  alignItems="center"
                  justifyContent="flex-end"
                  pr={3}
                  left="0"
                  top="0"
                  zIndex={1}

                >

                </Box>

                {/* SHORT Section (in absolute layer for smooth overlap) */}
                <Box
                  position="absolute"
                  right="0"
                  top="0"
                  h="100%"
                  width={`${shortPercentage}%`}
                  bgGradient="linear(to-r, #FF6B81, #D5006D)"
                  transition="width 0.6s ease"
                  display="flex"
                  alignItems="center"
                  justifyContent="flex-start"
                  pl={3}
                  zIndex={0}

                >

                </Box>

              </Flex>

              {shortPercentage > 8 && (
                <Text
                  fontSize="sm"
                  fontWeight="bold"
                  color="whiteAlpha.800"
                  whiteSpace="nowrap"
                  mb={4}
                >
                  {shortPercentage.toFixed(0)}%
                </Text>
              )}
            </HStack>

            <HStack spacing={4} mb={3} ml={2} mr={2}>
              <Button
                border="1px solid"
                borderColor="gray.300"
                borderRadius="20px"
                colorScheme="gray"
                bg="gray.800"
                width="50%"
                onClick={() => handleSelectSide(Side.Long)}
                leftIcon={<FaArrowUp />}
                textColor="#28a745"
                textShadow="1px 1px 12px rgba(40, 167, 69, 0.7)"
                isDisabled={!isConnected || currentPhase !== Phase.Bidding}
                _hover={{
                  bg: "gray.700",
                  boxShadow: "0 4px 8px rgba(220, 53, 69, 0.2)",
                }}
                _active={{
                  bg: "#cececc",
                }}
                isActive={selectedSide === Side.Long}
              >
                UP
              </Button>
              <Button
                border="1px solid"
                borderColor="gray.300"
                borderRadius="20px"
                colorScheme="gray"
                bg="gray.800"
                width="50%"
                onClick={() => handleSelectSide(Side.Short)}
                leftIcon={<FaArrowDown />}
                textColor="#dc3545"
                textShadow="1px 1px 12px rgba(220, 53, 69, 0.7)"
                isDisabled={!isConnected || currentPhase !== Phase.Bidding}
                _hover={{
                  bg: "gray.700",
                  boxShadow: "0 4px 8px rgba(220, 53, 69, 0.2)",
                }}
                _active={{
                  bg: "#cececc",
                }}
                isActive={selectedSide === Side.Short}
              >
                DOWN
              </Button>
            </HStack>


            {/* Bidding */}
            <FormControl mb={2} mt={6} color="white">
              <FormLabel>You're betting</FormLabel>
              <Input
                placeholder="Enter amount in ETH"
                bg="gray.800"
                color="white"
                borderColor="gray.600"
                borderRadius="md"
                mb={3}
                ml={2}
                mr={2}
                value={bidAmount}
                onChange={handleBidAmountChange}
              //onReset={resetBettingForm}
              />
            </FormControl>

            <HStack spacing={2} mt={1} mb={2} ml={2} mr={2} alignItems="center" justifyContent="center">
              <Button
                colorScheme="#0040C1"
                bg="#0040C1"
                color="white"
                _hover={{ bg: "#0040C1" }}
                width="100%"
                py={6}
                mb={3}
                ml={2}
                mr={2}
                onClick={() => handleBid()}
                isLoading={isResolving}
                loadingText="Placing bid..."
                isDisabled={!isConnected || selectedSide === null || currentPhase !== Phase.Bidding}
              >
                Betting to rich
              </Button>
            </HStack>
            <Flex justify="space-between" px={2} mb={1}>
              <Text fontSize="lg" color="gray.400">
                Fee:
              </Text>
              <Text fontSize="lg" color="gray.400">
                {Number(feePercentage) / 10}%
              </Text>
            </Flex>

            <Flex justify="space-between" px={2} mb={1}>
              <Text color="gray.400" fontSize="lg">
                Pot. profit:
              </Text>
              <Text color={profitPercentage > 0 ? "green.400" : "gray.400"} fontSize="15px">
                {potentialProfit} {profitPercentage !== 0 ? `(${profitPercentage > 0 ? '+' : ''}${profitPercentage.toFixed(2)}%)` : ''} ETH
              </Text>
            </Flex>

            {/* Your Position */}
            <Text fontSize="lg" fontWeight="bold" mb={3} color="#FEDF56">Your Position</Text>
            <Flex justify="space-between" mb={2}>
              <Text color="green.400">LONG:</Text>
              <Text color="white">{userPositions.long.toFixed(8)} ETH</Text>
            </Flex>
            <Flex justify="space-between">
              <Text color="red.400">SHORT:</Text>
              <Text color="white">{userPositions.short.toFixed(8)} ETH</Text>
            </Flex>
          </Box>
          )}
          <Box p={4} borderRadius="xl" mb={4} borderWidth={1} borderColor="gray.700">
            <Text fontSize="lg" fontWeight="bold" mb={3} color="white">
              My Holdings
            </Text>
            <Button
              variant="ghost"
              color="#4169e1"
              onClick={() => router.push('/owner')}
              rightIcon={<FaChevronRight />}
              _hover={{ bg: 'rgba(254, 223, 86, 0.1)' }}
            >
              Make your first Prediction Market
            </Button>
          </Box>

          {/* Market Timeline */}
          <Box
            bg="#222530"
            p={4}
            borderWidth={1}
            borderColor="gray.700"
            borderRadius="30px"
            boxShadow="md"
            position="relative"
            height="320px"
          >
            {(currentPhase === Phase.Maturity || currentPhase === Phase.Expiry) ? (
              <VStack spacing={1} mb={1}>
                <HStack>
                  <Text fontSize="lg" fontWeight="bold" color="#gray.600" textAlign="center">
                    Outcome:
                  </Text>
                  <Text
                    fontSize="lg"
                    fontWeight="bold"
                    color={marketResult === 'LONG' ? 'green' : 'red'}
                    textAlign="center"
                  >
                    {marketResult || 'Pending'}
                  </Text>
                </HStack>
                <Text fontSize="xs" color="gray.400" textAlign="center">
                  {formatTimeToLocal(maturityTime)}
                </Text>
              </VStack>
            ) : (
              <Text fontSize="2xl" fontWeight="bold" mb={4} mt={2} color="#gray.600" textAlign="center">
                Market is Live
              </Text>
            )}

            <Box
              bg="#0B0E16"
              p={4}
              borderWidth={1}
              borderColor="gray.700"
              borderRadius="30px"
              position="absolute"
              top="70px"
              left="0"
              right="0"
              zIndex={1}

            >
              <VStack align="stretch" spacing={3} position="relative">
                {/* Vertical Line */}
                <Box
                  position="absolute"
                  left="16px"
                  top="30px"
                  bottom="20px"
                  width="2px"
                  bg="gray.700"
                  zIndex={0}
                />

                {/* Trading Phase */}
                <HStack spacing={4}>
                  <Circle size="35px" bg="blue.400" color="black" zIndex={1} fontWeight="bold">{currentPhase >= Phase.Bidding ? <CheckIcon boxSize={4} /> : '1'}</Circle>
                  <VStack align="start" spacing={0} fontWeight="bold">
                    <Text fontSize="lg" color={currentPhase === Phase.Trading ? "green.400" : "gray.500"} >
                      Trading
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {deployTime ? new Date(deployTime * 1000).toLocaleString() : 'Pending'}
                    </Text>
                  </VStack>
                  <Spacer />
                  {currentPhase === Phase.Trading && isOwner && (
                    <Button
                      onClick={startBidding}
                      size="sm"
                      colorScheme="yellow"
                      bg="#FEDF56"
                      color="black"
                      _hover={{ bg: "#FFE56B" }}
                      alignItems="center"
                      justifyContent="center"
                      width="30%"
                    >
                      Bidding
                    </Button>
                  )}
                </HStack>

                {/* Bidding Phase */}
                <HStack spacing={4}>
                  <Circle size="35px" bg="blue.400" color="black" zIndex={1} fontWeight="bold">{currentPhase >= Phase.Maturity ? <CheckIcon boxSize={4} /> : '2'}</Circle>
                  <VStack align="start" spacing={0} fontWeight="bold">
                    <Text fontSize="lg" color={currentPhase === Phase.Bidding ? "blue.400" : "gray.500"}>
                      Bidding
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {biddingStartTime ? new Date(biddingStartTime * 1000).toLocaleString() : 'Waiting for Start'}
                    </Text>
                  </VStack>
                  <Spacer />
                  {/* Resolve Button - Show when canResolve = true */}
                  {canResolve && !isResolving && (
                    <Button
                      onClick={() => {
                        setIsResolving(true);
                        handleResolveMarket().finally(() => setIsResolving(false));
                      }}
                      size="sm"
                      colorScheme="yellow"
                      bg="#FEDF56"
                      color="black"
                      _hover={{ bg: "#FFE56B" }}
                      isLoading={isResolving}
                      loadingText="Resolving"
                      alignItems="center"
                      justifyContent="center"
                      width="30%"
                    >
                      Resolve
                    </Button>
                  )}
                </HStack>

                {/* Maturity Phase with Resolve Button */}
                <HStack spacing={4} justify="space-between">
                  <HStack spacing={4}>
                    <Circle size="35px" bg="blue.400" color="black" zIndex={1} fontWeight="bold">{currentPhase >= Phase.Maturity ? <CheckIcon boxSize={4} /> : '3'}</Circle>
                    <VStack align="start" spacing={0} fontWeight="bold">
                      <Text fontSize="lg" color={currentPhase === Phase.Maturity ? "orange.400" : "gray.500"}>
                        Maturity
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {maturityTime ? formatTimeToLocal(maturityTime) : 'Pending'}
                      </Text>
                    </VStack>
                  </HStack>
                  <Spacer />

                  {/* Expire Button - Show when ở phase Maturity and resolved */}
                  {currentPhase === Phase.Maturity && finalPrice && isOwner && (
                    <Button
                      onClick={handleExpireMarket}
                      size="sm"
                      colorScheme="yellow"
                      bg="#FEDF56"
                      color="black"
                      _hover={{ bg: "#FFE56B" }}
                      isLoading={isExpiringMarket}
                      loadingText="Expiring"
                      alignItems="center"
                      justifyContent="center"
                      width="30%"
                    >
                      Expire
                    </Button>
                  )}
                </HStack>

                {/* Expiry Phase */}
                <HStack spacing={4} justify="space-between">
                  <HStack spacing={4}>
                    <Circle size="35px" bg="blue.400" color="black" zIndex={1} fontWeight="bold">4</Circle>
                    <VStack align="start" spacing={0} fontWeight="bold">
                      <Text fontSize="lg" color={currentPhase === Phase.Expiry ? "red.400" : "gray.500"}>
                        Expiry
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {maturityTime ? formatTimeToLocal(maturityTime + 30) : 'Pending'}
                      </Text>
                    </VStack>
                  </HStack>
                  <Spacer />
                </HStack>
              </VStack>
            </Box>

            {/* Claim Button - Show when have reward and ở phase Expiry */}
            {reward > 0 && currentPhase === Phase.Expiry && (
              <Button
                onClick={claimReward}
                colorScheme="yellow"
                bg="#FEDF56"
                color="white"
                _hover={{ bg: "#FFE56B" }}
                isDisabled={reward === 0}
                width="100%"
                mt={4}
              >
                Claim {reward.toFixed(4)} ETH
              </Button>
            )}
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}

export default Customer;