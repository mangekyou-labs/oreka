import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, HStack, Icon, Text, VStack, SimpleGrid } from '@chakra-ui/react';
import { CheckIcon, InfoIcon, ExternalLinkIcon, TimeIcon, InfoOutlineIcon } from '@chakra-ui/icons'; // Import icons
import { FaCalendarDay, FaPlayCircle, FaClock, FaCheckCircle, FaListAlt } from 'react-icons/fa'; // Import các biểu tượng
import { IoWalletOutline } from "react-icons/io5";
import { FaEthereum, FaWallet, FaTrophy } from 'react-icons/fa';
import { TbCalendarTime } from 'react-icons/tb';
import { SiBitcoinsv } from "react-icons/si";
import Factory from '../../../out/Factory.sol/Factory.json';
import { useToast } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import fs from 'fs'; // Import fs để đọc file
import { FACTORY_ADDRESS } from '../config/contracts';
import BinaryOptionMarket from '../../../out/BinaryOptionMarket.sol/BinaryOptionMarket.json';

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
}

const ListAddressOwner: React.FC<ListAddressOwnerProps> = ({ ownerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", page }: { ownerAddress: string; page: number }) => {
    const [deployedContracts, setDeployedContracts] = useState<ContractData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isWalletConnected, setIsWalletConnected] = useState(false);
    const [balance, setBalance] = useState('');
    const [walletAddress, setWalletAddress] = useState('');
    const toast = useToast();
    const router = useRouter(); 

    // Phân trang
    const currentPage = page;
    const contractsPerPage = 20;
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

    const connectWallet = async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                const address = await signer.getAddress();
                const balanceWei = await provider.getBalance(address);
                const balanceEth = parseFloat(ethers.utils.formatEther(balanceWei));
                setWalletAddress(address);
                setBalance(balanceEth.toString());
                setIsWalletConnected(true);
                
                toast({
                    title: "Wallet connected successfully!",
                    description: `Address: ${shortenAddress(address)}`,
                    variant: "success",
                    duration: 3000,
                    isClosable: true,
                });
            } catch (error: any) {
                console.error("Failed to connect wallet:", error);
                toast({
                    title: "Failed to connect wallet",
                    description: error.message || "Please make sure MetaMask is installed and unlocked.",
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
            }
        } else {
            toast({
                title: "MetaMask not detected",
                description: "Please install MetaMask to use this feature.",
                status: "warning",
                duration: 5000,
                isClosable: true,
            });
        }
    };

    const fetchDeployedContracts = async () => {
        if (!ownerAddress) {
            console.error("Owner address is not provided");
            setLoading(false);
            return;
        }
        setLoading(true);

        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const contract = new ethers.Contract(FactoryAddress, Factory.abi, provider);

            // Lấy danh sách addresses từ Factory
            const addresses = await contract.getContractsByOwner(ownerAddress);
            console.log("Contracts fetched:", addresses);

            const currentDate = new Date().toLocaleDateString();

            // Map addresses sang ContractData
            const contractsWithPositions = addresses.map((address: string) => {
                const positionsData = localStorage.getItem(`positions_${address}`);
                const positions = positionsData ? JSON.parse(positionsData) : null;
                
                return {
                    address: address,
                    createDate: currentDate,
                    longAmount: positions?.longAmount || "0.0000",
                    shortAmount: positions?.shortAmount || "0.0000"
                };
            });

            setDeployedContracts(contractsWithPositions);
            
            // Cập nhật currentContracts dựa trên trang hiện tại
            const indexOfLastContract = page * contractsPerPage;
            const indexOfFirstContract = indexOfLastContract - contractsPerPage;
            const newCurrentContracts = contractsWithPositions.slice(indexOfFirstContract, indexOfLastContract);
            setCurrentContracts(newCurrentContracts);

        } catch (error) {
            console.error("Error fetching contracts:", error);
        } finally {
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
            if (!isWalletConnected) {
                await connectWallet();
            }

            // Lưu địa chỉ contract vào localStorage
            localStorage.setItem('selectedContractAddress', address);

            // Kiểm tra xem người dùng có phải owner không
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const contract = new ethers.Contract(address, BinaryOptionMarket.abi, signer);
            const owner = await contract.owner();
            const currentAddress = await signer.getAddress();

            // Navigate dựa trên role
            if (owner.toLowerCase() === currentAddress.toLowerCase()) {
                router.push('/ownerdeploy');
            } else {
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


    return (
        <VStack spacing={8} align="stretch" minHeight="100vh" width="100%">
            {!isWalletConnected ? (
                <Button 
                    onClick={connectWallet} 
                    variant="outline" 
                    colorScheme="teal" 
                    position="absolute" 
                    top="30px" 
                    right="50px" 
                    size="sm"
                    padding="2px 4px"
                    borderColor="lightblue" // Màu viền
                    _hover={{ 
                        borderColor: "blue", // Màu viền khi hover
                        boxShadow: "0 0 5px lightblue", // Hiệu ứng nhấp nháy
                    }}
                >
                    <Icon as={IoWalletOutline} mr={2} color="white"/>
                    <Text color="white" fontWeight="bold" >Connect Wallet</Text>
                </Button>
            ) : (
                <HStack spacing={4} justify="space-between" width="500px" color="#FF6B6B">
                    <HStack>
                        <Icon as={FaWallet} />
                        <Text>{shortenAddress(walletAddress)}</Text>
                    </HStack>
                    <HStack>
                        <Icon as={FaEthereum} />
                        <Text>{parseFloat(balance).toFixed(4)} ETH</Text>
                    </HStack>
                </HStack>
            )}
            <HStack spacing={0} align="stretch" flexGrow={1}>
                {/* NAVIGATION - Đẩy sát trái hơn */}
                <Box width="250px" p={4} ml={-4} backgroundColor="#1A1A1A" borderRadius="md">
                    <Text fontSize="2xl" fontWeight="bold" color="white" mb={6}>NAVIGATION</Text>
                    <VStack spacing={3} align="start">
                        <Button 
                            variant="ghost" 
                            width="100%" 
                            leftIcon={<FaCalendarDay />} 
                            _hover={{ bg: "#222222", color: "#FEDF56" }} 
                            justifyContent="flex-start" // Căn trái
                        >
                            Today
                        </Button>
                        <Button 
                            variant="ghost" 
                            width="100%" 
                            leftIcon={<FaPlayCircle />} 
                            _hover={{ bg: "#222222", color: "#FEDF56" }} 
                            justifyContent="flex-start"
                        >
                            In-Play
                        </Button>
                        <Button 
                            variant="ghost" 
                            width="100%" 
                            leftIcon={<FaClock />} 
                            _hover={{ bg: "#222222", color: "#FEDF56" }} 
                            justifyContent="flex-start"
                        >
                            Up Coming
                        </Button>
                        <Button 
                            variant="ghost" 
                            width="100%" 
                            leftIcon={<FaCheckCircle />} 
                            _hover={{ bg: "#222222", color: "#FEDF56" }} 
                            justifyContent="flex-start"
                        >
                            Ended
                        </Button>
                        <Button 
                            variant="ghost" 
                            width="100%" 
                            leftIcon={<FaListAlt />} 
                            _hover={{ bg: "#2D3748", color: "#FEDF56" }} 
                            justifyContent="flex-start"
                        >
                            All Events
                        </Button>
                    </VStack>
                </Box>

                {/* ALL EVENTS - Tăng kích thước các tab */}
                <Box flex={1} p={6}>
                    <Text fontSize="2xl" fontWeight="bold" mb={6}>ALL EVENTS</Text>
                    {loading ? (
                        <Text>Loading...</Text>
                    ) : deployedContracts.length > 0 ? (
                        <SimpleGrid 
                            columns={{ base: 1, md: 2, lg: 3, xl: 4 }}
                            spacing={4}
                            width="100%"
                        >
                            {currentContracts.map(({ address, createDate, longAmount, shortAmount }, index) => (
                                <Box
                                    key={index}
                                    p={4}
                                    borderWidth={1}
                                    borderRadius="lg"
                                    bg="#1A1A1A"
                                    onClick={() => handleAddressClick(address)}
                                    cursor="pointer"
                                    minH="250px"
                                    _hover={{
                                        transform: "translateY(-4px)",
                                        boxShadow: "0 4px 12px rgba(254, 223, 86, 0.2)",
                                        transition: "all 0.3s ease",
                                        bg: "#2D2D2D"
                                    }}
                                >
                                    <VStack align="start" spacing={3}>
                                        <HStack spacing={3}>
                                            <Icon as={SiBitcoinsv} boxSize={8} color="#FEDF56" />
                                            <Text fontSize="xl" fontWeight="bold">
                                                BTC/USD
                                            </Text>
                                        </HStack>

                                        <HStack spacing={3} width="100%">
                                            <Icon as={FaWallet} boxSize={5} color="#FEDF56" />
                                            <Text
                                                fontSize="md"
                                                color="#FEDF56"
                                                _hover={{ color: '#FF6699' }}
                                            >
                                                {shortenAddress(address)}
                                            </Text>
                                        </HStack>

                                        <VStack align="start" spacing={2} fontSize="sm" width="100%">
                                            <HStack>
                                                <Icon as={TbCalendarTime} boxSize={5} color="#FEDF56" />
                                                <Text>Create: <span style={{ color: '#33FFFF' }}>{createDate}</span></Text>
                                            </HStack>
                                            <HStack>
                                                <Icon as={TimeIcon} boxSize={5} />
                                                <Text>Resolve: <span style={{ color: '#FF0033' }}>26/10/2024</span></Text>
                                            </HStack>
                                            <HStack>
                                                <Icon as={TimeIcon} boxSize={5} />
                                                <Text>Time: <span style={{ color: "#00FF00" }}>7am</span></Text>
                                            </HStack>
                                        </VStack>

                                        <HStack spacing={4} width="100%" justify="space-between" mt={2}>
                                            <VStack align="center" w="48%">
                                                <Text fontWeight="bold" fontSize="sm">LONG</Text>
                                                <Button
                                                    size="md"
                                                    width="full"
                                                    height="32px"
                                                    colorScheme="green"
                                                    bg="#00EE00"
                                                    _hover={{ bg: "#00CC00" }}
                                                    fontSize="sm"
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
                                                <Text fontWeight="bold" fontSize="sm">SHORT</Text>
                                                <Button
                                                    size="md"
                                                    width="full"
                                                    height="32px"
                                                    colorScheme="red"
                                                    bg="#FF0033"
                                                    _hover={{ bg: "#CC0033" }}
                                                    fontSize="sm"
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
                        <Text>No contracts found for this owner.</Text>
                    )}
                </Box>
            </HStack>

            {/* Footer với nút phân trang */}
            <Box as="footer" p={4} textAlign="center">
                <HStack spacing={2} justify="center">
                    {Array.from({ length: Math.ceil(deployedContracts.length / contractsPerPage) }, (_, index) => (
                        <Button
                            key={index + 1}
                            colorScheme="pink"
                            onClick={() => router.push(`/listaddress/${index + 1}`)}
                            isActive={page === index + 1}
                        >   
                            {index + 1}
                        </Button>
                    ))}
                </HStack>
            </Box>
        </VStack>
    );
};

export default ListAddressOwner;