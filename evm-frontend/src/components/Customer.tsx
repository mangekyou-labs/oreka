import React, { useState, useEffect, useRef } from 'react';
import { useCallback } from 'react'; // Thêm import useCallback
import { 
  Flex, Box, Text, Button, VStack, useToast, Input, 
  Select, HStack, Icon, ScaleFade, Table, Thead, Tbody,Tab, Tr, Th, Td, Spacer, Tabs, TabList, TabPanels, TabPanel, Circle
} from '@chakra-ui/react';
import { FaEthereum, FaWallet, FaTrophy, FaChevronLeft, FaShare } from 'react-icons/fa';
import { ethers } from 'ethers';
import { BigNumber } from 'ethers';
import { motion, useAnimation } from 'framer-motion';
import Owner from './Owner';
import BinaryOptionMarket from '../../../out/BinaryOptionMarket.sol/BinaryOptionMarket.json';
import { PriceService, PriceData } from '../services/PriceService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SiBitcoinsv } from 'react-icons/si';
import { useRouter } from 'next/router'; // Thêm import này
import { getContractTradingPair, getChartSymbol } from '../config/tradingPairs';
import { useAuth } from '../context/AuthContext';
import MarketCharts from './charts/MarketCharts';

enum Side { Long, Short }
enum Phase {Trading,Bidding, Maturity, Expiry }


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
  isFixed: boolean; // Thêm flag để đánh dấu điểm đã cố định
}

