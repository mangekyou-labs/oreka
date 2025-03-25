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

// Thêm mapping cho trading pairs
const TRADING_PAIR_MAP: { [key: string]: string } = {
    "BTCUSD": "BTC/USD",
    "ETHUSD": "ETH/USD",
    "ICPUSD": "ICP/USD"
};

// Thêm helper function để lấy background image dựa trên trading pair
const getBackgroundImage = (tradingPair: string) => {
  switch(tradingPair) {
    case 'BTC/USD':
      return "url('/images/btc-logo.png')";
    case 'ETH/USD':
      return "url('/images/eth-logo.png')";
    case 'ICP/USD':
      return "url('/images/icp-logo.png')";
    default:
      return "none";
  }
};

// Thêm helper function để lấy màu cho phase
const getPhaseColor = (phase: number) => {
  switch(phase) {
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
  switch(phase) {
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

// Cập nhật các hàm xử lý thời gian để không chuyển đổi múi giờ nữa

// Cập nhật toETTime - không cần chuyển đổi múi giờ vì timestamp đã là ET
const toETTime = (timestamp) => {
  if (!timestamp) return null;
  // Đã là timestamp ET, chỉ chuyển sang Date object
  return new Date(Number(timestamp) * 1000);
};

// Cập nhật formatMaturityTime để hiển thị đúng Eastern Time
const formatMaturityTime = (maturityTime: any) => {
  try {
    if (!maturityTime) return "Unknown";
    
    // Chuyển đổi từ timestamp sang Date
    const timestamp = Number(maturityTime);
    if (isNaN(timestamp) || timestamp === 0) return "Unknown";
    
    const date = new Date(timestamp * 1000);
    
    // Định dạng ngày tháng - KHÔNG chuyển đổi múi giờ, giữ nguyên là ET
    return format(date, 'MMM d, yyyy h:mm a (ET)');
  } catch (error) {
    console.error("Error formatting maturity time:", error);
    return "Unknown";
  }
};

// Cập nhật formatCardTime cũng tương tự
const formatCardTime = (maturityTime: any) => {
  try {
    if (!maturityTime) return "Unknown";
    
    const timestamp = Number(maturityTime);
    if (isNaN(timestamp) || timestamp === 0) return "Unknown";
    
    const date = new Date(timestamp * 1000);
    
    // Format ngắn gọn, đẹp cho card - không chuyển múi giờ
    return format(date, 'MMM d, yyyy h:mm a (ET)');
  } catch (error) {
    console.error("Error formatting card time:", error);
    return "Unknown";
  }
};

// Cập nhật formatMaturityDate
const formatMaturityDate = (maturityTime: any) => {
  try {
    const timestamp = Number(maturityTime);
    if (isNaN(timestamp) || timestamp === 0) return "TBD";
    
    // Không chuyển múi giờ
    const date = new Date(timestamp * 1000);
    
    // Chỉ hiển thị ngày
    return format(date, 'MMM d, yyyy');
  } catch (error) {
    console.error("Error formatting maturity date:", error);
    return "TBD";
  }
};

// Cập nhật isMarketEnded
const isMarketEnded = (maturityTime: any, phase: number): boolean => {
  try {
    if (!maturityTime) return false;
    
    const maturityDate = new Date(Number(maturityTime) * 1000);
    const currentTime = new Date();
    
    return currentTime.getTime() > maturityDate.getTime();
  } catch (error) {
    console.error("Error checking if market ended:", error);
    return false;
  }
};

// Cập nhật formatTimeRemaining
const formatTimeRemaining = (maturityTime: any) => {
  try {
    if (!maturityTime) return "Unknown";
    
    const maturityDate = new Date(Number(maturityTime) * 1000);
    const currentTime = new Date();
    
    // Nếu maturity date đã qua
    if (currentTime > maturityDate) {
      return "Ended";
    }
    
    // Sử dụng formatDistanceToNow để hiển thị khoảng thời gian còn lại
    return formatDistanceToNow(maturityDate, { addSuffix: true });
  } catch (error) {
    console.error("Error formatting time remaining:", error);
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
    const strikePrice = ethers.utils.formatEther(contract.strikePrice);
    
    // Return market title without any day of week and timestamps in parentheses
    return `${pair} will reach $${parseFloat(strikePrice).toFixed(2)} by ${maturityTimeFormatted}`;
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

    const handleAddressClick = (contractAddress: string, owner: string) => {
        // Lưu địa chỉ contract vào localStorage
        localStorage.setItem('selectedContractAddress', contractAddress);
        
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

    // Thêm state để lưu giá hiện tại của các asset pairs
    const [assetPrices, setAssetPrices] = useState<{[key: string]: number}>({});
    
    // Thêm useEffect để lấy giá hiện tại của các asset pairs
    useEffect(() => {
        const fetchAssetPrices = async () => {
            try {
                const priceService = PriceService.getInstance();
                const assets = ['BTC-USD', 'ETH-USD', 'ICP-USD'];
                
                const prices = await Promise.all(
                    assets.map(async (asset) => {
                        const priceData = await priceService.fetchPrice(asset);
                        return { asset, price: priceData.price };
                    })
                );
                
                const priceMap = prices.reduce((acc, { asset, price }) => {
                    const key = asset.replace('-', '/');
                    acc[key] = price;
                    return acc;
                }, {} as {[key: string]: number});
                
                setAssetPrices(priceMap);
            } catch (error) {
                console.error("Error fetching asset prices:", error);
            }
        };
        
        fetchAssetPrices();
        
        // Cập nhật giá mỗi 30 giây
        const intervalId = setInterval(fetchAssetPrices, 30000);
        
        return () => clearInterval(intervalId);
    }, []);

    // Thêm state để theo dõi thời gian
    const [currentTime, setCurrentTime] = useState(new Date());

    // Thêm useEffect để cập nhật thời gian mỗi phút
    useEffect(() => {
      const timer = setInterval(() => {
        setCurrentTime(new Date());
        console.log("Updated current time:", new Date().toISOString());
        // Force re-render
        setDeployedContracts([...deployedContracts]);
      }, 60000); // Cập nhật mỗi phút
      
      return () => clearInterval(timer);
    }, [deployedContracts]);

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
                    
                    {/* Tab description */}
                    <Box p={4} bg="gray.50" borderRadius="md" mb={4}>
                        {currentTab === 'All Markets' && (
                            <Text color="gray.600">Showing all available markets</Text>
                        )}
                        {currentTab === 'Most recent' && (
                            <Text color="gray.600">Showing markets sorted by creation date (newest first)</Text>
                        )}
                        {currentTab === 'Quests' && (
                            <Text color="gray.600">Showing active markets in Trading or Bidding phase</Text>
                        )}
                        {currentTab === 'Results' && (
                            <Text color="gray.600">Showing markets in Maturity or Expiry phase</Text>
                        )}
                        {['BTC/USD', 'ETH/USD', 'ICP/USD'].includes(currentTab) && (
                            <Text color="gray.600">Showing {currentTab} markets only</Text>
                        )}
                    </Box>
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
                                onClick={() => handleAddressClick(address, owner)}
                                cursor="pointer"
                                transition="transform 0.2s"
                                _hover={{ transform: 'translateY(-4px)' }}
                                bg="#1A202C"
                            >
                                {/* Image section at the top - Tăng chiều cao */}
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
                                        src={`/images/${tradingPair.split('/')[0].toLowerCase()}-logo.png`}
                                        alt={tradingPair}
                                        maxH="130px"
                                        objectFit="contain"
                                        fallback={<Box h="120px" w="120px" bg="#1A202C" borderRadius="full" />}
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
                                    <Text fontSize="md" fontWeight="bold" mb={1} color="white">
                                        {cleanupMarketTitle(getMarketTitle({ address, createDate, longAmount, shortAmount, strikePrice, phase, maturityTime, tradingPair, owner }))}
                                    </Text>
                                    
                                    {/* Time remaining - Giảm margin bottom */}
                                    <Text color="gray.300" fontSize="sm" mb={2}>
                                        {(() => {
                                            try {
                                                console.log("Rendering end time for contract:", address);
                                                console.log("Phase:", phase);
                                                console.log("MaturityTime:", maturityTime);
                                                
                                                // Kiểm tra phase
                                                const phaseNumber = parseInt(phase);
                                                
                                                // Nếu đã ở phase Maturity hoặc Expiry, hiển thị "Ended"
                                                if (phaseNumber === Phase.Maturity || phaseNumber === Phase.Expiry) {
                                                    console.log("Market ended based on phase");
                                                    return "Ends: Ended";
                                                }
                                                
                                                // Kiểm tra maturityTime có hợp lệ không
                                                if (!maturityTime) {
                                                    console.log("MaturityTime is invalid");
                                                    return "Ends: Unknown";
                                                }
                                                
                                                // Chuyển đổi maturityTime thành số
                                                let timeValue = maturityTime;
                                                if (typeof timeValue === 'string') {
                                                    timeValue = parseInt(timeValue);
                                                }
                                                
                                                if (isNaN(timeValue) || timeValue <= 0) {
                                                    console.log("Invalid timeValue after conversion");
                                                    return "Ends: Unknown";
                                                }
                                                
                                                // Tạo đối tượng Date
                                                const maturityDate = new Date(timeValue * 1000);
                                                const now = new Date();
                                                
                                                console.log("Maturity date:", maturityDate.toISOString());
                                                console.log("Current time:", now.toISOString());
                                                console.log("Difference (ms):", maturityDate.getTime() - now.getTime());
                                                
                                                // Kiểm tra thời gian
                                                if (now.getTime() >= maturityDate.getTime()) {
                                                    console.log("Market ended based on time comparison");
                                                    return "Ends: Ended";
                                                }
                                                
                                                // Nếu chưa kết thúc, hiển thị thời gian còn lại
                                                const timeRemaining = formatTimeRemaining(maturityTime);
                                                return `Ends ${timeRemaining}`;
                                            } catch (error) {
                                                console.error("Error rendering end time:", error);
                                                return "Ends: Unknown";
                                            }
                                        })()}
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
                                </Box>
                                
                                {/* Divider */}
                                <Box h="1px" bg="gray.700" mx={0} />
                                
                                {/* LONG/SHORT section at the bottom - Giảm padding */}
                                <Box p={3}>
                                    {/* Long position */}
                                    <HStack justify="space-between" mb={1}>
                                        <Text fontSize="sm" color="white">1. LONG</Text>
                                        <Text color="green.400" fontWeight="bold">
                                            {parseFloat(longAmount) > 0 
                                                ? `${Math.round((parseFloat(longAmount) / (parseFloat(longAmount) + parseFloat(shortAmount))) * 100)}%` 
                                                : "0%"}
                                            <Text as="span" color="gray.400" ml={1} fontSize="sm">({parseFloat(longAmount) > 0 ? Math.round(parseFloat(longAmount)) : 0})</Text>
                                        </Text>
                                    </HStack>
                                    
                                    {/* Short position */}
                                    <HStack justify="space-between">
                                        <Text fontSize="sm" color="white">2. SHORT</Text>
                                        <Text color="red.400" fontWeight="bold">
                                            {parseFloat(shortAmount) > 0 
                                                ? `${Math.round((parseFloat(shortAmount) / (parseFloat(longAmount) + parseFloat(shortAmount))) * 100)}%` 
                                                : "0%"}
                                            <Text as="span" color="gray.400" ml={1} fontSize="sm">({parseFloat(shortAmount) > 0 ? Math.round(parseFloat(shortAmount)) : 0})</Text>
                                        </Text>
                                    </HStack>
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