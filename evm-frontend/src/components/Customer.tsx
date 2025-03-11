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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SiBitcoinsv } from 'react-icons/si';
import { useRouter } from 'next/router'; // Thêm import này

enum Side { Long, Short }
enum Phase {Trading,Bidding, Maturity, Expiry }

interface Coin {
  value: string;
  label: string;
}

// Thêm interface cho symbol mapping
interface CoinSymbol {
  [key: string]: string;
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedSide, setSelectedSide] = useState<Side | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [balance, setBalance] = useState(0);
  const [contractBalance, setContractBalance] = useState(0);
  const [accumulatedWinnings, setAccumulatedWinnings] = useState(0);
  const [bidAmount, setBidAmount] = useState("");
  const [currentPhase, setCurrentPhase] = useState<Phase>(Phase.Bidding);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [strikePrice, setStrikePrice] = useState<string>('');
  const [finalPrice, setFinalPrice] = useState<string>('');
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
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

  // Thêm mapping từ contract address sang symbol Binance
  const coinSymbols: CoinSymbol = {
    "0x5fbdb2315678afecb367f032d93f642f64180aa3": "ICPUSDT", // ICP/USD
    "0x6fbdb2315678afecb367f032d93f642f64180aa3": "ETHUSDT", // ETH/USD 
    "0x7fbdb2315678afecb367f032d93f642f64180aa3": "BTCUSDT"  // BTC/USD
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
      if (isLoggedIn && contractAddress) {
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
  }, [isLoggedIn, contractAddress]);

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

const fetchBalance = async () => {
  if (walletAddress) {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum, providerConfig);
      const balanceWei = await provider.getBalance(walletAddress);
      setBalance(parseFloat(ethers.utils.formatEther(balanceWei)));
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }
};