// Thêm interface cho event history
interface BidEvent {
  timestamp: number;
  longAmount: BigNumber;
  shortAmount: BigNumber;
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

function Customer() {
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
  const [contractAddress, setContractAddress] = useState('');
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
  const router = useRouter(); // Thêm hook useRouter
  //const contractAddress = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";  // Địa chỉ contract của bạn
  useEffect(() => {
    // Đọc địa chỉ từ localStorage khi component mount
    const savedAddress = localStorage.getItem('selectedContractAddress');
    if (savedAddress) {
        setContractAddress(savedAddress);
    }
  }, []);

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

  // Lấy trạng thái từ smart contract
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
        shortPosition
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
        contract.shortBids(walletAddress)
      ]);

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
      setTradingPair(tradingPair);
      setOracleDetails(oracleDetails);
      setTotalDeposited(parseFloat(ethers.utils.formatEther(totalDeposited)));
      setDeployTime(deployTime.toNumber());
      setBiddingStartTime(Number(biddingStartTime));
      setResolveTime(Number(resolveTime));

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
  };

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

  // Thêm hàm kiểm tra kết quả market
  const handleCoinSelect = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    const coin = availableCoins.find(c => c.value === selectedValue);
    setSelectedSide(coin?.value === "0x7fbdb2315678afecb367f032d93f642f64180aa3" ? Side.Long : Side.Short);

    if (coin) {
      try {
        // Chỉ cần subscribe price updates cho coin mới
        const priceService = PriceService.getInstance();
        const symbol = coinSymbols[coin.value];
        priceService.subscribeToPriceUpdates((data) => {
          setCurrentPrice(data.price);
        }, symbol, 5000);
        
      } catch (error) {
        console.error("Error in handleCoinSelect:", error);
      }
    }
  };

  // Sửa lại handleBid
  const handleBid = async (side: Side) => {
    if (!contract || !bidAmount) return;

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
      // Kết nối contract với signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      const tx = await contractWithSigner.expireMarket({
        gasLimit: 500000
      });
      await tx.wait();
      
      toast({
        title: "Market expired successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Refresh market details
      await fetchMarketDetails();
    } catch (error: any) {
      console.error("Error expiring market:", error);
      toast({
        title: "Failed to expire market",
        description: error.message || "An unexpected error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
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
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const contractWithSigner = contract.connect(signer);

        const tx = await contractWithSigner.resolveMarket({
            gasLimit: 500000
        });
        await tx.wait();

        toast({
            title: "Market resolved successfully!",
            status: "success",
            duration: 3000,
            isClosable: true,
        });

        // Refresh market details
        await fetchMarketDetails();
    } catch (error: any) {
        console.error("Error resolving market:", error);
        toast({
            title: "Failed to resolve market",
            description: error.message || "An unexpected error occurred",
            status: "error",
            duration: 5000,
            isClosable: true,
        });
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
        <Spacer />
      </Flex>

      {/* Main Content */}
      <Flex p={6}>
        <Box flex="0.7" pr={6}>
          {/* Market Selection & Info */}
          <VStack align="start" spacing={4} mb={6}>
            <HStack>
              <Icon as={SiBitcoinsv} boxSize={6} color="#FEDF56" />
              <Text fontSize="2xl" fontWeight="bold" color="#FEDF56">
                {tradingPair || 'Unknown'}
              </Text>
            </HStack>
            <HStack color="gray.400" fontSize="sm">
              <Text>{totalDeposited.toFixed(4)} ETH deposited</Text>
              <Text>•</Text>
              <Text>Phase: {Phase[currentPhase]}</Text>
            </HStack>
          </VStack>

          {/* Thông báo kết quả - Đã di chuyển lên trên và thêm style mới */}
          {(currentPhase === Phase.Maturity || currentPhase === Phase.Expiry) && marketResult && (
            <Box 
              mb={6} 
              p={3} 
              borderWidth="1px" 
              borderColor="#FEDF56" 
              borderRadius="md"
              display="flex"
              justifyContent="center"
              alignItems="center"
            >
              <Text
                color="#FEDF56"
                fontSize="xl"
                fontWeight="bold"
              >
                {marketResult}
              </Text>
            </Box>
          )}

          {/* Chart Section */}
          <MarketCharts 
            chartData={chartData}
            positionHistory={positionHistory}
            positions={positions}
          />

          {/* Strike/Final Price Display */}
          <Box p={4} border="1px solid #2D3748" borderRadius="xl">
            <Text 
              fontSize="xl" 
              color="#FEDF56" 
                  textAlign="center"
              fontWeight="bold"
            >
              {currentPhase >= Phase.Maturity && finalPrice
                ? `Final Price: ${finalPrice} USD`
                : `Strike Price: ${strikePrice} USD`
              }
                  </Text>
                </Box>

          
        </Box>

        {/* Right Column - 30% */}
        <Box flex="0.3">
          {!isConnected ? (
            <Button
              onClick={connectWallet}
              backgroundColor="#FEDF56"
              color="#5D3A1A"
              _hover={{ backgroundColor: "#D5D5D5" }}
              padding="25px"
              borderRadius="full"
              fontWeight="bold"
              fontSize="xl"
              w="full"
            >
              Login / Connect Wallet
            </Button>
          ) : (
            <VStack spacing={4}>
              {/* Wallet Info */}
              <HStack justify="space-between" width="100%">
                <HStack>
                  <Icon as={FaWallet} />
                  <Text color="#FEDF56">{abbreviateAddress(walletAddress)}</Text>
                </HStack>
                <HStack>
                  <Icon as={FaEthereum} />
                  <Text color="#FEDF56">{parseFloat(balance).toFixed(4)} ETH</Text>
                </HStack>
              </HStack>

              {/* Position Distribution */}
              <Flex justify="space-between" width="100%">
                <Text color="green.400">Long {((positions.long / totalDeposited) * 100 || 0).toFixed(1)}%</Text>
                <Text color="red.400">Short {((positions.short / totalDeposited) * 100 || 0).toFixed(1)}%</Text>
              </Flex>

              {/* Trading Section */}
              <VStack spacing={4} width="100%">
                  <Input
                    placeholder="Enter bid amount in ETH"
                    value={bidAmount}
                    onChange={(e) => {
                    if (/^\d*\.?\d*$/.test(e.target.value)) setBidAmount(e.target.value);
                    }}
                    bg="transparent"
                  color="#FEDF56"
                  borderColor="#2D3748"
                  isDisabled={currentPhase !== Phase.Bidding}
                  _disabled={{
                    opacity: 0.6,
                    cursor: "not-allowed"
                  }}
                />

                {/* Bid Buttons */}
                <Flex width="100%" gap={4}>
                    <Button
                      onClick={() => handleBid(Side.Long)}
                    isDisabled={currentPhase !== Phase.Bidding || canResolve}
                    bg={userPosition === Side.Long ? "#00FF00" : "#00EE00"}
                      color="black"
                    width="50%"
                    height="48px"
                    fontSize="lg"
                    fontWeight="bold"
                    _hover={{ bg: currentPhase === Phase.Bidding ? "#00FF00" : "#00EE00" }}
                    opacity={userPosition === Side.Long ? 1 : 0.8}
                      transition="all 0.2s"
                    title={currentPhase !== Phase.Bidding ? "Bidding is only available during Bidding phase" : ""}
                    >
                    UP
                    </Button>

                    <Button
                      onClick={() => handleBid(Side.Short)}
                    isDisabled={currentPhase !== Phase.Bidding || canResolve}
                    bg={userPosition === Side.Short ? "#FF1111" : "#FF0033"}
                      color="black"
                    width="50%"
                    height="48px"
                    fontSize="lg"
                    fontWeight="bold"
                    _hover={{ bg: currentPhase === Phase.Bidding ? "#FF1111" : "#FF0033" }}
                    opacity={userPosition === Side.Short ? 1 : 0.8}
                      transition="all 0.2s"
                    title={currentPhase !== Phase.Bidding ? "Bidding is only available during Bidding phase" : ""}
                    >
                    DOWN
                    </Button>
                  </Flex>
              </VStack>

              {/* Position Info */}
              <Box border="1px solid #2D3748" borderRadius="xl" p={4} width="100%">
                <Text color="#FEDF56" mb={4}>Your Positions</Text>
                <VStack align="stretch" spacing={2}>
                  <Flex justify="space-between">
                    <Text color="green.400">Long:</Text>
                    <Text color="#FEDF56">{userPositions.long.toFixed(4)} ETH</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text color="red.400">Short:</Text>
                    <Text color="#FEDF56">{userPositions.short.toFixed(4)} ETH</Text>
                  </Flex>
                </VStack>
              </Box>

              {/* Phase Timeline Box */}
              <Box 
                border="1px solid #2D3748" 
                borderRadius="xl" 
                p={4}
                width="100%"
                bg="black"
              >
                <Text color="#FEDF56" fontSize="lg" fontWeight="bold" mb={3}>
                  Market is Live
                </Text>

                <VStack align="stretch" spacing={3} position="relative">
                  {/* Vertical Line */}
                  <Box
                    position="absolute"
                    left="15px"
                    top="30px"
                    bottom="15px"
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
                  <HStack spacing={4}>
                    <Circle size="25px" {...phaseCircleProps(Phase.Maturity)}>3</Circle>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm" color={currentPhase === Phase.Maturity ? "#FEDF56" : "gray.500"}>
                        Maturity
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {maturityTime ? new Date(maturityTime * 1000).toLocaleString() : 'Pending'}
                      </Text>
                    </VStack>
                  </HStack>

                  {/* Expiry Phase with Expire Button */}
                  <HStack spacing={4} justify="space-between">
                    <HStack spacing={4}>
                      <Circle size="25px" {...phaseCircleProps(Phase.Expiry)}>4</Circle>
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" color={currentPhase === Phase.Expiry ? "#FEDF56" : "gray.500"}>
                          Expiry
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {maturityTime ? new Date((maturityTime + 30) * 1000).toLocaleString() : 'Pending'}
                        </Text>
                      </VStack>
                    </HStack>
                    {/* Expire Button - Chỉ hiển thị khi canExpire = true */}
                    {canExpire && (
          <Button
                        onClick={handleExpireMarket}
                        size="sm"
                        colorScheme="yellow"
                        bg="#FEDF56"
                        color="black"
                        _hover={{ bg: "#FFE56B" }}
                      >
                        Expire
          </Button>
        )}
                  </HStack>
      </VStack>
              </Box>

              {/* Claim Button */}
              {reward > 0 && showClaimButton && (
                <Button
                  onClick={claimReward}
                  colorScheme="yellow"
                  isDisabled={reward === 0}
                  width="100%"
                >
                  Claim {reward.toFixed(4)} ETH
                </Button>
              )}
            </VStack>
          )}
        </Box>
    </Flex>
    </Box>
  );
}

export default Customer;