import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, HStack, Icon, Text, VStack, SimpleGrid, Flex, Input, Select, Divider, Progress, InputGroup, InputRightAddon, Spinner, Slider, SliderTrack, SliderFilledTrack, SliderThumb, Tooltip, Spacer, Image } from '@chakra-ui/react';
import { CheckIcon, InfoIcon, ExternalLinkIcon, TimeIcon, InfoOutlineIcon } from '@chakra-ui/icons'; // Import icons
import { FaCalendarDay, FaPlayCircle, FaClock, FaCheckCircle, FaListAlt } from 'react-icons/fa'; // Import các biểu tượng
import { IoWalletOutline } from "react-icons/io5";
import { FaEthereum, FaWallet, FaTrophy, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { TbCalendarTime } from 'react-icons/tb';
import { SiBitcoinsv } from "react-icons/si";
import { FaCoins } from "react-icons/fa";
import Factory from '../contracts/abis/FactoryABI.json';
import { useToast } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { FACTORY_ADDRESS } from '../config/contracts';
import BinaryOptionMarket from '../contracts/abis/BinaryOptionMarketABI.json';
import { getContractTradingPair } from '../config/tradingPairs';
import { useAuth } from '../context/AuthContext';
import { PriceService } from '../services/PriceService';
import { format, formatDistanceToNow } from 'date-fns';
import { isBefore } from 'date-fns'; // Import from date-fns
import { toZonedTime } from 'date-fns-tz'; // Sử dụng toZonedTime
import { getCurrentTimestamp, isTimestampPassed, getTimeRemaining } from '../utils/timeUtils';

interface ListAddressOwnerProps {
  ownerAddress: string; // Đảm bảo ownerAddress là địa chỉ hợp lệ
  page: number;
}

interface ContractInfo {
  contractAddress: string;
  tradingPair: string;
}

interface ContractData {
  address: string;
  createDate: string;
  longAmount: string;
  shortAmount: string;
  strikePrice: string;
  phase: number;
  maturityTime: string;
  tradingPair: string;
  owner: string;
}

enum Phase { Trading, Bidding, Maturity, Expiry }


// Thêm helper function để lấy màu cho phase
const getPhaseColor = (phase: number) => {
  switch (phase) {
    case Phase.Trading:
      return "green.400";
    case Phase.Bidding:
      return "blue.400";
    case Phase.Maturity:
      return "orange.400";
    case Phase.Expiry:
      return "red.400";
    default:
      return "gray.400";
  }
};

// Thêm helper function để lấy tên phase
const getPhaseName = (phase: number) => {
  switch (phase) {
    case Phase.Trading:
      return "Trading";
    case Phase.Bidding:
      return "Bidding";
    case Phase.Maturity:
      return "Maturity";
    case Phase.Expiry:
      return "Expiry";
    default:
      return "Unknown";
  }
};



// Cập nhật getMarketTitle để loại bỏ phần (Sat...)
const getMarketTitle = (contract) => {
  try {
    // Format trading pair
    const pair = contract.tradingPair.replace('/', '-');

    // Format maturity time - CLEAN & CLEAR
    const timestamp = Number(contract.maturityTime);
    if (isNaN(timestamp) || timestamp === 0) return `${pair} Market`;

    const date = new Date(timestamp * 1000);
    const maturityTimeFormatted = format(date, 'MMM d, yyyy h:mm a');

    // Format strike price
    const strikePrice = ethers.utils.formatUnits(contract.strikePrice, 0);

    // Return market title without any day of week and timestamps in parentheses
    return `${pair} will reach $${parseFloat(strikePrice).toFixed(2)} by ${maturityTimeFormatted} ?`;
  } catch (error) {
    console.error("Error getting market title:", error);
    return "Unknown Market";
  }
};

// Hàm hỗ trợ để loại bỏ chuỗi (Sat...) khỏi bất kỳ tiêu đề nào
const cleanupMarketTitle = (title: string) => {
  // Loại bỏ mọi chuỗi nằm trong ngoặc đơn có chứa "Sat"
  return title.replace(/\([^)]*Sat[^)]*\)/g, '').trim();
};

