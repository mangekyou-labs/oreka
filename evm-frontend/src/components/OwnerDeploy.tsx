import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, VStack, useToast, HStack, Text, Flex, Icon } from '@chakra-ui/react';
import { FaWallet, FaEthereum } from 'react-icons/fa';
import BinaryOptionMarket from '../../../out/BinaryOptionMarket.sol/BinaryOptionMarket.json';
import { fetchMarketDetails } from './Customer';
import { FACTORY_ADDRESS } from '../config/contracts';

interface OwnerDeployProps {
  address: string;
}

const OwnerDeploy: React.FC<OwnerDeployProps> = ({ address }) => {
  const [contractAddress, setContractAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [contractBalance, setContractBalance] = useState('');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const toast = useToast();

  useEffect(() => {
    // Lấy địa chỉ contract từ localStorage khi component mount
    const savedAddress = localStorage.getItem('selectedContractAddress');
    if (savedAddress) {
      setContractAddress(savedAddress);
    }
  }, []);

  // Kết nối ví
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        setWalletAddress(address);
        setIsWalletConnected(true);
        
        toast({
          title: "Wallet connected successfully!",
          description: `Address: ${shortenAddress(address)}`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (error: any) {
        console.error("Failed to connect wallet:", error);
        toast({
          title: "Failed to connect wallet",
          description: error.message,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    }
  };

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

  // Start Trading Phase
  const startTrading = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddress, BinaryOptionMarket.abi, signer);

      const tx = await contract.startTrading();
      await tx.wait();

      fetchContractBalance();
      await fetchMarketDetails(contract);
      
      toast({
        title: "Trading started!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error("Failed to start trading:", error);
      toast({
        title: "Failed to start trading",
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
    <Flex direction="column" alignItems="center" justifyContent="flex-start" p={6} bg="black" minH="100vh" position="relative">
      <VStack
        width={{ base: '95%', md: '1000px' }}  // Tăng width của container
        spacing={6}  // Giảm spacing giữa các phần tử
        align="stretch"
        color="#FEDF56"
        fontFamily="Arial, sans-serif"
        
      >
        {!isWalletConnected ? (
          <Button
            onClick={connectWallet}
            backgroundColor="#FEDF56"
            color="#5D3A1A"
            _hover={{ backgroundColor: "#D5D5D5" }}
            padding="30px"  // Tăng padding
            borderRadius="full"
            fontWeight="bold"
            fontSize="2xl"  // Tăng font size
            w="full"
          >
            Connect Wallet
          </Button>
        ) : (
          <VStack spacing={6} align="stretch" >  // Giảm spacing
            {/* Top row with wallet info and balance */}
            <HStack spacing={6} justify="space-between" width="100%" fontSize="xl">  // Tăng font size và spacing
              <HStack>
                <Icon as={FaWallet} w={6} h={6} />  // Tăng kích thước icon
                <Text>{shortenAddress(walletAddress)}</Text>
              </HStack>
              <HStack>
                <Icon as={FaEthereum} w={6} h={6} />  // Tăng kích thước icon
                <Text>{contractBalance} ETH</Text>
              </HStack>
              <Button 
                onClick={withdraw}
                size="lg"  // Tăng kích thước button
                colorScheme="yellow" 
                variant="outline"
                fontSize="xl"  // Tăng font size
              >
                Withdraw
              </Button>
            </HStack>

            {/* Contract Address without border */}
            <Flex justify="center" width="100%" mt={10} mt = "100px">
              <Text fontSize="2xl">
                Contract Address: {contractAddress}
              </Text>
            </Flex>

            {/* Action Buttons in a row with spacing */}
            <HStack spacing={55} justify="center" minH="10vh">  
              <Button
                onClick={startTrading}
                bg="#FEDF56"
                color="black"
                _hover={{ bg: "#D5D5D5", transform: "scale(1.05)" }}  // Thêm hiệu ứng scale
                width="300px"  // Tăng width
                height="70px"  // Tăng height
                fontSize="2xl"  // Tăng font size
                transition="all 0.2s"
              >
                Start Trading
              </Button>

              <Button
                onClick={resolveMarket}
                bg="#FEDF56"
                color="black"
                _hover={{ bg: "#D5D5D5", transform: "scale(1.05)" }}
                width="300px"
                height="70px"
                fontSize="2xl"
                transition="all 0.2s"
              >
                Resolve Market
              </Button>

              <Button
                onClick={expireMarket}
                bg="#FEDF56"
                color="black"
                _hover={{ bg: "#D5D5D5", transform: "scale(1.05)" }}
                width="300px"
                height="70px"
                fontSize="2xl"
                transition="all 0.2s"
              >
                Expire Market
              </Button>
            </HStack>
          </VStack>
        )}
      </VStack>
    </Flex>
);
};
export default OwnerDeploy;