useEffect(() => {
  fetchBalance();
}, [walletAddress, contract]);

  // Sửa lại connectWallet
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const { provider, signer } = await getProviderAndSigner();
        const address = await signer.getAddress();
        const balanceWei = await provider.getBalance(address);
        setWalletAddress(address);
        setBalance(parseFloat(ethers.utils.formatEther(balanceWei)));
        setIsLoggedIn(true);
      } catch (error) {
        console.error("Failed to connect wallet:", error);
      }
    }
  };

  // Lấy trạng thái từ smart contract
  const fetchMarketDetails = async () => {
    if (!contract) return;
    try {
      const phase = await contract.currentPhase();
      const oracleDetails = await contract.oracleDetails();
      
      setCurrentPhase(phase);
      setStrikePrice(Number(ethers.utils.formatUnits(oracleDetails.strikePrice, 0)).toString());
      
      // Lấy finalPrice nếu đã vào phase Maturity hoặc Expiry
      if (phase === Phase.Maturity || phase === Phase.Expiry) {
        setFinalPrice(Number(ethers.utils.formatUnits(oracleDetails.finalPrice, 0)).toString());
      }

      const positions = await contract.positions();
      
      const longPos = parseFloat(ethers.utils.formatEther(positions.long));
      const shortPos = parseFloat(ethers.utils.formatEther(positions.short));
      
      setPositions({ long: longPos, short: shortPos });
      setTotalDeposited(longPos + shortPos);

      // Lưu positions vào localStorage với contract address
      const positionsData = {
        address: contractAddress,
        longAmount: longPos.toFixed(4),
        shortAmount: shortPos.toFixed(4)
      };
      localStorage.setItem(`positions_${contractAddress}`, JSON.stringify(positionsData));

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

      if (finalPrice >= strikePrice) {
        setMarketResult('LONG IS WIN');
      } else {
        setMarketResult('SHORT IS WIN');
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

  // Thêm useEffect để kiểm tra thời gian
  useEffect(() => {
    const checkTiming = async () => {
      if (!contract) return;
      
      try {
        const biddingStartTime = await contract.biddingStartTime();
        const resolveTime = await contract.resolveTime();
        const resolveDelay = await contract.RESOLVE_DELAY();
        const expireDelay = await contract.EXPIRE_DELAY();
        
        const now = Math.floor(Date.now() / 1000);
        setCanResolve(now >= biddingStartTime.toNumber() + resolveDelay.toNumber());
        setCanExpire(resolveTime.toNumber() > 0 && now >= resolveTime.toNumber() + expireDelay.toNumber());
      } catch (error) {
        console.error("Error checking timing:", error);
      }
    };

    const interval = setInterval(checkTiming, 1000);
    return () => clearInterval(interval);
  }, [contract]);

  // Thay vào đó, tự động kết nối khi component mount
  useEffect(() => {
    const autoConnect = async () => {
      if (!isLoggedIn) {
        await connectWallet();
      }
    };
    autoConnect();
  }, []);

  // Sửa lại handleCoinSelect
  const handleCoinSelect = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    const coin = availableCoins.find(c => c.value === selectedValue);
    setSelectedCoin(coin || null);

    if (contract && coin) {
      try {
        const oracleDetails = await contract.oracleDetails();
        setStrikePrice(Number(ethers.utils.formatUnits(oracleDetails.strikePrice, 0)).toString());

        // Subscribe to new price updates for selected coin
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
    if (!contract || !bidAmount || Number(bidAmount) <= 0) return;

    try {
      // Kiểm tra phase
      if (currentPhase !== Phase.Bidding) {
        toast({
          title: "Error",
          description: "Not in Bidding phase",
          status: "error",
          duration: 3000,
        });
        return;
      }

      console.log("Placing bid:", {
        side: side,
        amount: bidAmount,
        phase: currentPhase
      });

      // Convert bid amount to Wei
      const bidAmountWei = ethers.utils.parseEther(bidAmount);
      
      // Gọi hàm bid của contract với value là số ETH đặt cược
      const tx = await contract.bid(side, { 
        value: bidAmountWei,
        gasLimit: 500000 
      });
      await tx.wait();

      // Lưu lại lệnh người dùng đã đặt
      setUserPosition(side);
      setSelectedSide(side);

      // Cập nhật UI sau khi đặt cược thành công
      await Promise.all([
        fetchMarketDetails(),
        fetchBalance()
      ]);

      // Reset bid amount
      setBidAmount("");

      // Hiển thị thông báo thành công
      toast({
        title: "Bid placed successfully",
        description: `Placed ${bidAmount} ETH on ${side === Side.Long ? 'UP' : 'DOWN'}`,
        status: "success",
        duration: 3000,
      });

    } catch (error: any) {
      console.error("Error placing bid:", error);
      toast({
        title: "Error placing bid",
        description: error.message || "Something went wrong",
        status: "error",
        duration: 3000,
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

  // Hàm claimReward khi phase là Expiry
  const claimReward = async () => {
    if (!contract || currentPhase !== Phase.Expiry) return;

    try {
      const tx = await contract.claimReward();
      await tx.wait();

      // Update states after successful claim
      await Promise.all([
        fetchMarketDetails(),
        fetchContractBalance()
      ]);

      setShowClaimButton(false);
      setReward(0);

    } catch (error) {
      console.error("Error claiming reward:", error);
      toast({
        title: "Error claiming reward",
        status: "error",
        duration: 3000,
      });
    }
  };
  
  
  const canClaimReward = useCallback(async () => {
    if (contract && currentPhase === Phase.Expiry) {
      console.log("Checking claim eligibility..."); // Log để kiểm tra
      try {
        const hasClaimed = await contract.hasClaimed(walletAddress);
        console.log("Has claimed:", hasClaimed); // Log giá trị hasClaimed
        const oracleDetails = await contract.oracleDetails();
        const finalPriceBN = BigNumber.from(oracleDetails.finalPrice);
        const strikePriceBN = BigNumber.from(oracleDetails.strikePrice);

        const finalPrice = parseFloat(ethers.utils.formatUnits(finalPriceBN, 0)); // Chuyển đổi giá trị cuối
        const strikePrice = parseFloat(ethers.utils.formatUnits(strikePriceBN, 0)); // Chuyển đổi giá trị strike    

        // Sửa lại việc kiểm tra `finalPrice` và `strikePrice`
        let winningSide = finalPrice >= strikePrice ? Side.Long : Side.Short;

        let userDeposit = 0;
        if (winningSide === selectedSide) {
          // Nếu người chơi chọn đúng bên thắng, kiểm tra khoản cược
          userDeposit = winningSide === Side.Long ? await contract.longBids(walletAddress) : await contract.shortBids(walletAddress);
        }

        console.log("Winning side:", winningSide); // Log bên thắng
        console.log("User deposit:", userDeposit); // Log số tiền cược của người dùng

        // Đảm bảo tính toán phần thưởng và cập nhật biến `reward`
        if (!hasClaimed && userDeposit > 0) {
          const totalWinningDeposits = winningSide === Side.Long ? positions.long : positions.short;
          const calculatedReward = ((userDeposit * totalDeposited) / totalWinningDeposits)*0.90;

          const formattedReward = parseFloat(ethers.utils.formatEther(calculatedReward.toString()));
          setReward(formattedReward);  // Cập nhật phần thưởng
          setShowClaimButton(true);
        } else {
          setShowClaimButton(false);
        }
      } catch (error) {
        console.error("Error checking claim eligibility:", error);
        setShowClaimButton(false);
      }
    }
  }, [contract, currentPhase, walletAddress, selectedSide, positions, totalDeposited]);


useEffect(() => {
    console.log("Current phase:", currentPhase); // Log giá trị currentPhase
    if (currentPhase === Phase.Expiry) {
      canClaimReward();
    }
  }, [contract, currentPhase, walletAddress, selectedSide]);

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
      if (selectedCoin) {
        try {
          const priceService = PriceService.getInstance();
          // Lấy symbol tương ứng với contract address
          const symbol = coinSymbols[selectedCoin.value];
          const klines = await priceService.fetchKlines(symbol, '1m', 100);
          setChartData(klines);
        } catch (error) {
          console.error("Error fetching price history:", error);
        }
      }
    };

    fetchPriceHistory();
    const interval = setInterval(fetchPriceHistory, 60000);
    return () => clearInterval(interval);
  }, [selectedCoin]);

  // Thêm hàm xử lý resolve và expire
  const handleResolveMarket = async () => {
    try {
      const tx = await contract.resolveMarket();
      await tx.wait();
      toast({
        title: "Market resolved successfully",
        status: "success",
        duration: 3000,
      });
      await fetchMarketDetails();
    } catch (error: any) {
      toast({
        title: "Error resolving market",
        description: error.message,
        status: "error",
        duration: 3000,
      });
    }
  };

  const handleExpireMarket = async () => {
    try {
      const tx = await contract.expireMarket();
      await tx.wait();
      toast({
        title: "Market expired successfully",
        status: "success",
        duration: 3000,
      });
      await fetchMarketDetails();
    } catch (error: any) {
      toast({
        title: "Error expiring market",
        description: error.message,
        status: "error",
        duration: 3000,
      });
    }
  };

  useEffect(() => {
    const loadContractData = async () => {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contractAddress = localStorage.getItem('selectedContractAddress');
        
        if (!contractAddress) {
          console.error("No contract address found");
          return;
        }

        const contract = new ethers.Contract(
          contractAddress,
          BinaryOptionMarket.abi,
          provider
        );

        // Lấy strikePrice từ contract
        const strikePriceFromContract = await contract.strikePrice();
        setStrikePrice(strikePriceFromContract.toString());

        // Lấy oracleDetails để có finalPrice
        const oracleDetails = await contract.oracleDetails();
        if (oracleDetails && oracleDetails.finalPrice) {
          setFinalPrice(oracleDetails.finalPrice);
        }

        console.log("Contract data loaded:", {
          strikePrice: strikePriceFromContract.toString(),
          finalPrice: oracleDetails?.finalPrice || 'Not set'
        });

      } catch (error) {
        console.error("Error loading contract data:", error);
      }
    };

    loadContractData();
  }, []);

  return (
    <Box bg="black" minH="100vh">
      {/* Header Section */}
      <Flex px={6} py={4} alignItems="center">
        <Button 
          leftIcon={<FaChevronLeft />} 
          variant="ghost" 
          color="#FEDF56"
          onClick={() => router.push('/listaddress')} // Thêm onClick handler
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
              {isLoggedIn && (
                <Select 
                  placeholder="Select Market"
                  value={selectedCoin?.value || ''}
                  onChange={handleCoinSelect}
                  variant="unstyled"
                  color="#FEDF56"
                  fontSize="2xl"
                  fontWeight="bold"
                >
                  {availableCoins.map((coin) => (
                    <option key={coin.value} value={coin.value} style={{background: "black"}}>
                      {coin.label}
                    </option>
                  ))}
                </Select>
              )}
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
          <Tabs variant="line" colorScheme="yellow" mb={6}>
            <TabList borderBottom="1px solid #2D3748">
              <Tab color="#FEDF56" _selected={{ color: "#FEDF56", borderColor: "#FEDF56" }}>Price Chart</Tab>
              <Tab color="#FEDF56" _selected={{ color: "#FEDF56", borderColor: "#FEDF56" }}>Position Chart</Tab>
            </TabList>
            <TabPanels>
              <TabPanel p={0} pt={4}>
                <Box h="400px" border="1px solid #2D3748" borderRadius="xl" p={4}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis 
                        dataKey="time" 
                        tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                        stroke="#FEDF56"
                      />
                      <YAxis domain={['auto', 'auto']} stroke="#FEDF56" />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: '#000', 
                          border: '1px solid #FEDF56',
                          color: '#FEDF56'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="close" 
                        stroke="#FEDF56" 
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </TabPanel>
              <TabPanel p={0} pt={4}>
                <Box h="400px" border="1px solid #2D3748" borderRadius="xl" p={4}>
                  {/* Position Chart Content */}
                </Box>
              </TabPanel>
            </TabPanels>
          </Tabs>

          {/* Strike/Final Price Display */}
          <Box p={4} border="1px solid #2D3748" borderRadius="xl">
            <Text 
              fontSize="xl" 
              color="#FEDF56" 
              textAlign="center"
              fontWeight="bold"
            >
              {currentPhase >= Phase.Maturity 
                ? `Final Price: ${finalPrice} USD`
                : `Strike Price: ${strikePrice} USD`
              }
            </Text>
          </Box>
        </Box>

        {/* Right Column - 30% */}
        <Box flex="0.3">
          {!isLoggedIn ? (
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
                  <Text color="#FEDF56">{balance.toFixed(4)} ETH</Text>
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
                  isDisabled={canResolve}
                />

                {/* Bid Buttons */}
                <Flex width="100%" gap={4}>
                  <Button
                    onClick={() => handleBid(Side.Long)}
                    isDisabled={canResolve}
                    bg={userPosition === Side.Long ? "#00FF00" : "#00EE00"}
                    color="black"
                    width="50%"
                    height="48px"
                    fontSize="lg"
                    fontWeight="bold"
                    _hover={{ bg: "#00FF00" }}
                    opacity={userPosition === Side.Long ? 1 : 0.8}
                    transition="all 0.2s"
                  >
                    UP
                  </Button>

                  <Button
                    onClick={() => handleBid(Side.Short)}
                    isDisabled={canResolve}
                    bg={userPosition === Side.Short ? "#FF1111" : "#FF0033"}
                    color="black"
                    width="50%"
                    height="48px"
                    fontSize="lg"
                    fontWeight="bold"
                    _hover={{ bg: "#FF1111" }}
                    opacity={userPosition === Side.Short ? 1 : 0.8}
                    transition="all 0.2s"
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
                    <Text color="#FEDF56">{positions.long.toFixed(4)} ETH</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text color="red.400">Short:</Text>
                    <Text color="#FEDF56">{positions.short.toFixed(4)} ETH</Text>
                  </Flex>
                </VStack>
              </Box>

              {/* Phase Info */}
              <Box width="100%" mt={4}>
                <VStack align="stretch" spacing={6} position="relative">
                  {/* Vertical Line */}
                  <Box
                    position="absolute"
                    left="15px"
                    top="15px"
                    bottom="15px"
                    width="2px"
                    bg="gray.700"
                    zIndex={0}
                  />

                  {/* Phase Items with Buttons */}
                  <HStack spacing={4}>
                    <Circle
                      size="30px"
                      bg={currentPhase === Phase.Trading ? "#FEDF56" : "gray.700"}
                      color={currentPhase === Phase.Trading ? "black" : "gray.500"}
                      fontWeight="bold"
                      zIndex={1}
                    >
                      1
                    </Circle>
                    <Text color={currentPhase === Phase.Trading ? "#FEDF56" : "gray.500"}>
                      Trading
                    </Text>
                  </HStack>

                  <HStack spacing={4}>
                    <Circle
                      size="30px"
                      bg={currentPhase === Phase.Bidding ? "#FEDF56" : "gray.700"}
                      color={currentPhase === Phase.Bidding ? "black" : "gray.500"}
                      fontWeight="bold"
                      zIndex={1}
                    >
                      2
                    </Circle>
                    <Text color={currentPhase === Phase.Bidding ? "#FEDF56" : "gray.500"}>
                      Bidding
                    </Text>
                  </HStack>

                  <HStack spacing={4} justify="space-between">
                    <HStack spacing={4}>
                      <Circle
                        size="30px"
                        bg={currentPhase === Phase.Maturity ? "#FEDF56" : "gray.700"}
                        color={currentPhase === Phase.Maturity ? "black" : "gray.500"}
                        fontWeight="bold"
                        zIndex={1}
                      >
                        3
                      </Circle>
                      <Text color={currentPhase === Phase.Maturity ? "#FEDF56" : "gray.500"}>
                        Maturity
                      </Text>
                    </HStack>
                    <Button
                      onClick={handleResolveMarket}
                      isDisabled={!canResolve || currentPhase !== Phase.Bidding}
                      colorScheme="yellow"
                      size="sm"
                    >
                      Resolve Market
                    </Button>
                  </HStack>

                  <HStack spacing={4} justify="space-between">
                    <HStack spacing={4}>
                      <Circle
                        size="30px"
                        bg={currentPhase === Phase.Expiry ? "#FEDF56" : "gray.700"}
                        color={currentPhase === Phase.Expiry ? "black" : "gray.500"}
                        fontWeight="bold"
                        zIndex={1}
                      >
                        4
                      </Circle>
                      <Text color={currentPhase === Phase.Expiry ? "#FEDF56" : "gray.500"}>
                        Expiry
                      </Text>
                    </HStack>
                    <Button
                      onClick={handleExpireMarket}
                      isDisabled={!canExpire || currentPhase !== Phase.Maturity}
                      colorScheme="yellow"
                      size="sm"
                    >
                      Expire Market
                    </Button>
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