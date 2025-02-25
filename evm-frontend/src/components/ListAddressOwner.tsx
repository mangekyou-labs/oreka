import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, HStack, Icon, Text, VStack } from '@chakra-ui/react';
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

interface ListAddressOwnerProps {
    ownerAddress: string; // Đảm bảo ownerAddress là địa chỉ hợp lệ
    page: number;
}

const ListAddressOwner: React.FC<ListAddressOwnerProps> = ({ ownerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", page }: { ownerAddress: string; page: number }) => {
    const [deployedContracts, setDeployedContracts] = useState<{ address: string; createDate: string }[]>([]); // Update type
    const [loading, setLoading] = useState<boolean>(true);
    const [isWalletConnected, setIsWalletConnected] = useState(false);
    const [balance, setBalance] = useState('');
    const [walletAddress, setWalletAddress] = useState('');
    const toast = useToast();
    const router = useRouter(); 

    // Phân trang
    const currentPage = page;
    const contractsPerPage = 8;
    const [currentContracts, setCurrentContracts] = useState<{ address: string; createDate: string }[]>([]);

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
        console.log("Fetching contracts for owner address:", ownerAddress);

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(FactoryAddress, Factory.abi, provider);

        try {
            const contracts = await contract.getContractsByOwner(ownerAddress);
            console.log("Contracts fetched from Factory contract:", contracts);
            const currentDate = new Date().toLocaleDateString();
            const contractsWithDate = contracts.map(address => ({ address, createDate: currentDate }));
            setDeployedContracts(contractsWithDate);
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

    const handleAddressClick = (address: string) => {
        const contractDetails = deployedContracts.find(contract => contract.address === address);
        
        if (contractDetails) {
            // Lưu contractAddress vào localStorage
            localStorage.setItem('selectedContractAddress', address);
    
            const targetPath = walletAddress === ownerAddress ? '/ownerdeploy' : '/customer';
            
            router.push({
                pathname: targetPath,
                query: {
                    address,
                    //currentPhase: contractDetails.currentPhase
                },
            });
        } else {
            toast({
                title: "Invalid address",
                description: "The address you clicked is not valid.",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    };
    
    
     // Hàm rút gọn địa chỉ ví
     const shortenAddress = (address: string) => {
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
                {/* Bên Trái: Danh sách Coin */}
                <Box width="30%" p={4} ml={0} backgroundColor="#1A1A1A" borderRadius="md">
                    <Text fontSize="2xl" fontWeight="bold" color="white">NAVIGATION</Text>
                    <VStack spacing={2} mt={4} align="start">
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

                {/* Bên Phải: Danh sách Sự kiện */}
                <Box width="70%" p={4}>
                    <Text fontSize="2xl" fontWeight="bold">ALL EVENTS</Text>
                    {loading ? (
                        <Text>Loading...</Text>
                    ) : deployedContracts.length > 0 ? (
                        currentContracts.map(({ address, createDate }, index) => (
                            <Box key={index} p={4} borderWidth={1} borderRadius="md" mb={4} backgroundColor="#1A1A1A">
                                <HStack justify="space-between" align="center">
                                    <VStack align="start">
                                    <HStack spacing={2} align="center">
                                        <Icon as={SiBitcoinsv} boxSize={6} color="#FEDF56" />
                                            <Text fontSize="lg" fontWeight="bold">
                                                WIF/USD {(page - 1) * contractsPerPage + index + 1}
                                            </Text>
                                        </HStack>   
                                        <HStack>
                                        <Icon as={FaWallet} boxSize={6} mr={2} color="#FEDF56" />
                                        <Text 
                                            fontWeight="bold" 
                                            fontSize="lg" 
                                            onClick={() => handleAddressClick(address)} // Thay đổi ở đây
                                            style={{ cursor: 'pointer', color: '#FEDF56', transition: 'color 0.3s'}}
                                            _hover={{ color: '#FF6699', textDecoration: 'underline', fontStyle: 'italic' }}
                                        >
                                            Contract Address: {shortenAddress(address)}
                                        </Text>
                                        </HStack>
                                        <HStack>
                                            <Icon as={TbCalendarTime} boxSize={4} mr={2} color="#FEDF56" />
                                            <Text fontSize="sm"> 
                                                Create Date: <span style={{ color: '#33FFFF' }}>{createDate}   </span>
                                                Resolve Date: <span style={{ color: '#FF0033' }}>26/10/2024   </span>
                                                <Icon as={TimeIcon} boxSize={4} mr={2}/>Time: <span style={{ color:"#00FF00" }}>7am</span></Text>
                                        </HStack>
                                    </VStack>
                                    <HStack spacing={4}>
                                        <VStack align="center">
                                            <Text fontWeight="bold">LONG</Text>
                                            <Button colorScheme="green" size="sm" backgroundColor="#00EE00" width="150px">
                                                0.0000
                                            </Button>
                                        </VStack>
                                        <VStack align="center">
                                            <Text fontWeight="bold">SHORT</Text>
                                            <Button colorScheme="red" size="sm" backgroundColor="#FF0033" width="150px">
                                                0.0000
                                            </Button>
                                        </VStack>
                                    </HStack>
                                </HStack>
                            </Box>
                        ))
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