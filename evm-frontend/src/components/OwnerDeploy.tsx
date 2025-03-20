import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, VStack, useToast, HStack, Text, Flex, Icon, Spacer, Circle } from '@chakra-ui/react';
import { FaWallet, FaEthereum, FaChevronLeft } from 'react-icons/fa';
import BinaryOptionMarket from '../contracts/abis/BinaryOptionMarketABI.json';
import { fetchMarketDetails } from './Customer';
import { FACTORY_ADDRESS } from '../config/contracts';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

// Thêm enum Phase vào đầu file, sau các imports
enum Phase { Trading, Bidding, Maturity, Expiry }

interface OwnerDeployProps {
  address: string;
}

const OwnerDeploy: React.FC<OwnerDeployProps> = ({ address }) => {
  const { isConnected, walletAddress, balance, connectWallet, refreshBalance } = useAuth();
  const [contractAddress, setContractAddress] = useState('');
  const [contractBalance, setContractBalance] = useState('');
  const [currentPhase, setCurrentPhase] = useState<Phase>(Phase.Trading);
  const toast = useToast();
  const router = useRouter();

  // Thêm useEffect để tự động kết nối khi component mount
  useEffect(() => {
    const autoConnect = async () => {
      if (!isConnected) {
        try {
          await connectWallet();
        } catch (error) {
          console.error("Auto connect failed:", error);
          router.push('/listaddress');
        }
      }
    };
    autoConnect();
  }, []);

  // Thêm useEffect để theo dõi kết nối
  useEffect(() => {
    if (!isConnected) {
      router.push('/listaddress');
    }
  }, [isConnected]);

  // Thêm useEffect để lấy địa chỉ contract từ localStorage
  useEffect(() => {
    const savedAddress = localStorage.getItem('selectedContractAddress');
    if (savedAddress) {
      setContractAddress(savedAddress);
    }
  }, []);

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

  // Sửa lại fetchBalances để chỉ lấy contract balance
  const fetchBalances = async () => {
    if (!contractAddress) return;
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contractBalanceWei = await provider.getBalance(contractAddress);
      const contractBalanceEth = parseFloat(ethers.utils.formatEther(contractBalanceWei));
      setContractBalance(contractBalanceEth.toFixed(4));
    } catch (error) {
      console.error("Failed to fetch balances:", error);
    }
  };

  // Cập nhật useEffect để gọi fetchBalances
  useEffect(() => {
    if (contractAddress) {
      fetchBalances();
      const interval = setInterval(fetchBalances, 5000); // Refresh mỗi 5 giây
      return () => clearInterval(interval);
    }
  }, [contractAddress]);

  // Thêm hàm để fetch phase hiện tại
  const fetchCurrentPhase = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, BinaryOptionMarket.abi, provider);
      const phase = await contract.currentPhase();
      setCurrentPhase(phase);
    } catch (error) {
      console.error("Error fetching phase:", error);
    }
  };

  // Gọi fetchCurrentPhase khi component mount và khi contractAddress thay đổi
  useEffect(() => {
    if (contractAddress) {
      fetchCurrentPhase();
    }
  }, [contractAddress]);

  // Đổi tên và logic của hàm startTrading thành startBidding
  const startBidding = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddress, BinaryOptionMarket.abi, signer);

      const tx = await contract.startBidding();
      await tx.wait();

      // Cập nhật phase sau khi transaction thành công
      await fetchCurrentPhase();
      fetchBalances();
      
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

  // Resolve Market
  const resolveMarket = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddress, BinaryOptionMarket.abi, signer);

      const tx = await contract.resolveMarket();
      await tx.wait();
      
      await fetchMarketDetails(contract);
      
      toast({
        title: "Market resolved!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error("Failed to resolve market:", error);
      toast({
        title: "Failed to resolve market",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Expire Market
  const expireMarket = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddress, BinaryOptionMarket.abi, signer);

      const tx = await contract.expireMarket();
      await tx.wait();
      
      await fetchMarketDetails(contract);
      
      toast({
        title: "Market expired!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error("Failed to expire market:", error);
      toast({
        title: "Failed to expire market",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Withdraw funds
  const withdraw = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddress, BinaryOptionMarket.abi, signer);

      // Lấy số dư contract trước khi withdraw
      const balanceBefore = await provider.getBalance(contractAddress);
      console.log("Balance before withdraw:", ethers.utils.formatEther(balanceBefore));

      const tx = await contract.withdraw();
      await tx.wait();

      // Lấy số dư contract sau khi withdraw
      const balanceAfter = await provider.getBalance(contractAddress);
      console.log("Balance after withdraw:", ethers.utils.formatEther(balanceAfter));

      // Tính số tiền đã rút (10%)
      const withdrawnAmount = balanceBefore.sub(balanceAfter);
      console.log("Withdrawn amount (10%):", ethers.utils.formatEther(withdrawnAmount));

      // Cập nhật lại balances
      await fetchBalances();
      
      toast({
        title: "Withdrawal successful!",
        description: `Withdrawn ${ethers.utils.formatEther(withdrawnAmount)} ETH (10% of contract balance)`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error("Failed to withdraw:", error);
      toast({
        title: "Failed to withdraw",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleWithdrawClick = () => {
    if (currentPhase !== Phase.Expiry) {
        toast({
            title: "Cannot withdraw",
            description: "Withdrawal is only available in Expiry phase",
            status: "warning",
            duration: 3000,
            isClosable: true,
        });
        return;
    }
    
    if (parseFloat(contractBalance) <= 0) {
        toast({
            title: "Cannot withdraw",
            description: "No balance available to withdraw",
            status: "warning",
            duration: 3000,
            isClosable: true,
        });
        return;
    }

    withdraw();
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Sử dụng khi cần
  const factoryAddress = FACTORY_ADDRESS;

  return (
    <Box bg="black" minH="100vh">
      {/* Header với Markets button */}
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

      <Flex direction="column" alignItems="center" p={6}>
        <VStack width={{ base: '95%', md: '1000px' }} spacing={8} align="stretch">
          {/* Wallet Info - Updated UI */}
          <HStack 
            spacing={6} 
            justify="space-between" 
            width="100%" 
            fontSize="xl"
            bg="gray.900"
            p={4}
            borderRadius="xl"
            border="1px solid"
            borderColor="gray.700"
          >
            {/* Wallet Address */}
            <HStack>
              <Icon as={FaWallet} w={6} h={6} color="#FEDF56" />
              <VStack align="start" spacing={1}>
                <Text color="gray.400" fontSize="sm">Wallet Address</Text>
                <Text color="#FEDF56">{shortenAddress(walletAddress)}</Text>
              </VStack>
            </HStack>

            {/* Wallet Balance */}
            <HStack>
              <Icon as={FaEthereum} w={6} h={6} color="#FEDF56" />
              <VStack align="start" spacing={1}>
                <Text color="gray.400" fontSize="sm">Wallet Balance</Text>
                <Text color="#FEDF56">{parseFloat(balance).toFixed(4)} ETH</Text>
              </VStack>
            </HStack>

            {/* Contract Balance */}
            <HStack>
              <Icon as={FaEthereum} w={6} h={6} color="#00FF00" />
              <VStack align="start" spacing={1}>
                <Text color="gray.400" fontSize="sm">Contract Balance</Text>
                <Text color="#00FF00">{contractBalance} ETH</Text>
              </VStack>
            </HStack>

            {/* Withdraw Button */}
            <Button 
              onClick={handleWithdrawClick}
              size="lg"
              colorScheme="yellow" 
              variant="outline"
              fontSize="xl"
              isDisabled={parseFloat(contractBalance) <= 0 || currentPhase !== Phase.Expiry}
              title={currentPhase !== Phase.Expiry ? "Withdrawal available only in Expiry phase" : ""}
            >
              Withdraw
            </Button>
          </HStack>

          {/* Contract Address - Đã sửa thành một hàng */}
          <HStack spacing={4} justify="center">
            <Text fontSize="2xl" color="#FEDF56">Contract Address:</Text>
            <Text fontSize="2xl" color="#FEDF56">{contractAddress}</Text>
          </HStack>

          {/* Phase Timeline nằm ngang */}
          <Flex justify="center" mt={4}>
            <HStack spacing={8} position="relative">
              {/* Line kết nối các phase */}
              <Box
                position="absolute"
                left="30px"
                right="30px"
                height="2px"
                bg="gray.700"
                top="15px"
                zIndex={0}
              />

              {/* Trading Phase */}
              <VStack spacing={2} zIndex={1}>
                <Circle
                  size="30px"
                  bg={currentPhase === Phase.Trading ? "#FEDF56" : "gray.700"}
                  color={currentPhase === Phase.Trading ? "black" : "gray.500"}
                  fontWeight="bold"
                >
                  1
                </Circle>
                <Text color={currentPhase === Phase.Trading ? "#FEDF56" : "gray.500"}>
                  Trading
                </Text>
              </VStack>

              {/* Bidding Phase */}
              <VStack spacing={2} zIndex={1}>
                <Circle
                  size="30px"
                  bg={currentPhase === Phase.Bidding ? "#FEDF56" : "gray.700"}
                  color={currentPhase === Phase.Bidding ? "black" : "gray.500"}
                  fontWeight="bold"
                >
                  2
                </Circle>
                <Text color={currentPhase === Phase.Bidding ? "#FEDF56" : "gray.500"}>
                  Bidding
                </Text>
              </VStack>

              {/* Maturity Phase */}
              <VStack spacing={2} zIndex={1}>
                <Circle
                  size="30px"
                  bg={currentPhase === Phase.Maturity ? "#FEDF56" : "gray.700"}
                  color={currentPhase === Phase.Maturity ? "black" : "gray.500"}
                  fontWeight="bold"
                >
                  3
                </Circle>
                <Text color={currentPhase === Phase.Maturity ? "#FEDF56" : "gray.500"}>
                  Maturity
                </Text>
              </VStack>

              {/* Expiry Phase */}
              <VStack spacing={2} zIndex={1}>
                <Circle
                  size="30px"
                  bg={currentPhase === Phase.Expiry ? "#FEDF56" : "gray.700"}
                  color={currentPhase === Phase.Expiry ? "black" : "gray.500"}
                  fontWeight="bold"
                >
                  4
                </Circle>
                <Text color={currentPhase === Phase.Expiry ? "#FEDF56" : "gray.500"}>
                  Expiry
                </Text>
              </VStack>
            </HStack>
          </Flex>

          {/* Start Bidding Button */}
          <Flex justify="center" mt={6}>
            <Button
              onClick={startBidding}
              bg="#FEDF56"
              color="black"
              _hover={{ bg: "#D5D5D5", transform: "scale(1.05)" }}
              width="300px"
              height="70px"
              fontSize="2xl"
              transition="all 0.2s"
              isDisabled={currentPhase !== Phase.Trading}
            >
              Start Bidding
            </Button>
          </Flex>
        </VStack>
      </Flex>
    </Box>
  );
};

export default OwnerDeploy;