import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, VStack, useToast, HStack, Text, Flex, Icon, Spacer, Circle } from '@chakra-ui/react';
import { FaWallet, FaEthereum, FaChevronLeft } from 'react-icons/fa';
import BinaryOptionMarket from '../../../out/BinaryOptionMarket.sol/BinaryOptionMarket.json';
import { fetchMarketDetails } from './Customer';
import { FACTORY_ADDRESS } from '../config/contracts';
import { useRouter } from 'next/router';

// Thêm enum Phase vào đầu file, sau các imports
enum Phase { Trading, Bidding, Maturity, Expiry }

interface OwnerDeployProps {
  address: string;
}

const OwnerDeploy: React.FC<OwnerDeployProps> = ({ address }) => {
  const [contractAddress, setContractAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [contractBalance, setContractBalance] = useState('');
  const [currentPhase, setCurrentPhase] = useState<Phase>(Phase.Trading);
  const toast = useToast();
  const router = useRouter();

  // Thêm useEffect để lấy địa chỉ contract từ localStorage
  useEffect(() => {
    const savedAddress = localStorage.getItem('selectedContractAddress');
    if (savedAddress) {
      setContractAddress(savedAddress);
    }
  }, []);

  // Thêm useEffect để tự động kết nối khi component mount
  useEffect(() => {
    const autoConnect = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          const address = await signer.getAddress();
          setWalletAddress(address);
        } catch (error) {
          console.error("Auto connect failed:", error);
          router.push('/listaddress'); // Redirect về list nếu không kết nối được
        }
      }
    };
    autoConnect();
  }, []);

  // Fetch contract balance
  const fetchContractBalance = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contractBalanceWei = await provider.getBalance(contractAddress);
      const contractBalanceEth = parseFloat(ethers.utils.formatEther(contractBalanceWei));
      setContractBalance(contractBalanceEth.toFixed(4));
    } catch (error: any) {
      console.error("Failed to fetch contract balance:", error);
      toast({
        title: "Error fetching contract balance",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

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
      fetchContractBalance();
      
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

      const tx = await contract.withdraw();
      await tx.wait();

      fetchContractBalance();
      
      toast({
        title: "Withdrawal successful!",
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

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  useEffect(() => {
    if (contractAddress) {
      fetchContractBalance();
    }
  }, [contractAddress]);

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
          {/* Wallet Info */}
          <HStack spacing={6} justify="space-between" width="100%" fontSize="xl">
            <HStack>
              <Icon as={FaWallet} w={6} h={6} color="#FEDF56" />
              <Text>{shortenAddress(walletAddress)}</Text>
            </HStack>
            <HStack>
              <Icon as={FaEthereum} w={6} h={6} color="#FEDF56" />
              <Text>{contractBalance} ETH</Text>
            </HStack>
            <Button 
              onClick={withdraw}
              size="lg"
              colorScheme="yellow" 
              variant="outline"
              fontSize="xl"
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