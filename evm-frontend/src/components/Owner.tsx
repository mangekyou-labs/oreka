import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, Input, VStack, useToast, HStack, Icon, SimpleGrid, Text } from '@chakra-ui/react';
import { FaEthereum, FaWallet } from 'react-icons/fa';
import BinaryOptionMarket from '../../../out/BinaryOptionMarket.sol/BinaryOptionMarket.json';
import Factory from '../../../out/Factory.sol/Factory.json';  // ABI của Factory contract
import ListAddressOwner from './ListAddressOwner'; // Import ListAddressOwner
import { fetchMarketDetails } from './Customer'; 
import fs from 'fs'; // Import fs để đọc file
import { FACTORY_ADDRESS } from '../config/contracts';

interface OwnerProps {
  address: string;
}
const Owner : React.FC<OwnerProps> = ({ address })=> {
  const [contractAddress, setContractAddress] = useState('');
  const [strikePrice, setStrikePrice] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState('');
  const [contractBalance, setContractBalance] = useState(''); 
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [deployedContracts, setDeployedContracts] = useState<string[]>([]); // Add this line
  const [factoryAddress, setFactoryAddress] = useState('');
  
  
  
  //const [FactoryAddress, setFactoryAddress] = useState<string>('');
  const FactoryAddress = FACTORY_ADDRESS;
  const toast = useToast();
//   useEffect(() => {
//     // Đọc địa chỉ từ file JSON
//     const data = fs.readFileSync('deployed_address.json', 'utf8');
//     const json = JSON.parse(data);
//     setFactoryAddress(json.FactoryAddress);
// }, []);





  useEffect(() => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, provider);

    // Lắng nghe sự kiện Deployed
    factoryContract.on("Deployed", (owner, newContractAddress, index) => {
      console.log("Event 'Deployed' received:");
      console.log("Owner:", owner);
      console.log("New contract deployed:", newContractAddress);
      console.log("Index:", index);
      
      setContractAddress(newContractAddress);
      setDeployedContracts(prev => [...prev, newContractAddress]); // Cập nhật danh sách contract

      toast({
        title: "Contract deployed successfully!",
        description: `New Contract Address: ${newContractAddress}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    });

    return () => {
      // Cleanup: hủy lắng nghe khi component bị unmount
      console.log("Removing event listener on Factory contract...");
      factoryContract.removeAllListeners("Deployed");
    };
  }, []);

  // Hàm triển khai hợp đồng mới
  const deployContract = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Tạo đối tượng ContractFactory từ bytecode và ABI của hợp đồng
      const factory = new ethers.ContractFactory(BinaryOptionMarket.abi, BinaryOptionMarket.bytecode, signer);
      
      // Chuyển đổi strikePrice thành số
      const strikePriceValue = parseFloat(strikePrice);
      if (isNaN(strikePriceValue)) {
        throw new Error("Invalid strike price");
      }
  
      // Salt ngẫu nhiên
      
      console.log("Wallet Address:", walletAddress);
      console.log("Strike Price Value:", strikePriceValue);
  
      // Triển khai hợp đồng
      const contract = await factory.deploy(walletAddress, strikePriceValue); // Triển khai hợp đồng với tham số constructor
      await contract.deployed();
      
      console.log("Contract deployed at:", contract.address);
      
      setContractAddress(contract.address);
      const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, signer);
      await factoryContract.deploy(contract.address);
      // Hiển thị thông báo thành công
      await fetchContractsByOwner(); // Gọi hàm này để lấy hợp đồng
      toast({
        title: "Contract deployed successfully!",
        description: `Contract deployed at: ${contract.address}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error("Failed to deploy contract:", error);
      toast({
        title: "Failed to deploy contract",
        description: error.message || "An unexpected error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };
  

  // Kết nối Metamask
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

  // Rút gọn địa chỉ ví
  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Triển khai hợp đồng với CREATE2
    // Triển khai hợp đồng với CREATE2
// Triển khai hợp đồng với CREATE2
  
  // Chuyển đổi trạng thái từ Bidding sang Trading
  const startTrading = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const binaryOptionMarketContract = new ethers.Contract(contractAddress, BinaryOptionMarket.abi, signer);

      const tx = await binaryOptionMarketContract.startTrading();
      await tx.wait();

      fetchContractBalance();
      await fetchMarketDetails(binaryOptionMarketContract);
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
        description: error.message || "An unexpected error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Chuyển đổi trạng thái từ Trading sang Maturity
  const resolveMarket = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const binaryOptionMarketContract = new ethers.Contract(contractAddress, BinaryOptionMarket.abi, signer);

      const tx = await binaryOptionMarketContract.resolveMarket();
      await tx.wait();
      await fetchMarketDetails(binaryOptionMarketContract);
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
        description: error.message || "An unexpected error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Chuyển đổi trạng thái từ Maturity sang Expiry
  const expireMarket = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const binaryOptionMarketContract = new ethers.Contract(contractAddress, BinaryOptionMarket.abi, signer);

      const tx = await binaryOptionMarketContract.expireMarket();
      await tx.wait();
      await fetchMarketDetails(binaryOptionMarketContract);
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
        description: error.message || "An unexpected error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Cập nhật giá strike
  const updateStrikePrice = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const binaryOptionMarketContract = new ethers.Contract(contractAddress, BinaryOptionMarket.abi, signer);

      const tx = await binaryOptionMarketContract.setStrikePrice(strikePrice);
      await tx.wait();

      toast({
        title: "Strike price updated!",
        description: `New strike price: ${strikePrice}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error("Failed to update strike price:", error);
      toast({
        title: "Failed to update strike price",
        description: error.message || "An unexpected error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  const fetchContractBalance = async () => {
    try {
      console.log("Fetching contract balance..."); // Log trước khi lấy balance
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contractBalanceWei = await provider.getBalance(contractAddress); // Lấy số dư của contract
      const contractBalanceEth = parseFloat(ethers.utils.formatEther(contractBalanceWei)); // Chuyển đổi từ Wei sang ETH
      setContractBalance(contractBalanceEth.toFixed(4)); // Cập nhật số dư
      console.log("Contract Balance:", contractBalanceEth);
    } catch (error: any) {
      console.error("Failed to fetch contract balance:", error); // In lỗi nếu có vấn đề
      toast({
        title: "Error fetching contract balance",
        description: error.message || "An unexpected error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  useEffect(() => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, provider);

    // Lắng nghe sự kiện ContractStored để cập nhật hợp đồng khi có hợp đồng mới
    factoryContract.on("Deployed", (owner, contractAddress, index) => {
      console.log("New contract stored:", contractAddress);
      fetchContractsByOwner(); // Cập nhật danh sách hợp đồng sau khi nhận sự kiện
    });

    return () => {
      // Hủy lắng nghe sự kiện khi component bị unmount
      factoryContract.off("Deployed", (owner, contractAddress, index) => {
        console.log("New contract stored:", contractAddress);
        fetchContractsByOwner(); // Cập nhật danh sách hợp đồng sau khi nhận sự kiện
      });
    };
  }, [walletAddress]);
  const fetchContractsByOwner = async () => {
    // if (!walletAddress) {
    //   console.error("Wallet address not available");
    //   toast({
    //     title: "No Wallet Connected",
    //     description: "Please connect your wallet first.",
    //     status: "warning",
    //     duration: 3000,
    //     isClosable: true,
    //   });
    //   return;
    // }
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(FactoryAddress, Factory.abi, provider);
      const contracts = await contract.getContractsByOwner(walletAddress);
      console.log("Contracts fetched:", contracts);
      setDeployedContracts(contracts);
    } catch (error: any) {
      console.error("Failed to fetch contracts by owner:", error);
      toast({
        title: "Error fetching contracts",
        description: error.message || "An unexpected error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };
  

  

  const withdraw = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const binaryOptionMarketContract = new ethers.Contract(contractAddress, BinaryOptionMarket.abi, signer);

      const tx = await binaryOptionMarketContract.withdraw();
      await tx.wait();

      toast({
        title: "Withdrawal successful!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      fetchContractBalance(); // Cập nhật lại số dư sau khi rút
    } catch (error: any) {
      console.error("Failed to withdraw:", error);
      toast({
        title: "Failed to withdraw",
        description: error.message || "An unexpected error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  useEffect(() => {
    if (contractAddress) {
      fetchContractBalance();
    }
  }, [contractAddress]);
  useEffect(() => {
    if (contractAddress) {
      fetchContractBalance();
      console.log("Fetching contracts for owner:", walletAddress); // Log địa chỉ ví
      fetchContractsByOwner(); // Gọi hàm này để lấy hợp đồng
    }
  }, [contractAddress, walletAddress]); // Thêm walletAddress vào dependency array nếu cần


  return (
    <VStack color="#FEDF56" fontFamily="Arial, sans-serif" >
      {!isWalletConnected ? (
        <Button 
          onClick={connectWallet} 
          colorScheme="teal" 
          color="yellow"
          fontSize="4xl"
          fontWeight="bold"
          w="500px"
          p={8}
          _hover={{ bg: "teal.500", transform: "scale(1.05)" }}>
            Connect Wallet
        </Button>
      ) : (
        <>
          <HStack spacing={4} justify="space-between" width="500px" color="#FF6B6B">
            <HStack>
              <Icon as={FaWallet} />
              <Text>{shortenAddress(walletAddress)}</Text>
            </HStack>
            <HStack>
              <Icon as={FaEthereum} />
              <Text>{parseFloat(balance).toFixed(4)} ETH</Text>
            </HStack>
            <HStack>
              <Button 
                size="lg" 
                w="150px" 
                p={4} 
                colorScheme="orange"
                _hover={{ bg: "orange.600", transform: "scale(1.05)" }}
                onClick={withdraw}
                isDisabled={contractBalance === '0.0000' || contractAddress === ''}>
                  Withdraw
              </Button>
            </HStack>
          </HStack>

          <SimpleGrid columns={1}>
            <HStack spacing={6} my={8}>
              <Input
                placeholder="Strike Price"
                value={strikePrice}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*\.?\d*$/.test(value)) setStrikePrice(value);
                }}
                width={350}
                bg="gray.800"
                color="white"
                _placeholder={{ color: "gray.500" }}
              />
              <Button 
                onClick={deployContract} 
                colorScheme="pink" 
                size="lg" 
                _hover={{ bg: "pink.600", transform: "scale(1.05)" }}>
                  Deploy Contract
              </Button>
            </HStack>
          </SimpleGrid>

          {contractAddress && (
            <SimpleGrid spacing={20} my={8}>
              <VStack justify="center" alignItems="center" my={10}>
                <HStack>
                  <Text fontSize="xl" color="white">Contract Address:</Text>
                  <Text fontSize="xl" color="white">{contractAddress}</Text>
                </HStack>
                <HStack>
                  <Text fontSize="xl" color="white">Balance :</Text>
                  <Text fontSize="xl" color="white">{contractBalance} ETH</Text>
                </HStack>
              </VStack>
            </SimpleGrid>
          )}

          <SimpleGrid columns={3} spacing={20} my={8}>
            <Button 
              size="lg" 
              w="200px" 
              p={6} 
              colorScheme="purple"
              _hover={{ bg: "purple.600", transform: "scale(1.05)" }}
              onClick={startTrading}>
                Start Trading
            </Button>
            <Button 
              size="lg" 
              w="200px" 
              p={6} 
              colorScheme="blue"
              _hover={{ bg: "blue.600", transform: "scale(1.05)" }}
              onClick={resolveMarket}>
                Resolve
            </Button>
            <Button 
              size="lg" 
              w="200px" 
              p={6} 
              colorScheme="red"
              _hover={{ bg: "red.600", transform: "scale(1.05)" }}
              onClick={expireMarket}>
                Expire
            </Button>
          </SimpleGrid>
        </>
      )}
    </VStack>
  );
};


export default Owner;