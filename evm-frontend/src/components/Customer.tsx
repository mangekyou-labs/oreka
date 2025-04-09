import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCallback } from 'react'; // Thêm import useCallback
import {
  Flex, Box, Text, Button, VStack, useToast, Input, Heading, Image,
  Select, HStack, Icon, ScaleFade, Table, Thead, Tbody, Tab, Tr, Th, Td, Spacer, Tabs, TabList, TabPanels, TabPanel, Circle, FormControl, FormLabel,
  Link
} from '@chakra-ui/react';
import { FaEthereum, FaWallet, FaTrophy, FaChevronLeft, FaShare, FaArrowUp, FaArrowDown, FaExternalLinkAlt, FaBalanceScale, FaCoins, FaChevronRight, FaCalendarAlt, FaRegClock, } from 'react-icons/fa';
import { PiChartLineUpLight } from "react-icons/pi";
import { GrInProgress } from "react-icons/gr";
import { ethers } from 'ethers';
import { BigNumber } from 'ethers';
import { motion, useAnimation } from 'framer-motion';
import BinaryOptionMarket from '../contracts/abis/BinaryOptionMarketABI.json';
import { PriceService, PriceData } from '../services/PriceService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SiBitcoinsv } from 'react-icons/si';
import { useRouter } from 'next/router'; // Thêm import này
import { getContractTradingPair, getChartSymbol } from '../config/tradingPairs';
import { useAuth } from '../context/AuthContext';
import MarketCharts from './charts/MarketCharts';
import { toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { formatTimeToLocal, getCurrentTimestamp, getTimeRemaining } from '../utils/timeUtils';

enum Side { Long, Short }
enum Phase { Trading, Bidding, Maturity, Expiry }


interface Coin {
  value: string;
  label: string;
}

interface PositionHistory {
  timestamp: number;
  longPercentage: number;
  shortPercentage: number;
}

// Thêm interface cho symbol mapping
interface CoinSymbol {
  [key: string]: string;
}

// Thêm interface cho position data
interface PositionData {
  timestamp: number;
  longPercentage: number;
  shortPercentage: number;
  isVisible: boolean;
}

// Thêm interface cho position point
interface PositionPoint {
  timestamp: number;
  longPercentage: number | null;
  shortPercentage: number | null;
  isMainPoint: boolean;
  isFixed?: boolean;
  isCurrentPoint?: boolean; // Flag mới để đánh dấu điểm hiện tại
}

// Thêm interface cho event history
interface BidEvent {
  timestamp: number;
  longAmount: BigNumber;
  shortAmount: BigNumber;
}

interface CustomerProps {
  contractAddress?: string;
}

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

// Di chuyển providerConfig ra ngoài component và thêm các cấu hình cần thiết
const providerConfig = {
  chainId: 31337,
  name: 'local',
  ensAddress: null,
  networkId: 31337,
  polling: false,
  staticNetwork: true
};

// Tạo hàm helper để lấy provider và signer
const getProviderAndSigner = async () => {
  const provider = new ethers.providers.Web3Provider(window.ethereum, providerConfig);
  await provider.send("eth_requestAccounts", []); // Yêu cầu kết nối ví
  const signer = provider.getSigner();
  return { provider, signer };
};

// Thêm hàm helper để chuyển đổi UTC sang múi giờ Eastern
const toETTime = (utcTimestamp) => {
  return toZonedTime(new Date(utcTimestamp * 1000), 'America/New_York');
};

function Customer({ contractAddress: initialContractAddress }: CustomerProps) {
  const { isConnected, walletAddress, balance, connectWallet, refreshBalance } = useAuth();
  const [selectedSide, setSelectedSide] = useState<Side | null>(null);
  const [contractBalance, setContractBalance] = useState(0);
  const [accumulatedWinnings, setAccumulatedWinnings] = useState(0);
  const [bidAmount, setBidAmount] = useState("");
  const [currentPhase, setCurrentPhase] = useState<Phase>(Phase.Trading);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [strikePrice, setStrikePrice] = useState<string>('');
  const [finalPrice, setFinalPrice] = useState<string>('');
  const [showClaimButton, setShowClaimButton] = useState(false);
  const [reward, setReward] = useState(0); // Số phần thưởng khi người chơi thắng
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [positions, setPositions] = useState<{ long: number; short: number }>({ long: 0, short: 0 });
  const [contractAddress, setContractAddress] = useState(initialContractAddress || '');
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [canResolve, setCanResolve] = useState(false);
  const [canExpire, setCanExpire] = useState(false);
  const [marketResult, setMarketResult] = useState<string>('');
  const [userPosition, setUserPosition] = useState<Side | null>(null);
  const [tradingPair, setTradingPair] = useState('');
  const [chartSymbol, setChartSymbol] = useState('BTCUSDT');
  const [biddingStartTime, setBiddingStartTime] = useState<number>(0);
  const [deployTime, setDeployTime] = useState<number>(0);
  const [positionHistory, setPositionHistory] = useState<PositionPoint[]>([]);
  const positionHistoryKey = `position_history_${contractAddress}`;
  const [biddingStartTimestamp, setBiddingStartTimestamp] = useState<number>(0);
  const [maturityTime, setMaturityTime] = useState<number>(0);
  const [oracleDetails, setOracleDetails] = useState<any>(null);
  const [resolveTime, setResolveTime] = useState<number>(0);
  const [positionData, setPositionData] = useState<PositionData[]>([]);
  const [userPositions, setUserPositions] = useState<{ long: number; short: number }>({ long: 0, short: 0 });
  const [isOwner, setIsOwner] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isExpiring, setIsExpiring] = useState(false);
  const [priceTimeRange, setPriceTimeRange] = useState<string>('1w');
  const [positionTimeRange, setPositionTimeRange] = useState<string>('all');
  const [isResolvingMarket, setIsResolvingMarket] = useState<boolean>(false);
  const [isExpiringMarket, setIsExpiringMarket] = useState<boolean>(false);
  const [potentialProfit, setPotentialProfit] = useState<{ b: number; c: number }>({ b: 0, c: 0 });
  const [feePercentage, setFeePercentage] = useState<string>('0');
  const router = useRouter();

  // Thêm mapping từ contract address sang symbol Binance
  const coinSymbols: CoinSymbol = {
    "0x5fbdb2315678afecb367f032d93f642f64180aa3": "ICPUSDT",
    "0x6fbdb2315678afecb367f032d93f642f64180aa3": "ETHUSDT",
    "0x7fbdb2315678afecb367f032d93f642f64180aa3": "BTCUSDT"
  };

  // Sửa lại availableCoins để thêm thông tin symbol
  const [availableCoins] = useState<Coin[]>([
    { value: "0x5fbdb2315678afecb367f032d93f642f64180aa3", label: "ICP/USD" },
    { value: "0x6fbdb2315678afecb367f032d93f642f64180aa3", label: "ETH/USD" },
    { value: "0x7fbdb2315678afecb367f032d93f642f64180aa3", label: "BTC/USD" }
  ]);

  const toast = useToast();
  const priceControls = useAnimation();

  useEffect(() => {
    // Nếu có initialContractAddress từ props, sử dụng nó
    if (initialContractAddress) {
      setContractAddress(initialContractAddress);
    }
    // Nếu không, thử đọc từ localStorage
    else {
      const savedAddress = localStorage.getItem('selectedContractAddress');
      if (savedAddress) {
        setContractAddress(savedAddress);
      }
    }
  }, [initialContractAddress]);

  useEffect(() => {
    return () => {
      // Xóa địa chỉ khỏi localStorage khi rời khỏi trang
      localStorage.removeItem('selectedContractAddress');
    };
  }, []);

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

  useEffect(() => {
    const interval = setInterval(() => {
      if (contract) {
        fetchMarketDetails();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [contract]);

  useEffect(() => {
    if (contractAddress) {
      fetchContractBalance();
    }
  }, [contractAddress]);

  // Thêm useEffect để load position history khi contract address thay đổi
  useEffect(() => {
    if (contractAddress) {
      // Load position history từ localStorage
      const savedHistory = localStorage.getItem(positionHistoryKey);
      if (savedHistory) {
        setPositionHistory(JSON.parse(savedHistory));
      } else {
        // Khởi tạo history mới nếu chưa có
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

  // Thêm hàm chuyển đổi từ trading pair từ contract sang định dạng API
  const formatTradingPairForApi = (pair: string): string => {
    // Ví dụ: "BTC/USD" -> "BTC-USD" cho Coinbase API
    return pair.replace('/', '-');
  };

  // Sửa lại hàm fetchMarketDetails để lưu tradingPair và chartSymbol
  const fetchMarketDetails = async () => {
    if (!contract || !walletAddress) return;
    try {
      const [
        positions,
        strikePrice,
        phase,
        deployTime,
        tradingPair,
        maturityTime,
        oracleDetails,
        totalDeposited,
        biddingStartTime,
        resolveTime,
        longPosition,
        shortPosition,
        feePercentage
      ] = await Promise.all([
        contract.positions(),
        contract.strikePrice(),
        contract.currentPhase(),
        contract.deployTime(),
        contract.tradingPair(),
        contract.maturityTime(),
        contract.oracleDetails(),
        contract.totalDeposited(),
        contract.biddingStartTime(),
        contract.resolveTime(),
        contract.longBids(walletAddress),
        contract.shortBids(walletAddress),
        contract.feePercentage()
      ]);

      // Lưu trading pair vào state
      setTradingPair(tradingPair);

      // Định dạng trading pair cho API và lưu vào chartSymbol
      const formattedSymbol = formatTradingPairForApi(tradingPair);
      setChartSymbol(formattedSymbol);

      // Cập nhật tổng positions
      setPositions({
        long: parseFloat(ethers.utils.formatEther(positions.long)),
        short: parseFloat(ethers.utils.formatEther(positions.short))
      });

      // Cập nhật user positions từ mappings
      setUserPositions({
        long: parseFloat(ethers.utils.formatEther(longPosition)),
        short: parseFloat(ethers.utils.formatEther(shortPosition))
      });

      // Cập nhật userPosition dựa trên vị thế hiện tại
      if (parseFloat(ethers.utils.formatEther(longPosition)) > 0) {
        setUserPosition(Side.Long);
      } else if (parseFloat(ethers.utils.formatEther(shortPosition)) > 0) {
        setUserPosition(Side.Short);
      } else {
        setUserPosition(null);
      }

      setStrikePrice(ethers.utils.formatUnits(strikePrice, 0));
      setMaturityTime(maturityTime.toNumber());
      setOracleDetails(oracleDetails);
      setTotalDeposited(parseFloat(ethers.utils.formatEther(totalDeposited)));
      setDeployTime(deployTime.toNumber());
      setBiddingStartTime(Number(biddingStartTime));
      setResolveTime(Number(resolveTime));
      setFeePercentage(feePercentage.toString());
      // Kiểm tra có thể resolve và expire
      const now = Math.floor(Date.now() / 1000);
      setCanResolve(phase === Phase.Bidding && now >= maturityTime.toNumber());
      setCanExpire(
        phase === Phase.Maturity &&
        resolveTime.toNumber() > 0 &&
        now >= resolveTime.toNumber() + 30
      );

      // Lấy finalPrice từ oracleDetails khi ở phase Maturity hoặc Expiry
      if (phase === Phase.Maturity || phase === Phase.Expiry) {
        setFinalPrice(oracleDetails.finalPrice.toString());
      }

    } catch (error) {
      console.error("Error fetching market details:", error);
    }
  }, [contractAddress]);

  const fetchContractBalance = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contractBalanceWei = await provider.getBalance(contractAddress);
      const contractBalanceEth = parseFloat(ethers.utils.formatEther(contractBalanceWei));
      setContractBalance(contractBalanceEth); // Cập nhật vào state
    } catch (error) {
      console.error("Failed to fetch contract balance:", error);
    }
  };

  // Thêm hàm kiểm tra kết quả market
  const checkMarketResult = async () => {
    if (!contract) return;
    try {
      const oracleDetails = await contract.oracleDetails();
      const finalPrice = parseFloat(oracleDetails.finalPrice);
      const strikePrice = parseFloat(oracleDetails.strikePrice);

      if (finalPrice < strikePrice) {
        setMarketResult('SHORT IS WIN');
      } else {
        setMarketResult('LONG IS WIN');
      }
    } catch (error) {
      console.error("Error checking market result:", error);
    }
  };

  // Thêm useEffect để kiểm tra kết quả khi phase thay đổi
  useEffect(() => {
    if (currentPhase === Phase.Maturity || currentPhase === Phase.Expiry) {
      checkMarketResult();
    } else {
      setMarketResult('');
    }
  }, [currentPhase, contract]);

  // Sửa lại useEffect để kiểm tra thời gian
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

  // Thêm hàm để tính toán phần trăm
  const calculatePercentages = (longAmount: number, shortAmount: number) => {
    const total = longAmount + shortAmount;
    if (total === 0) return { long: 50, short: 50 };

    const longPercentage = (longAmount / total) * 100;
    const shortPercentage = (shortAmount / total) * 100;
    return { long: longPercentage, short: shortPercentage };
  };

  // Thêm hàm để tính toán các mốc thời gian
  const calculateTimePoints = (deployTime: number, maturityTime: number) => {
    const duration = maturityTime - deployTime;
    const interval = Math.floor(duration / 10); // Chia làm 10 điểm
    const timePoints = [];

    for (let i = 0; i <= 10; i++) {
      timePoints.push(deployTime + (interval * i));
    }

    return timePoints;
  };

  // Thêm hàm tạo các mốc thời gian
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

  // Sửa lại phần xử lý position data trong component
  useEffect(() => {
    if (!contract || currentPhase !== Phase.Bidding) return;

    const initializePositionData = async () => {
      const biddingStartTime = await contract.biddingStartTime();
      const maturityTime = await contract.maturityTime();
      const timePoints = createTimePoints(
        biddingStartTime.toNumber(),
        maturityTime.toNumber()
      );
      setPositionData(timePoints);
    };

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

    // Khởi tạo dữ liệu ban đầu
    initializePositionData();

    // Cập nhật dữ liệu mỗi giây
    const interval = setInterval(updatePositionData, 1000);
    return () => clearInterval(interval);
  }, [contract, currentPhase, positions]);


  // Sửa lại handleBid
  const handleBid = async (side: Side) => {
    if (!contract || !bidAmount || parseFloat(bidAmount) <= 0) return;

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      const bidAmountWei = ethers.utils.parseEther(bidAmount);

      // Gọi hàm bid của contract với signer
      const tx = await contractWithSigner.bid(side, {
        value: bidAmountWei,
        gasLimit: 500000
      });

      await tx.wait();

      // Cập nhật UI sau khi bid thành công
      toast({
        title: "Bid placed successfully!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Reset bid amount và refresh data
      await refreshBalance();
      await fetchMarketDetails();
      setBidAmount("");
    } catch (error: any) {
      console.error("Error placing bid:", error);
      toast({
        title: "Failed to place bid",
        description: error.message || "An unexpected error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (contract && currentPhase !== Phase.Bidding) { // Ngăn không cho cập nhật trong phase Bidding
        fetchMarketDetails();
      }
    }, 5000); // Gọi hàm mỗi 5 giây
    return () => clearInterval(interval); // Clear interval khi component bị unmount
  }, [contract, currentPhase]);




  const canClaimReward = useCallback(async () => {
    if (!contract || currentPhase !== Phase.Expiry) return;

    try {


      // Kiểm tra xem đã claim chưa
      const hasClaimed = await contract.hasClaimed(walletAddress);
      console.log("Has claimed:", hasClaimed);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);  // Kết nối contract với signer

      // Lấy thông tin oracle
      const oracleDetails = await contract.oracleDetails();
      const finalPrice = parseFloat(oracleDetails.finalPrice);
      const strikePrice = parseFloat(oracleDetails.strikePrice);
      console.log("Prices:", { finalPrice, strikePrice });

      // Sửa lại logic: finalPrice < strikePrice thì SHORT win
      const winningSide = finalPrice < strikePrice ? Side.Short : Side.Long;
      console.log("Winning side:", winningSide);

      // Kiểm tra số tiền đặt cược của user
      const userDeposit = winningSide === Side.Long ?
        await contract.longBids(walletAddress) :
        await contract.shortBids(walletAddress);
      console.log("User deposit:", userDeposit.toString());

      // Hiển thị nút claim nếu:
      // 1. Chưa claim
      // 2. Có đặt cược ở bên thắng
      // 3. Đang ở phase Expiry
      if (!hasClaimed && userDeposit.gt(0) && currentPhase === Phase.Expiry) {
        setShowClaimButton(true);

        // Tính toán reward
        const positions = await contract.positions();
        const totalWinningDeposits = winningSide === Side.Long ? positions.long : positions.short;
        const totalDeposited = positions.long.add(positions.short);

        const reward = userDeposit.mul(totalDeposited).div(totalWinningDeposits);
        const fee = reward.mul(10).div(100); // 10% fee
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

  // Thêm useEffect để check claim eligibility
  useEffect(() => {
    if (currentPhase === Phase.Expiry) {
      canClaimReward();
    }
  }, [currentPhase, canClaimReward]);

  // Reset lại thị trường
  const resetMarket = () => {
    setPositions({ long: 0, short: 0 });
    setTotalDeposited(0);
    setStrikePrice('0');
    setFinalPrice('0');
    setCurrentPhase(Phase.Bidding);
    priceControls.set({ opacity: 1, color: "#FEDF56" });
  };


  const abbreviateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

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

  // Sửa lại useEffect cho price history
  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
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

  // Thêm hàm xử lý resolve và expire


  const handleExpireMarket = async () => {
    if (!contract) return;
    try {
      console.log("Attempting to expire market...");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      // Hiển thị thông báo đang xử lý
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

      // Hiển thị thông báo transaction đã được gửi
      toast({
        title: "Transaction sent",
        description: `Transaction hash: ${tx.hash.substring(0, 10)}...`,
        status: "info",
        duration: 5000,
        isClosable: true,
      });

      await tx.wait();

      // Hiển thị thông báo thành công
      toast({
        title: "Market expired successfully!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Refresh market details
      await fetchMarketDetails();

      // Cập nhật UI ngay lập tức
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

        // Lấy tất cả thông tin cần thiết từ contract
        try {
          const [
            positions,
            strikePriceBN,
            phase,
            biddingStartTime,
            tradingPair,
            deployTimestamp,
            feePercentage
          ] = await Promise.all([
            contract.positions(),
            contract.strikePrice(),
            contract.currentPhase(),
            contract.biddingStartTime(),
            contract.tradingPair().catch(() => 'Unknown'),
            contract.deployTime(),
            contract.feePercentage()
          ]);

          // Cập nhật states
          setContract(contract);
          setContractAddress(contractAddress);
          setStrikePrice(ethers.utils.formatUnits(strikePriceBN, 0));
          setCurrentPhase(phase);
          setTradingPair(tradingPair);
          setBiddingStartTime(biddingStartTime.toNumber());
          setDeployTime(deployTimestamp.toNumber());
          // Set chart symbol dựa trên trading pair
          const symbol = tradingPair === "BTC/USD" ? "BTCUSDT" :
            tradingPair === "ETH/USD" ? "ETHUSDT" :
              tradingPair === "ICP/USD" ? "ICPUSDT" : "BTCUSDT";
          setChartSymbol(symbol);
          console.log("Chart symbol:", symbol);
          // Cập nhật positions
          setPositions({
            long: parseFloat(ethers.utils.formatEther(positions.long)),
            short: parseFloat(ethers.utils.formatEther(positions.short))
          });

        } catch (error) {
          console.error("Error loading contract data:", error);
          // Set default values nếu có lỗi
          setTradingPair('Unknown');
          //setChartSymbol('BTCUSDT');
        }

      } catch (error) {
        console.error("Error:", error);
      }
    };

    loadContractData();
  }, []);

  // Sửa lại useEffect cho price chart
  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
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

  // Add near other state declarations
  const phaseCircleProps = (phase: Phase) => ({
    bg: currentPhase === phase ? "#FEDF56" : "gray.700",
    color: currentPhase === phase ? "black" : "gray.500",
    fontWeight: "bold",
    zIndex: 1
  });

  // Thêm hàm resolve
  const resolve = async () => {
    if (!contract) return;

    try {
      console.log("Attempting to resolve market...");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      // Hiển thị thông báo đang xử lý
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

      // Hiển thị thông báo transaction đã được gửi
      toast({
        title: "Transaction sent",
        description: `Transaction hash: ${tx.hash.substring(0, 10)}...`,
        status: "info",
        duration: 5000,
        isClosable: true,
      });

      await tx.wait();

      // Hiển thị thông báo thành công
      toast({
        title: "Market resolved successfully!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Refresh market details
      await fetchMarketDetails();

      // Cập nhật UI ngay lập tức
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

  // Thêm cleanup khi component unmount
  // useEffect(() => {
  //   return () => {
  //     if (contractAddress) {
  //       // Lưu position history cuối cùng vào localStorage
  //       localStorage.setItem(positionHistoryKey, JSON.stringify(positionHistory));
  //     }
  //   };
  // }, [contractAddress, positionHistory]);

  // Thêm lại hàm claimReward
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

  // Sửa lại hàm fetchPositionHistory
  const fetchPositionHistory = async () => {
    if (!contract) return [];
    try {
      const deployTime = await contract.deployTime();
      if (!deployTime) throw new Error("Deploy time is null");

      // Lấy block hiện tại
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const currentBlock = await provider.getBlockNumber();

      // Lấy tất cả events từ block 0 đến block hiện tại
      const events = await contract.queryFilter(
        contract.filters.PositionUpdated(),
        0,
        currentBlock
      );

      // Sắp xếp events theo thời gian
      const sortedEvents = events.sort((a, b) =>
        a.args.timestamp.toNumber() - b.args.timestamp.toNumber()
      );

      return sortedEvents.map(event => ({
        timestamp: event.args.timestamp.toNumber(),
        longAmount: event.args.longAmount,
        shortAmount: event.args.shortAmount
      }));
    } catch (error) {
      console.error("Error fetching position history:", error);
      return [];
    }
  };

  // Thêm hàm helper để tạo các điểm phụ giữa các mốc chính
  const createIntermediatePoints = (startTime: number, endTime: number) => {
    const points: PositionPoint[] = [];
    const interval = 1; // 1 giây cho mỗi điểm
    const totalPoints = Math.floor((endTime - startTime) / interval);

    for (let i = 0; i <= totalPoints; i++) {
      const timestamp = startTime + (i * interval);
      points.push({
        timestamp,
        longPercentage: null,
        shortPercentage: null,
        isMainPoint: false,
        isFixed: false
      });
    }
    return points;
  };

  // Thêm helper function để tạo mẫu dữ liệu ban đầu cho positionHistory
  const createInitialPositionHistory = (startTime: number) => {
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const oneDay = 24 * 60 * 60;

    // Tạo dữ liệu cho 7 ngày trước đó nếu có
    const history = [];

    // Thêm điểm ban đầu (50/50)
    history.push({
      timestamp: startTime,
      longPercentage: 50,
      shortPercentage: 50,
      isMainPoint: true,
      isFixed: true
    });

    return history;
  };

  // Sửa phần xử lý positionHistory trong useEffect
  useEffect(() => {
    if (contractAddress) {
      // Load position history từ localStorage hoặc khởi tạo mới
      const savedHistory = localStorage.getItem(positionHistoryKey);
      if (savedHistory) {
        setPositionHistory(JSON.parse(savedHistory));
      } else if (biddingStartTime) {
        // Khởi tạo history mới với biddingStartTime
        setPositionHistory(createInitialPositionHistory(biddingStartTime));
      }
    }
  }, [contractAddress, biddingStartTime]);

  // Cập nhật positionHistory khi có thay đổi về positions
  useEffect(() => {
    if (!positions || !currentPhase || currentPhase < Phase.Bidding) return;

    const longAmount = positions.long;
    const shortAmount = positions.short;
    const total = longAmount + shortAmount;

    if (total > 0) {
      const longPercentage = (longAmount / total) * 100;
      const shortPercentage = (shortAmount / total) * 100;
      const timestamp = Math.floor(Date.now() / 1000);

      // Thêm điểm mới vào positionHistory nếu có thay đổi đáng kể
      setPositionHistory(prev => {
        // Kiểm tra xem đã có điểm gần đây chưa
        const lastPoint = prev[prev.length - 1];

        // Cập nhật isCurrentPoint cho tất cả các điểm
        const updatedHistory = prev.map(point => ({
          ...point,
          isCurrentPoint: false // Đặt tất cả false trước
        }));

        // Chỉ thêm điểm mới nếu có thay đổi lớn hơn 0.5% hoặc sau 1 giờ
        const significantChange = Math.abs(lastPoint?.longPercentage - longPercentage) > 0.5;
        const timeChange = !lastPoint || (timestamp - lastPoint.timestamp) > 3600;

        if (significantChange || timeChange) {
          const newPoint = {
            timestamp,
            longPercentage,
            shortPercentage,
            isMainPoint: true,
            isFixed: false,
            isCurrentPoint: true // Đánh dấu điểm mới nhất
          };

          const newHistory = [...updatedHistory, newPoint];

          // Lưu vào localStorage
          localStorage.setItem(positionHistoryKey, JSON.stringify(newHistory));
          return newHistory;
        }

        return updatedHistory;
      });
    }
  }, [positions, currentPhase]);

  // Thêm hàm kiểm tra quyền hạn
  const checkPermissions = async () => {
    if (!contract || !walletAddress) return;

    try {
      // Kiểm tra xem contract có hàm owner() không
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

      // Kiểm tra xem có thể gọi hàm resolveMarket không
      try {
        // Chỉ kiểm tra xem hàm có tồn tại không, không thực sự gọi nó
        const resolveFunction = contract.resolveMarket;
        console.log("resolveMarket function exists:", !!resolveFunction);
      } catch (e) {
        console.log("Error checking resolveMarket function:", e);
      }

      // Kiểm tra xem có thể gọi hàm expireMarket không
      try {
        // Chỉ kiểm tra xem hàm có tồn tại không, không thực sự gọi nó
        const expireFunction = contract.expireMarket;
        console.log("expireMarket function exists:", !!expireFunction);
      } catch (e) {
        console.log("Error checking expireMarket function:", e);
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  // Gọi hàm kiểm tra quyền hạn khi component mount
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


  // Thay thế logic kiểm tra phase dựa trên thời gian
  useEffect(() => {
    // Kiểm tra và cập nhật phase dựa trên thời gian hiện tại
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

  // Calculate long and short percentages
  const longPercentage = useMemo(() => {
    const total = positions.long + positions.short;
    return total > 0 ? (positions.long / total) * 100 : 50;
  }, [positions]);

  const shortPercentage = useMemo(() => {
    const total = positions.long + positions.short;
    return total > 0 ? (positions.short / total) * 100 : 50;
  }, [positions]);


  // Format date functions
  const formatDate = (date: Date): string => {
    return format(date, 'MMM dd, yyyy HH:mm');
  };

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

  // Hàm tính toán pot.profit
  const calculatePotentialProfit = (bidAmount: number) => {
    if (!contract || !positions || isNaN(bidAmount) || bidAmount <= 0) {
      setPotentialProfit({ b: 0, c: 0 });
      return;
    }

    const totalDeposited = positions.long + positions.short; // Tổng số tiền đã đặt cược
    const longAmount = positions.long; // Số tiền đã đặt cược ở LONG
    const shortAmount = positions.short; // Số tiền đã đặt cược ở SHORT

    // Tính toán lợi nhuận tiềm năng cho LONG
    let longProfit = (bidAmount * totalDeposited) / (longAmount + bidAmount);

    // Tính toán lợi nhuận tiềm năng cho SHORT
    let shortProfit = (bidAmount * totalDeposited) / (shortAmount + bidAmount);

    // Trừ phí (nếu có)
    const fee = (bidAmount * Number(feePercentage) / 10);
    longProfit -= fee;
    shortProfit -= fee;

    // Đảm bảo b < c
    let b = Math.min(longProfit, shortProfit);
    let c = Math.max(longProfit, shortProfit);
    if (b < 0) {
      b = 0;
    }
    setPotentialProfit({ b, c });
  };

  // Gọi hàm calculatePotentialProfit khi người dùng nhập ETH
  const handleBidAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setBidAmount(value);

    // Tính toán pot.profit
    const numValue = parseFloat(value);
    calculatePotentialProfit(numValue);
  };



  useEffect(() => {
    const priceService = PriceService.getInstance();

    const handlePriceUpdate = (priceData: PriceData) => {
      setCurrentPrice(priceData.price);
    };

    // Subscribe to price updates when component mounts
    priceService.subscribeToPriceUpdates(handlePriceUpdate, 'BTCUSDT', 5000);

    // Cleanup subscription when component unmounts
    return () => {
      priceService.unsubscribeFromPriceUpdates(handlePriceUpdate);
    };
  }, []);

  // Sửa lại useEffect cho price history
  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
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

  // Thêm hàm xử lý resolve và expire


  const handleExpireMarket = async () => {
    if (!contract) return;
    try {
      console.log("Attempting to expire market...");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      // Hiển thị thông báo đang xử lý
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

      // Hiển thị thông báo transaction đã được gửi
      toast({
        title: "Transaction sent",
        description: `Transaction hash: ${tx.hash.substring(0, 10)}...`,
        status: "info",
        duration: 5000,
        isClosable: true,
      });

      await tx.wait();

      // Hiển thị thông báo thành công
      toast({
        title: "Market expired successfully!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Refresh market details
      await fetchMarketDetails();

      // Cập nhật UI ngay lập tức
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

        // Lấy tất cả thông tin cần thiết từ contract
        try {
          const [
            positions,
            strikePriceBN,
            phase,
            biddingStartTime,
            tradingPair,
            deployTimestamp
          ] = await Promise.all([
            contract.positions(),
            contract.strikePrice(),
            contract.currentPhase(),
            contract.biddingStartTime(),
            contract.tradingPair().catch(() => 'Unknown'),
            contract.deployTime()
          ]);

          // Cập nhật states
          setContract(contract);
          setContractAddress(contractAddress);
          setStrikePrice(ethers.utils.formatUnits(strikePriceBN, 0));
          setCurrentPhase(phase);
          setTradingPair(tradingPair);
          setBiddingStartTime(biddingStartTime.toNumber());
          setDeployTime(deployTimestamp.toNumber());
          // Set chart symbol dựa trên trading pair
          const symbol = tradingPair === "BTC/USD" ? "BTCUSDT" :
            tradingPair === "ETH/USD" ? "ETHUSDT" :
              tradingPair === "ICP/USD" ? "ICPUSDT" : "BTCUSDT";
          setChartSymbol(symbol);

          // Cập nhật positions
          setPositions({
            long: parseFloat(ethers.utils.formatEther(positions.long)),
            short: parseFloat(ethers.utils.formatEther(positions.short))
          });

        } catch (error) {
          console.error("Error loading contract data:", error);
          // Set default values nếu có lỗi
          setTradingPair('Unknown');
          setChartSymbol('BTCUSDT');
        }

      } catch (error) {
        console.error("Error:", error);
      }
    };

    loadContractData();
  }, []);

  // Sửa lại useEffect cho price chart
  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
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

  // Add near other state declarations
  const phaseCircleProps = (phase: Phase) => ({
    bg: currentPhase === phase ? "#FEDF56" : "gray.700",
    color: currentPhase === phase ? "black" : "gray.500",
    fontWeight: "bold",
    zIndex: 1
  });

  // Thêm hàm resolve
  const resolve = async () => {
    if (!contract) return;

    try {
      console.log("Attempting to resolve market...");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      // Hiển thị thông báo đang xử lý
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

      // Hiển thị thông báo transaction đã được gửi
      toast({
        title: "Transaction sent",
        description: `Transaction hash: ${tx.hash.substring(0, 10)}...`,
        status: "info",
        duration: 5000,
        isClosable: true,
      });

      await tx.wait();

      // Hiển thị thông báo thành công
      toast({
        title: "Market resolved successfully!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Refresh market details
      await fetchMarketDetails();

      // Cập nhật UI ngay lập tức
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

  // Thêm cleanup khi component unmount
  useEffect(() => {
    return () => {
      if (contractAddress) {
        // Lưu position history cuối cùng vào localStorage
        localStorage.setItem(positionHistoryKey, JSON.stringify(positionHistory));
      }
    };
  }, [contractAddress, positionHistory]);

  // Thêm lại hàm claimReward
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

  // Sửa lại hàm fetchPositionHistory
  const fetchPositionHistory = async () => {
    if (!contract) return [];
    try {
      const deployTime = await contract.deployTime();
      if (!deployTime) throw new Error("Deploy time is null");

      // Lấy block hiện tại
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const currentBlock = await provider.getBlockNumber();

      // Lấy tất cả events từ block 0 đến block hiện tại
      const events = await contract.queryFilter(
        contract.filters.PositionUpdated(),
        0,
        currentBlock
      );

      // Sắp xếp events theo thời gian
      const sortedEvents = events.sort((a, b) =>
        a.args.timestamp.toNumber() - b.args.timestamp.toNumber()
      );

      return sortedEvents.map(event => ({
        timestamp: event.args.timestamp.toNumber(),
        longAmount: event.args.longAmount,
        shortAmount: event.args.shortAmount
      }));
    } catch (error) {
      console.error("Error fetching position history:", error);
      return [];
    }
  };

  // Thêm hàm helper để tạo các điểm phụ giữa các mốc chính
  const createIntermediatePoints = (startTime: number, endTime: number) => {
    const points: PositionPoint[] = [];
    const interval = 1; // 1 giây cho mỗi điểm
    const totalPoints = Math.floor((endTime - startTime) / interval);

    for (let i = 0; i <= totalPoints; i++) {
      const timestamp = startTime + (i * interval);
      points.push({
        timestamp,
        longPercentage: null,
        shortPercentage: null,
        isMainPoint: false,
        isFixed: false
      });
    }
    return points;
  };

  // Sửa lại useEffect xử lý position history
  useEffect(() => {
    if (!contract) return;

    const initializePositionData = async () => {
      try {
        const [deployTime, maturityTime] = await Promise.all([
          contract.deployTime(),
          contract.maturityTime()
        ]);

        const startTime = deployTime.toNumber();
        const endTime = maturityTime.toNumber();
        const mainInterval = Math.floor((endTime - startTime) / 9);

        // Lấy lịch sử bidding
        const bidHistory = await fetchPositionHistory();

        // Tạo các điểm chính và phụ
        const allPoints = [];
        let currentPercentages = { long: 50, short: 50 }; // Bắt đầu với 50-50

        for (let i = 0; i < 10; i++) {
          const timestamp = startTime + (mainInterval * i);

          // Cập nhật tỷ lệ dựa trên lịch sử bid
          const previousBids = bidHistory.filter(bid => bid.timestamp <= timestamp);
          if (previousBids.length > 0) {
            const latestBid = previousBids[previousBids.length - 1];
            const longValue = parseFloat(ethers.utils.formatEther(latestBid.longAmount));
            const shortValue = parseFloat(ethers.utils.formatEther(latestBid.shortAmount));
            const total = longValue + shortValue;

            if (total > 0) {
              currentPercentages = {
                long: (longValue / total) * 100,
                short: (shortValue / total) * 100
              };
            }
          }

          // Thêm điểm chính
          allPoints.push({
            timestamp,
            longPercentage: currentPercentages.long,
            shortPercentage: currentPercentages.short,
            isMainPoint: true,
            isFixed: timestamp < Date.now() / 1000
          });

          // Thêm điểm phụ nếu không phải điểm cuối
          if (i < 9) {
            const intermediatePoints = createIntermediatePoints(
              timestamp,
              startTime + (mainInterval * (i + 1))
            );

            // Áp dụng tỷ lệ hiện tại cho các điểm phụ
            intermediatePoints.forEach(point => {
              const pointTime = point.timestamp;
              const relevantBids = bidHistory.filter(bid => bid.timestamp <= pointTime);

              if (relevantBids.length > 0) {
                const latestBid = relevantBids[relevantBids.length - 1];
                const longValue = parseFloat(ethers.utils.formatEther(latestBid.longAmount));
                const shortValue = parseFloat(ethers.utils.formatEther(latestBid.shortAmount));
                const total = longValue + shortValue;

                if (total > 0) {
                  point.longPercentage = (longValue / total) * 100;
                  point.shortPercentage = (shortValue / total) * 100;
                } else {
                  point.longPercentage = 50;
                  point.shortPercentage = 50;
                }
              } else {
                point.longPercentage = 50;
                point.shortPercentage = 50;
              }

              point.isFixed = pointTime < Date.now() / 1000;
            });

            allPoints.push(...intermediatePoints);
          }
        }

        setPositionHistory(allPoints);
      } catch (error) {
        console.error("Error initializing position data:", error);
      }
    };

    const handlePositionUpdate = async () => {
      try {
        const positions = await contract.positions();
        const longValue = parseFloat(ethers.utils.formatEther(positions.long));
        const shortValue = parseFloat(ethers.utils.formatEther(positions.short));
        const total = longValue + shortValue;

        if (total > 0) {
          const now = Math.floor(Date.now() / 1000);
          const longPercentage = (longValue / total) * 100;
          const shortPercentage = (shortValue / total) * 100;

          setPositionHistory(prevHistory => {
            return prevHistory.map(point => {
              if (point.isFixed) return point;

              if (point.timestamp > now) {
                return {
                  ...point,
                  longPercentage: null,
                  shortPercentage: null,
                  isFixed: false
                };
              }

              return {
                ...point,
                longPercentage,
                shortPercentage,
                isFixed: point.timestamp < now
              };
            });
          });
        }
      } catch (error) {
        console.error("Error handling position update:", error);
      }
    };

    initializePositionData();
    const interval = setInterval(handlePositionUpdate, 100);

    return () => clearInterval(interval);
  }, [contract]);

  // Thêm hàm kiểm tra quyền hạn
  const checkPermissions = async () => {
    if (!contract || !walletAddress) return;

    try {
      // Kiểm tra xem contract có hàm owner() không
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

      // Kiểm tra xem có thể gọi hàm resolveMarket không
      try {
        // Chỉ kiểm tra xem hàm có tồn tại không, không thực sự gọi nó
        const resolveFunction = contract.resolveMarket;
        console.log("resolveMarket function exists:", !!resolveFunction);
      } catch (e) {
        console.log("Error checking resolveMarket function:", e);
      }

      // Kiểm tra xem có thể gọi hàm expireMarket không
      try {
        // Chỉ kiểm tra xem hàm có tồn tại không, không thực sự gọi nó
        const expireFunction = contract.expireMarket;
        console.log("expireMarket function exists:", !!expireFunction);
      } catch (e) {
        console.log("Error checking expireMarket function:", e);
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  // Gọi hàm kiểm tra quyền hạn khi component mount
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

  return (
    <Box bg="black" minH="100vh">
      {/* Header Section */}
      <Flex px={6} py={4} alignItems="center">
        <Button
          leftIcon={<FaChevronLeft />}
          variant="ghost"
          color="#FEDF56"
          onClick={() => router.push('/listaddress')}
          _hover={{ bg: 'rgba(254, 223, 86, 0.1)' }}
        >
          Markets
        </Button>


        <HStack spacing={6} ml="auto" color="#FEDF56">
          <Icon as={FaWallet} />
          <Text> Wallet Address: {walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : 'Not Connected'}</Text>
          <Icon as={FaCoins} />
          <Text>Balance: {Number(balance).toFixed(4)} ETH</Text>
        </HStack>
      </Flex>

      {/* Dòng thứ hai - Thông tin về thị trường */}
      <Box display="flex" alignItems="center" mb={6} ml={6}>
        <HStack>
          {/* Hình ảnh Coin */}
          <Image
            src={`/images/${tradingPair.split('/')[0].toLowerCase()}-logo.png`}
            alt={tradingPair}
            boxSize="50px"
            mr={4}
          />

          <Box>
            <Heading size="md" fontSize="30px">
              <HStack>
                <Text color="#FEDF56" fontSize="30px">
                  {tradingPair}
                </Text>
                <Text color="white" fontSize="25px">
                  will reach ${strikePrice} by {formatMaturityTime(maturityTime)}
                </Text>
              </HStack>
            </Heading>
            <HStack spacing={2}>
              <HStack color="gray.400">
                <PiChartLineUpLight />
                <Text color="gray.400" fontSize="sm">
                  {totalDeposited.toFixed(2)} ETH |
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
            </HStack>
          </Box>
          {(currentPhase === Phase.Maturity || currentPhase === Phase.Expiry) && (
            <Box
              border="1px solid #FEDF56"
              borderRadius="md"
              p={3}
              mb={4}
              textAlign="center"
              ml="100px"
              textColor="white"
            >
              <Text fontWeight="bold">Result: {marketResult}</Text>
            </Box>
          )}
        </HStack>
      </Box>


      {/* Main Content */}
      <Flex direction={{ base: 'column', md: 'row' }} gap={6}>
        {/* Left Side - Charts and Rules */}
        <Box width={{ base: '100%', md: '80%' }} pr={{ base: 0, md: 4 }} ml={4}>
          <Tabs variant="line" colorScheme="yellow">
            <TabList>
              <Tab>Price Chart</Tab>
              <Tab>Position Chart</Tab>
            </TabList>

            <TabPanels>
              <TabPanel p={0} pt={4}>
                <Box position="relative" width="100%">
                  <MarketCharts
                    chartSymbol={chartSymbol}
                    strikePrice={parseFloat(strikePrice) || 0}
                    timeRange={priceTimeRange}
                    chartData={chartData}
                    positionHistory={[]}
                    positions={userPositions}
                    chartType="price"
                    onTimeRangeChange={handleTimeRangeChange}
                    options={{
                      showPrice: true,
                      showPositions: false,
                    }}
                  />
                </Box>
              </TabPanel>

              <TabPanel p={0} pt={4}>
                <MarketCharts
                  chartSymbol={chartSymbol}
                  strikePrice={parseFloat(strikePrice) || 0}
                  timeRange={positionTimeRange}
                  chartData={[]}
                  positionHistory={positionHistory}
                  positions={positions}
                  chartType="position"
                  onTimeRangeChange={handleTimeRangeChange}
                  biddingStartTime={biddingStartTime || Math.floor(Date.now() / 1000) - 3600}
                  maturityTime={maturityTime || Math.floor(Date.now() / 1000) + 3600}
                />
              </TabPanel>
            </TabPanels>
          </Tabs>

          <Box mt={8} border="1px solid #2D3748" borderRadius="xl" p={4}>
            <Heading size="md" mb={4} color="#F0F8FF">Rules:</Heading>
            <Text color="gray.400" mb={3}>
              This is a binary option market where users can place bids on whether the price will be above (LONG) or below (SHORT) the strike price: {strikePrice} USD at maturity. The market goes through four phases: Trading, Bidding, Maturity, and Expiry.
            </Text>
            <Text color="gray.400" mb={3}>
              During the Trading phase, users can view the market but cannot place bids. In the Bidding phase, users can place LONG or SHORT bids. At Maturity, the final price is determined and winners can claim their rewards. In the Expiry phase, the market is closed and all rewards are distributed.
            </Text>
            <Text color="gray.400" mb={3}>
              The potential profit depends on the ratio of LONG to SHORT bids. If more users bet against you, your potential profit increases. A fee of {Number(feePercentage) / 10}% is charged on all bids to maintain the platform.
            </Text>
            <Text color="gray.400">
              Price data is sourced from cryptocurrency exchanges to ensure accurate and reliable market prices.
            </Text>
            <Box display="flex" alignItems="center" fontSize="lg">
              <Text color="white">Learn more at</Text>
              <Image src="/images/coinbase.png" alt="Coinbase" boxSize="15px" display="inline" mx={1} />
              <Link href="https://www.coinbase.com/explore" isExternal color="blue.400" display="flex" alignItems="center">
                Coinbase
                <FaExternalLinkAlt style={{ marginLeft: '5px', fontSize: '12px', verticalAlign: 'middle' }} />
              </Link>
            </Box>

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
              <Flex justify="space-between" align="center" mt={2}>
                <Text color="gray.400">Final Price:</Text>
                <Text fontWeight="bold">{finalPrice} USD</Text>
              </Flex>
            )}
          </Box>

          <Box
            bg="gray.800"
            p={4}
            borderRadius="xl"
            mb={4}
            borderWidth={1}
            borderColor="gray.700"
          >
            {/* Tỷ lệ LONG/SHORT */}
            <Flex
              align="center"
              w="100%"
              h="25px"
              borderRadius="full"
              bg="gray.800"
              border="1px solid"
              borderColor="gray.600"
              position="relative"
              overflow="hidden"
              boxShadow="inset 0 1px 3px rgba(0,0,0,0.6)"
              mb={4}
            >
              {/* LONG Section */}
              <Box
                width={`${longPercentage}%`}
                bgGradient="linear(to-r, #0f0c29, #00ff87)"
                transition="width 0.6s ease"
                h="full"
                display="flex"
                alignItems="center"
                justifyContent="flex-end"
                pr={3}
                position="relative"
                zIndex={1}
              >
                {longPercentage > 8 && (
                  <Text
                    fontSize="sm"
                    fontWeight="bold"
                    color="whiteAlpha.800"
                  >
                    {longPercentage.toFixed(0)}%
                  </Text>
                )}
              </Box>

              {/* SHORT Section (in absolute layer for smooth overlap) */}
              <Box
                position="absolute"
                right="0"
                top="0"
                h="100%"
                width={`${shortPercentage}%`}
                bgGradient="linear(to-r, #ff512f, #dd2476)"
                transition="width 0.6s ease"
                display="flex"
                alignItems="center"
                justifyContent="flex-start"
                pl={3}
                zIndex={0}
              >
                {shortPercentage > 8 && (
                  <Text
                    fontSize="sm"
                    fontWeight="bold"
                    color="whiteAlpha.800"
                  >
                    {shortPercentage.toFixed(0)}%
                  </Text>
                )}
              </Box>
            </Flex>

            <HStack spacing={4} mb={3} ml={2} mr={2}>
              <Button
                border="1px solid"
                borderColor="gray.300"
                borderRadius="20px"
                colorScheme="gray"
                bg="gray.600"
                width="50%"
                onClick={() => handleBid(Side.Long)}
                isLoading={isResolving}
                loadingText="Bidding..."
                leftIcon={<FaArrowUp />}
                textColor="#28a745"
                textShadow="1px 1px 12px rgba(40, 167, 69, 0.7)"
                isDisabled={!isConnected || parseFloat(bidAmount) <= 0 || currentPhase !== Phase.Bidding}
                _hover={{
                  bg: "gray.700",
                  boxShadow: "0 4px 8px rgba(40, 167, 69, 0.2)",
                }}
                _active={{
                  bg: "gray.800",
                  transform: "scale(0.98)",
                }}
              >
                UP
              </Button>
              <Button
                border="1px solid"
                borderColor="gray.300"
                borderRadius="20px"
                colorScheme="gray"
                bg="gray.600"
                textColor="#dc3545"
                textShadow="1px 1px 12px rgba(220, 53, 69, 0.7)"
                width="50%"
                onClick={() => handleBid(Side.Short)}
                isLoading={isResolving}
                loadingText="Bidding..."
                leftIcon={<FaArrowDown />}
                isDisabled={!isConnected || parseFloat(bidAmount) <= 0 || currentPhase !== Phase.Bidding}
                _hover={{
                  bg: "gray.700",
                  boxShadow: "0 4px 8px rgba(220, 53, 69, 0.2)",
                }}
                _active={{
                  bg: "gray.800",
                  transform: "scale(0.98)",
                }}
              >
                DOWN
              </Button>
            </HStack>


            {/* Bidding */}
            <FormControl mb={2} mt={6} color="white">
              <FormLabel>You're betting</FormLabel>
              <Input
                placeholder="0.0000"
                value={bidAmount}
                onChange={e => setBidAmount(e.target.value)}
                onChange={handleBidAmountChange}
                mb={2}
                isDisabled={currentPhase !== Phase.Bidding}
              />
            </FormControl>

            <HStack spacing={2} mt={1} mb={4} ml={2} mr={2} alignItems="center" justifyContent="center">
              <Button
                width="180px"
                alignItems="center"
                justifyContent="center"
                bg="#3131f7"
                color="white"
                _hover={{ bg: "#0000f7" }}
              >
                Betting to rich
              </Button>
            </HStack>

            <Flex justify="space-between" mb={4}>
              <Text color="gray.400">Pot. profit:</Text>
              <Text color="white">
                {potentialProfit.b.toFixed(4)} -> {potentialProfit.c.toFixed(4)} ETH
              </Text>
            </Flex>
            <Flex justify="space-between" mb={4}>
              <Text color="gray.400">Fee:</Text>
              <Text color="white">{Number(feePercentage) / 10}%</Text>
            </Flex>

            {/* Your Position */}
            <Text fontSize="lg" fontWeight="bold" mb={3} color="#FEDF56">Your Position</Text>
            <Flex justify="space-between" mb={2}>
              <Text color="green.400">LONG:</Text>
              <Text color="white">{userPositions.long.toFixed(4)} ETH</Text>
            </Flex>
            <Flex justify="space-between">
              <Text color="red.400">SHORT:</Text>
              <Text color="white">{userPositions.short.toFixed(4)} ETH</Text>
            </Flex>
          </Box>
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
            bg="#21201d" // Màu nền cho box lớn
            p={4}
            borderRadius="xl"
            borderWidth={1}
            borderColor="gray.700"
            borderRadius="30px"
            boxShadow="md"
            position="relative" // Để cho box con có thể đè lên
            height="282px"
          >
            <Text fontSize="lg" fontWeight="bold" mb={4} color="#FEDF56" textAlign="center">
              Market is Live
            </Text>

            <Box
              bg="gray.800" // Màu nền cho box chứa các phase
              p={4}
              borderRadius="xl"
              borderWidth={1}
              borderColor="gray.700"
              borderRadius="30px"
              position="absolute" // Để box này đè lên box lớn
              top="55px" // Đặt vị trí để không che tiêu đề
              left="0"
              right="0"
              zIndex={1} // Đảm bảo box này nằm trên cùng

            >
              <VStack align="stretch" spacing={3} position="relative">
                {/* Vertical Line */}
                <Box
                  position="absolute"
                  left="12px"
                  top="30px"
                  bottom="20px"
                  width="2px"
                  bg="gray.700"
                  zIndex={0}
                />

                {/* Trading Phase */}
                <HStack spacing={4}>
                  <Circle size="25px" {...phaseCircleProps(Phase.Trading)}>1</Circle>
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" color={currentPhase === Phase.Trading ? "#FEDF56" : "gray.500"}>
                      Trading
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {deployTime ? new Date(deployTime * 1000).toLocaleString() : 'Pending'}
                    </Text>
                  </VStack>
                </HStack>

                {/* Bidding Phase */}
                <HStack spacing={4}>
                  <Circle size="25px" {...phaseCircleProps(Phase.Bidding)}>2</Circle>
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" color={currentPhase === Phase.Bidding ? "#FEDF56" : "gray.500"}>
                      Bidding
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {biddingStartTime ? new Date(biddingStartTime * 1000).toLocaleString() : 'Waiting for Start'}
                    </Text>
                  </VStack>
                </HStack>

                {/* Maturity Phase with Resolve Button */}
                <HStack spacing={4} justify="space-between">
                  <HStack spacing={4}>
                    <Circle size="25px" {...phaseCircleProps(Phase.Maturity)}>3</Circle>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm" color={currentPhase === Phase.Maturity ? "#FEDF56" : "gray.500"}>
                        Maturity
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {maturityTime ? formatTimeToLocal(maturityTime) : 'Pending'}
                      </Text>
                    </VStack>
                  </HStack>

                  {/* Resolve Button - Hiển thị khi canResolve = true */}
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
                    >
                      Resolve
                    </Button>
                  )}
                </HStack>

                {/* Expiry Phase */}
                <HStack spacing={4} justify="space-between">
                  <HStack spacing={4}>
                    <Circle size="25px" {...phaseCircleProps(Phase.Expiry)}>4</Circle>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm" color={currentPhase === Phase.Expiry ? "#FEDF56" : "gray.500"}>
                        Expiry
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {maturityTime ? formatTimeToLocal(maturityTime + 30) : 'Pending'}
                      </Text>
                    </VStack>
                  </HStack>

                  {/* Expire Button - Hiển thị khi ở phase Maturity và đã resolve */}
                  {currentPhase === Phase.Maturity && finalPrice && (
                    <Button
                      onClick={handleExpireMarket}
                      size="sm"
                      colorScheme="yellow"
                      bg="#FEDF56"
                      color="black"
                      _hover={{ bg: "#FFE56B" }}
                      isLoading={isExpiringMarket}
                      loadingText="Expiring"
                    >
                      Expire
                    </Button>
                  )}
                </HStack>
              </VStack>
            </Box>

            {/* Claim Button - Hiển thị khi có reward và ở phase Expiry */}
            {reward > 0 && currentPhase === Phase.Expiry && (
              <Button
                onClick={claimReward}
                colorScheme="yellow"
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