const ListAddressOwner: React.FC<ListAddressOwnerProps> = ({ ownerAddress, page }) => {
  const { isConnected, walletAddress, balance, connectWallet, refreshBalance } = useAuth();
  const [deployedContracts, setDeployedContracts] = useState<ContractData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const toast = useToast();
  const router = useRouter();
  const [contractPercentages, setContractPercentages] = useState<{[key: string]: {long: number, short: number}}>({});

  // Phân trang
  const currentPage = page;
  const contractsPerPage = 32;
  const [currentContracts, setCurrentContracts] = useState<ContractData[]>([]);

  //const [FactoryAddress, setFactoryAddress] = useState<string>('');
  const FactoryAddress = FACTORY_ADDRESS;

  // Cập nhật state cho tab hiện tại
  const [currentTab, setCurrentTab] = useState<string>('All Markets');

  // Logic for filtering contracts based on the selected tab
  const filteredContracts = currentContracts.filter(contract => {
    if (currentTab === 'All Markets') return true;
    if (currentTab === 'Most recent') return true; // Sẽ sắp xếp sau, không cần lọc
    if (currentTab === 'Quests') return contract.phase === Phase.Trading || contract.phase === Phase.Bidding;
    if (currentTab === 'Results') return contract.phase === Phase.Maturity || contract.phase === Phase.Expiry;
    return contract.tradingPair === currentTab; // Giữ lại logic lọc theo tradingPair
  });

  // Sắp xếp contracts nếu tab là Most recent
  useEffect(() => {
    if (currentTab === 'Most recent') {
      // Tạo bản sao của mảng để không ảnh hưởng đến state gốc
      const sortedContracts = [...currentContracts].sort((a, b) => {
        // Sắp xếp theo thời gian tạo giảm dần (mới nhất lên đầu)
        return new Date(b.createDate).getTime() - new Date(a.createDate).getTime();
      });
      setCurrentContracts(sortedContracts);
    }
  }, [currentTab]);

  useEffect(() => {
    // Fetch deployed contracts logic here
  }, [ownerAddress, page]);


  const totalPages = Math.ceil(deployedContracts.length / contractsPerPage);
  const handlePageChange = (page: number) => {
    if (page !== currentPage) { // Chỉ thay đổi nếu page khác với currentPage hiện tại
      router.push(`/listaddress/page${page}`);
    }
  };

  useEffect(() => {
    const indexOfLastContract = page * contractsPerPage;
    const indexOfFirstContract = indexOfLastContract - contractsPerPage;
    const newCurrentContracts = deployedContracts.slice(indexOfFirstContract, indexOfLastContract);
    setCurrentContracts(newCurrentContracts);
  }, [deployedContracts, page]);


  // Gọi fetchDeployedContracts khi ownerAddress thay đổi
  useEffect(() => {
    fetchDeployedContracts();
  }, [ownerAddress, page]);

  const fetchDeployedContracts = async () => {
    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, provider);

      // Lấy danh sách tất cả các owner đã deploy hợp đồng
      // Đây là cách để lấy tất cả các hợp đồng mà không cần sửa Factory.sol

      console.log("Fetching all contracts from all known owners");

      // Danh sách các địa chỉ ví đã biết (có thể thêm vào nếu cần)
      // Bạn có thể hardcode một số địa chỉ owner đã biết ở đây
      const knownOwners = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Địa chỉ owner mặc định của Hardhat
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Địa chỉ thứ 2 của Hardhat
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Địa chỉ thứ 3 của Hardhat
        // Thêm các địa chỉ owner khác nếu biết
      ];

      // Thêm địa chỉ hiện tại và ownerAddress vào danh sách
      if (walletAddress && !knownOwners.includes(walletAddress)) {
        knownOwners.push(walletAddress);
      }
      if (ownerAddress && !knownOwners.includes(ownerAddress)) {
        knownOwners.push(ownerAddress);
      }

      console.log("Known owners:", knownOwners);

      // Lấy tất cả các hợp đồng từ tất cả các owner đã biết
      let allContracts: string[] = [];

      for (const owner of knownOwners) {
        try {
          if (owner && owner !== "") {
            const ownerContracts = await factoryContract.getContractsByOwner(owner);
            console.log(`Contracts for owner ${owner}:`, ownerContracts);

            // Thêm các hợp đồng mới vào danh sách (tránh trùng lặp)
            ownerContracts.forEach((contract: string) => {
              if (!allContracts.includes(contract)) {
                allContracts.push(contract);
              }
            });
          }
        } catch (err) {
          console.error(`Error fetching contracts for owner ${owner}:`, err);
        }
      }

      console.log("All contracts:", allContracts);

      // Nếu không tìm thấy hợp đồng nào, thử lấy từ event logs
      if (allContracts.length === 0) {
        try {
          console.log("Trying to fetch from event logs");
          const filter = factoryContract.filters.Deployed();
          const events = await factoryContract.queryFilter(filter);

          console.log("Found events:", events.length);

          // Lấy địa chỉ hợp đồng từ các sự kiện
          events.forEach(event => {
            const contractAddress = event.args?.contractAddress;
            if (contractAddress && !allContracts.includes(contractAddress)) {
              allContracts.push(contractAddress);
            }
          });

          console.log("Contracts from events:", allContracts);
        } catch (error) {
          console.error("Error fetching from events:", error);
        }
      }

      // Phần còn lại giữ nguyên
      const contractsData = await Promise.all(allContracts.map(async (address: string) => {
        const contract = new ethers.Contract(address, BinaryOptionMarket.abi, provider);

        try {
          const [
            positions,
            strikePriceBN,
            phase,
            maturityTimeBN,
            tradingPair,
            owner
          ] = await Promise.all([
            contract.positions(),
            contract.strikePrice(),
            contract.currentPhase(),
            contract.maturityTime(),
            contract.tradingPair().catch(() => 'Unknown'),
            contract.owner()
          ]);

          // Chuyển đổi maturityTime từ BigNumber sang số
          let maturityTimeValue;
          if (maturityTimeBN && typeof maturityTimeBN.toNumber === 'function') {
            maturityTimeValue = maturityTimeBN.toNumber();
            console.log("Converted maturityTime from BigNumber:", maturityTimeValue);
          } else if (typeof maturityTimeBN === 'string') {
            maturityTimeValue = parseInt(maturityTimeBN);
            console.log("Converted maturityTime from string:", maturityTimeValue);
          } else {
            maturityTimeValue = maturityTimeBN;
            console.log("Using maturityTime as is:", maturityTimeValue);
          }

          // Kiểm tra giá trị hợp lệ
          if (!maturityTimeValue || isNaN(maturityTimeValue) || maturityTimeValue <= 0) {
            console.log("Invalid maturityTime, using current time + 1 day as fallback");
            maturityTimeValue = Math.floor(Date.now() / 1000) + 86400; // Current time + 1 day
          }

          // Kiểm tra maturityTime có hợp lệ không
          const maturityDate = new Date(maturityTimeValue * 1000);
          console.log("Maturity date:", maturityDate.toISOString());
          console.log("Current time:", new Date().toISOString());
          console.log("Is maturity in the past?", maturityDate <= new Date());

          return {
            address,
            createDate: new Date().toISOString(),
            longAmount: ethers.utils.formatEther(positions.long),
            shortAmount: ethers.utils.formatEther(positions.short),
            strikePrice: strikePriceBN.toString(),
            phase: phase.toString(),
            maturityTime: maturityTimeValue,
            tradingPair,
            owner
          };
        } catch (error) {
          console.error(`Error fetching data for contract ${address}:`, error);
          return {
            address,
            createDate: new Date().toISOString(),
            longAmount: '0',
            shortAmount: '0',
            strikePrice: '0',
            phase: '0',
            maturityTime: 0,  // Giá trị mặc định an toàn
            tradingPair: 'Unknown',
            owner: ''
          };
        }
      }));

      setDeployedContracts(contractsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching deployed contracts:", error);
      setLoading(false);
    }
  };
  useEffect(() => {
    console.log("Component mounted. Owner address:", ownerAddress);
  }, []);

  useEffect(() => {
    fetchDeployedContracts();
  }, [ownerAddress]);



  useEffect(() => {
    fetchDeployedContracts();

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(FactoryAddress, Factory.abi, provider);

    const handleNewContract = (owner: string, contractAddress: string, index: number) => {
      console.log("New contract deployed event received:", contractAddress);
      console.log("Owner:", owner);
      console.log("Index:", index);

      // Luôn cập nhật danh sách hợp đồng khi có hợp đồng mới được deploy
      fetchDeployedContracts();
    };

    // Lắng nghe sự kiện Deployed
    contract.on("Deployed", handleNewContract);

    // Cleanup listener on unmount
    return () => {
      contract.removeListener("Deployed", handleNewContract);
    };
  }, []);

  const handleAddressClick = (contractAddress: string, owner: string, contractData: ContractData) => {
    // Lưu địa chỉ contract vào localStorage
    localStorage.setItem('selectedContractAddress', contractAddress);

    // Lưu thêm dữ liệu contract để Customer.tsx có thể sử dụng ngay
    localStorage.setItem('contractData', JSON.stringify({
      address: contractAddress,
      strikePrice: contractData.strikePrice,
      maturityTime: contractData.maturityTime,
      tradingPair: contractData.tradingPair,
      phase: contractData.phase,
      longAmount: contractData.longAmount,
      shortAmount: contractData.shortAmount,
      owner: contractData.owner,
      timestamp: Date.now() // Thêm timestamp để biết dữ liệu được lưu khi nào
    }));

    // Kiểm tra xem người dùng hiện tại có phải là owner không
    if (isConnected && walletAddress.toLowerCase() === owner.toLowerCase()) {
      // Nếu là owner, chuyển đến trang OwnerDeploy
      router.push(`/ownerdeploy/${contractAddress}`);
    } else {
      // Nếu không phải owner, chuyển đến trang Market (dành cho người dùng thông thường)
      router.push(`/customer/${contractAddress}`);

      // Hiển thị thông báo
      toast({
        title: "Access restricted",
        description: "You are not the owner of this contract. Redirecting to market view.",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
    }
  };


  // Hàm rút gọn địa chỉ ví
  const shortenAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Thêm useEffect để cập nhật balance theo thời gian thực
  useEffect(() => {
    if (isConnected) {
      refreshBalance();

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      provider.on("block", refreshBalance);

      return () => {
        provider.removeAllListeners("block");
      };
    }
  }, [isConnected, refreshBalance]);

  // Add state to store fixed image indices for contracts
  const [contractImageIndices, setContractImageIndices] = useState<{ [key: string]: number }>({});

  // Add state for countdown timers
  const [countdowns, setCountdowns] = useState<{ [key: string]: string }>({});

  // Remove the old useEffect that reloaded everything every minute
  // Instead, add a useEffect for continuous countdown updates
  useEffect(() => {
    // Function to update all countdowns
    const updateCountdowns = () => {
      const newCountdowns: { [key: string]: string } = {};

      currentContracts.forEach(contract => {
        const timestamp = Number(contract.maturityTime);
        if (!isNaN(timestamp) && timestamp > 0) {
          if (isTimestampPassed(timestamp)) {
            newCountdowns[contract.address] = "Ended";
          } else {
            newCountdowns[contract.address] = getTimeRemaining(timestamp);
          }
        } else {
          newCountdowns[contract.address] = "Unknown";
        }
      });

      setCountdowns(newCountdowns);
    };

    // Update countdowns immediately
    updateCountdowns();

    // Set interval to update countdowns every second
    const intervalId = setInterval(updateCountdowns, 1000);

    return () => clearInterval(intervalId);
  }, [currentContracts]);

  // Add useEffect to assign fixed random image indices when contracts change
  useEffect(() => {
    const newImageIndices: { [key: string]: number } = {};

    // Preserve existing indices
    const existingIndices = { ...contractImageIndices };

    // Assign indices to any new contracts
    currentContracts.forEach(contract => {
      if (!existingIndices[contract.address]) {
        // Generate random number only once per contract
        newImageIndices[contract.address] = Math.floor(Math.random() * 10) + 1;
      } else {
        // Keep existing random number
        newImageIndices[contract.address] = existingIndices[contract.address];
      }
    });

    setContractImageIndices(newImageIndices);
  }, [currentContracts]);

  // Modify the renderTimeRemaining function to use the countdown state
  const renderTimeRemaining = (contractAddress: string) => {
    const countdown = countdowns[contractAddress];
    if (!countdown) return "Ends: Unknown";

    return `Ends: ${countdown}`;
  };

  // Thêm state để lưu giá hiện tại của các asset pairs
  const [assetPrices, setAssetPrices] = useState<{ [key: string]: number }>({});

  // Replace the old useEffect for polling prices with WebSocket implementation
  useEffect(() => {
    // Define the trading pairs we want to subscribe to
    // Make sure these match the format used by Coinbase API (with hyphens)
    const tradingPairs = ['BTC-USD', 'ETH-USD', 'ICP-USD'];

    // Get PriceService instance
    const priceService = PriceService.getInstance();

    // Create a mapping function to convert from API format to display format
    const formatPairForDisplay = (apiSymbol: string) => apiSymbol.replace('-', '/');

    // Subscribe to websocket updates
    const unsubscribe = priceService.subscribeToWebSocketPrices((priceData) => {
      // When we get a price update, update our state
      // Convert the symbol format from API format (BTC-USD) to display format (BTC/USD)
      const displaySymbol = formatPairForDisplay(priceData.symbol);

      setAssetPrices(prev => ({
        ...prev,
        [displaySymbol]: priceData.price
      }));

      console.log(`Updated price for ${displaySymbol}: $${priceData.price}`);
    }, tradingPairs);

    // Load initial prices directly
    tradingPairs.forEach(async (pair) => {
      try {
        const priceData = await priceService.fetchPrice(pair);
        const displaySymbol = formatPairForDisplay(pair);

        setAssetPrices(prev => ({
          ...prev,
          [displaySymbol]: priceData.price
        }));

        console.log(`Initial price for ${displaySymbol}: $${priceData.price}`);
      } catch (error) {
        console.error(`Error fetching initial price for ${pair}:`, error);
      }
    });

    // Clean up by unsubscribing when component unmounts
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const newPercentages: {[key: string]: {long: number, short: number}} = {};
    
    currentContracts.forEach(contract => {
      const longAmount = parseFloat(contract.longAmount || '0');
      const shortAmount = parseFloat(contract.shortAmount || '0');
      const total = longAmount + shortAmount;
      
      if (total > 0) {
        const longPercent = (longAmount / total) * 100;
        const shortPercent = (shortAmount / total) * 100;
        
        newPercentages[contract.address] = {
          long: longPercent,
          short: shortPercent
        };
      } else {
        // Default to 50/50 if no amounts are present
        newPercentages[contract.address] = {
          long: 50,
          short: 50
        };
      }
    });
    
    setContractPercentages(newPercentages);
  }, [currentContracts]);
  

  return (
    <Box bg="white" minH="100vh">
      {/* Header với wallet connection */}
      <Flex
        as="header"
        align="center"
        justify="space-between"
        p={4}
        bg="white"
        borderBottom="1px"
        borderColor="gray.200"
        position="sticky"
        top="0"
        zIndex="sticky"
        boxShadow="sm"
      >
        <Text fontSize="xl" fontWeight="bold" color="gray.800">
          OREKA
        </Text>

        <Spacer />

        {isConnected ? (
          <HStack spacing={4}>
            <HStack
              p={2}
              bg="gray.50"
              borderRadius="md"
              borderWidth="1px"
              borderColor="gray.200"
            >
              <Icon as={FaEthereum} color="blue.500" />
              <Text color="gray.700" fontWeight="medium">
                {parseFloat(balance).toFixed(4)} ETH
              </Text>
            </HStack>

            <Button
              leftIcon={<FaWallet />}
              colorScheme="blue"
              variant="outline"
              size="md"
            >
              {shortenAddress(walletAddress)}
            </Button>
          </HStack>
        ) : (
          <Button
            leftIcon={<FaWallet />}
            colorScheme="blue"
            size="md"
            onClick={connectWallet}
          >
            Connect Wallet
          </Button>
        )}
      </Flex>

      <Box p={6}>
        {/* Header với các tab */}
        <Box mb={6}>

          {/* Tab navigation */}
          <Flex
            overflowX="auto"
            pb={2}
            mb={4}
            css={{
              '&::-webkit-scrollbar': {
                height: '8px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.1)',
                borderRadius: '4px',
              }
            }}
          >
            <HStack spacing={4}>
              {['All Markets', 'Most recent', 'Quests', 'Results', 'BTC/USD', 'ETH/USD', 'ICP/USD'].map((tab) => (
                <Button
                  key={tab}
                  size="md"
                  variant={currentTab === tab ? "solid" : "ghost"}
                  colorScheme={currentTab === tab ? "blue" : "gray"}
                  onClick={() => setCurrentTab(tab)}
                  minW="120px"
                  leftIcon={
                    tab === 'All Markets' ? <FaListAlt /> :
                      tab === 'Most recent' ? <FaCalendarDay /> :
                        tab === 'Quests' ? <FaPlayCircle /> :
                          tab === 'Results' ? <FaTrophy /> :
                            tab === 'BTC/USD' ? <SiBitcoinsv /> :
                              tab === 'ETH/USD' ? <FaEthereum /> :
                                <FaCoins />
                  }
                >
                  {tab}
                </Button>
              ))}
            </HStack>
          </Flex>
        </Box>

        {loading ? (
          <Text color="gray.600">Loading...</Text>
        ) : deployedContracts.length > 0 ? (
          <SimpleGrid
            columns={{ base: 1, md: 2, lg: 3, xl: 4 }}
            spacing={4}
            width="100%"
          >
            {filteredContracts.map(({ address, createDate, longAmount, shortAmount, strikePrice, phase, maturityTime, tradingPair, owner }, index) => (
              
              <Box
                key={index}
                borderRadius="lg"
                overflow="hidden"
                boxShadow="md"
                onClick={() => handleAddressClick(address, owner, { address, createDate, longAmount, shortAmount, strikePrice, phase, maturityTime, tradingPair, owner })}
                cursor="pointer"
                transition="transform 0.2s"
                _hover={{ transform: 'translateY(-4px)' }}
                bg="#1A202C"
              >
                {/* Image section - use fixed random number from state */}
                <Box
                  h="160px"
                  w="100%"
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  bg="#151A23"
                  p={3}
                >
                  <Image
                    src={`/images/${tradingPair.split('/')[0].toLowerCase()}/${tradingPair.split('/')[0].toLowerCase()}${contractImageIndices[address] || 1}.png`}
                    alt={tradingPair}
                    w="430px"
                    h="150px"
                    objectFit="cover"
                    position="absolute"
                    fallback={<Box h="100%" w="100%" bg="#1A202C" borderRadius="full" />}
                  />
                </Box>

                {/* Info section in the middle - Giảm padding và margin */}
                <Box p={3}>
                  {/* Phase indicator - Giảm margin bottom */}
                  <Box
                    display="inline-block"
                    bg={getPhaseColor(parseInt(phase))}
                    color="white"
                    px={3}
                    py={1}
                    borderRadius="md"
                    fontSize="sm"
                    fontWeight="bold"
                    mb={2}
                  >
                    {getPhaseName(parseInt(phase))}
                  </Box>

{/* Market title - Giảm margin bottom */}
                  <Text fontWeight="bold" mb={1} color="white" fontSize="xl">
                    {cleanupMarketTitle(getMarketTitle({ address, createDate, longAmount, shortAmount, strikePrice, phase, maturityTime, tradingPair, owner }))}
                  </Text>
                
{/* Time remaining - use countdown state instead of function call */}
                <Text fontSize="sm" color="gray.400">
                    {renderTimeRemaining(address)}
                </Text>
              
{/* Current price - Giảm margin bottom */}
                <HStack spacing={2} mb={2}> 
                   <Icon as={       
                  tradingPair.includes("BTC") ? SiBitcoinsv :
                tradingPair.includes("ETH") ? FaEthereum :
                  FaCoins
                                        } color="blue.300" />
                                        <Text fontWeight="bold" fontSize="lg" color="white">
                {assetPrices[tradingPair] 
                  ? `$${assetPrices[tradingPair].toLocaleString(undefined, { maximumFractionDigits: 2 })}` 
              : "Loading..."}
                  </Text>
                </HStack>

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
                    width={`${contractPercentages[address]?.long}%`}
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
                    {contractPercentages[address]?.long > 8 && (
                      <Text
                        fontSize="sm"
                        fontWeight="bold"
                        color="whiteAlpha.800"
                      >
                        {contractPercentages[address]?.long.toFixed(0)}%
                      </Text>
                    )}
                  </Box>

                  {/* SHORT Section (in absolute layer for smooth overlap) */}
                  <Box
                    position="absolute"
                    right="0"
                    top="0"
                    h="100%"
                    width={`${contractPercentages[address]?.short}%`}
                    bgGradient="linear(to-r, #ff512f, #dd2476)"
                    transition="width 0.6s ease"
                    display="flex"
                    alignItems="center"
                    justifyContent="flex-start"
                    pl={3}
                    zIndex={0}
                  >
                    {contractPercentages[address]?.short > 8 && (
                      <Text
                        fontSize="sm"
                        fontWeight="bold"
                        color="whiteAlpha.800"
                      >
                        {contractPercentages[address]?.short.toFixed(0)}%
                      </Text>
                    )}
                  </Box>
                </Flex>
                                </Box>
                            </Box> 
                        ))} 
                    </SimpleGrid>
                ) : ( 
                    <Text color="gray.600">No contracts found for this owner.</Text>
                )}
            </Box>
        </Box> 
        
    ); 
};

export default ListAddressOwner;