import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, HStack, Icon, Text, VStack, SimpleGrid, Flex } from '@chakra-ui/react';
import { CheckIcon, InfoIcon, ExternalLinkIcon, TimeIcon, InfoOutlineIcon } from '@chakra-ui/icons'; // Import icons
import { FaCalendarDay, FaPlayCircle, FaClock, FaCheckCircle, FaListAlt } from 'react-icons/fa'; // Import các biểu tượng
import { IoWalletOutline } from "react-icons/io5";
import { FaEthereum, FaWallet, FaTrophy } from 'react-icons/fa';
import { TbCalendarTime } from 'react-icons/tb';
import { SiBitcoinsv } from "react-icons/si";
import { FaCoins } from "react-icons/fa";
import Factory from '../../../out/Factory.sol/Factory.json';
import { useToast } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import fs from 'fs'; // Import fs để đọc file
import { FACTORY_ADDRESS } from '../config/contracts';
import BinaryOptionMarket from '../../../out/BinaryOptionMarket.sol/BinaryOptionMarket.json';
import { getContractTradingPair } from '../config/tradingPairs';
import { useAuth } from '../context/AuthContext';

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
    
//   useEffect(() => {
//     // Đọc địa chỉ từ file JSON
//     const data = fs.readFileSync('deployed_address.json', 'utf8');
//     const json = JSON.parse(data);
//     setFactoryAddress(json.FactoryAddress);
// }, []);
    // Tính toán tổng số trang
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
        if (!ownerAddress) return;
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, provider);
            const contracts = await factoryContract.getContractsByOwner(ownerAddress);

            const contractsData = await Promise.all(contracts.map(async (address: string) => {
                const contract = new ethers.Contract(address, BinaryOptionMarket.abi, provider);
                
                try {
                    const [
                        positions,
                        strikePriceBN,
                        phase,
                        maturityTime,
                        tradingPair  // Có thể throw error với contract cũ
                    ] = await Promise.all([
                        contract.positions(),
                        contract.strikePrice(),
                        contract.currentPhase(),
                        contract.maturityTime(),
                        contract.tradingPair().catch(() => 'Unknown') // Xử lý lỗi cho contract cũ
                    ]);

                    return {
                        address,
                        createDate: new Date().toLocaleDateString(),
                        longAmount: ethers.utils.formatEther(positions.long),
                        shortAmount: ethers.utils.formatEther(positions.short),
                        strikePrice: ethers.utils.formatUnits(strikePriceBN, 0),
                        phase,
                        maturityTime: new Date(maturityTime * 1000).toLocaleString(),
                        tradingPair
                    };
                } catch (error) {
                    console.error(`Error fetching data for contract ${address}:`, error);
                    // Return default values if contract call fails
                    return {
                        address,
                        createDate: new Date().toLocaleDateString(),
                        longAmount: '0',
                        shortAmount: '0',
                        strikePrice: '0',
                        phase: 0,
                        maturityTime: 'Unknown',
                        tradingPair: 'Unknown'
                    };
                }
            }));

            setDeployedContracts(contractsData);
            setLoading(false);
        } catch (error) {
            console.error("Error:", error);
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
            console.log("New contract deployed:", contractAddress);
            fetchDeployedContracts(); // Gọi lại để cập nhật danh sách
        };

        // Lắng nghe sự kiện ContractDeployed
        contract.on("Deployed", handleNewContract);

        // Cleanup listener on unmount
        return () => {
            contract.off("Deployed", handleNewContract);
        };
    }, [ownerAddress]);

    const handleAddressClick = async (address: string) => {
        try {
            // Kiểm tra và kết nối ví nếu chưa kết nối
            if (!isConnected) {
                await connectWallet();
            }

            // Lưu địa chỉ contract vào localStorage
            localStorage.setItem('selectedContractAddress', address);

            // Tạo provider không cần ENS
            const provider = new ethers.providers.Web3Provider(window.ethereum, {
                name: 'local',
                chainId: 31337,
                ensAddress: null
            });

            const signer = provider.getSigner();
            const contract = new ethers.Contract(address, BinaryOptionMarket.abi, signer);
            
            try {
                const owner = await contract.owner();
                const currentAddress = await signer.getAddress();

                // Navigate dựa trên role
                if (owner.toLowerCase() === currentAddress.toLowerCase()) {
                    router.push('/ownerdeploy');
                } else {
                    router.push('/customer');
                }
            } catch (error) {
                console.error("Error checking owner:", error);
                // Nếu không thể kiểm tra owner, mặc định chuyển đến customer
                router.push('/customer');
            }

        } catch (error) {
            console.error("Error handling address click:", error);
            toast({
                title: "Error",
                description: "Please connect your wallet first",
                status: "error",
                duration: 3000,
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

    return (
        <Box bg="white" minH="100vh">
            <Box p={6}>
                {loading ? (
                    <Text color="gray.600">Loading...</Text>
                ) : deployedContracts.length > 0 ? (
                    <SimpleGrid 
                        columns={{ base: 1, md: 2, lg: 3, xl: 5 }}
                        spacing={4}
                        width="100%"
                    >
                        {currentContracts.map(({ address, createDate, longAmount, shortAmount, strikePrice, phase, maturityTime, tradingPair }, index) => (
                            <Box
                                key={index}
                                p={4}
                                borderWidth={1}
                                borderRadius="lg"
                                bg="gray.50"
                                onClick={() => handleAddressClick(address)}
                                cursor="pointer"
                                minH="250px"
                                position="relative"
                                _hover={{
                                    transform: "translateY(-4px)",
                                    boxShadow: "lg",
                                    transition: "all 0.3s ease",
                                    bg: "gray.100"
                                }}
                            >
                                <VStack align="start" spacing={3} position="relative" zIndex={1}>
                                    <HStack justify="space-between" width="100%">
                                        <HStack spacing={3}>
                                            <Icon as={FaCoins} boxSize={6} color="blue.500" />
                                            <Text fontSize="lg" fontWeight="bold" color="gray.700">
                                                {tradingPair || 'Unknown'}
                                            </Text>
                                        </HStack>
                                    </HStack>

                                    <HStack spacing={3} width="100%">
                                        <Icon as={FaWallet} boxSize={5} color="blue.500" />
                                        <Text
                                            fontSize="md"
                                            color="gray.600"
                                            _hover={{ color: 'blue.500' }}
                                        >
                                            {shortenAddress(address)}
                                        </Text>
                                    </HStack>

                                    <VStack align="start" spacing={2} fontSize="sm" width="100%">
                                        <HStack>
                                            <Icon as={TbCalendarTime} boxSize={5} color="blue.500" />
                                            <Text color="gray.600">Create: <span style={{ color: 'blue.600' }}>{createDate}</span></Text>
                                        </HStack>

                                        <HStack>
                                            <Icon as={FaEthereum} boxSize={5} color="blue.500" />
                                            <Text color="gray.600">Strike Price: <span style={{ color: 'orange.500' }}>{strikePrice} USD</span></Text>
                                        </HStack>

                                        <HStack>
                                            <Icon as={TimeIcon} boxSize={5} color="blue.500" />
                                            <Text color="gray.600">
                                                Phase: {' '}
                                                <span style={{ 
                                                    color: phase === Phase.Trading ? "green.500" :
                                                          phase === Phase.Bidding ? "yellow.500" :
                                                          phase === Phase.Maturity ? "orange.500" :
                                                          "red.500"
                                                }}>
                                                    {Phase[phase]}
                                                </span>
                                            </Text>
                                        </HStack>

                                        <HStack>
                                            <Icon as={TimeIcon} boxSize={5} color="blue.500" />
                                            <Text color="gray.600">
                                                Maturity: {maturityTime}
                                            </Text>
                                        </HStack>
                                    </VStack>

                                    <HStack spacing={4} width="100%" justify="space-between" mt={2}>
                                        <VStack align="center" w="48%">
                                            <Text fontWeight="bold" fontSize="sm" color="gray.700">LONG</Text>
                                            <Button
                                                size="sm"
                                                width="full"
                                                colorScheme="green"
                                                variant="outline"
                                            >
                                                {(() => {
                                                    const long = parseFloat(longAmount);
                                                    const short = parseFloat(shortAmount);
                                                    const total = long + short;
                                                    return total > 0 ? `${((long / total) * 100).toFixed(1)}%` : '0%';
                                                })()}
                                            </Button>
                                        </VStack>
                                        <VStack align="center" w="48%">
                                            <Text fontWeight="bold" fontSize="sm" color="gray.700">SHORT</Text>
                                            <Button
                                                size="sm"
                                                width="full"
                                                colorScheme="red"
                                                variant="outline"
                                            >
                                                {(() => {
                                                    const long = parseFloat(longAmount);
                                                    const short = parseFloat(shortAmount);
                                                    const total = long + short;
                                                    return total > 0 ? `${((short / total) * 100).toFixed(1)}%` : '0%';
                                                })()}
                                            </Button>
                                        </VStack>
                                    </HStack>
                                </VStack>
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