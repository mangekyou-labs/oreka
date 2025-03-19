import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, Input, VStack, useToast, HStack, Icon, SimpleGrid, Text, Select, Divider, Progress } from '@chakra-ui/react';
import { FaEthereum, FaWallet } from 'react-icons/fa';
import BinaryOptionMarket from '../../../out/BinaryOptionMarket.sol/BinaryOptionMarket.json';
import Factory from '../../../out/Factory.sol/Factory.json';  // ABI của Factory contract
import ListAddressOwner from './ListAddressOwner'; // Import ListAddressOwner
import { fetchMarketDetails } from './Customer';
import fs from 'fs'; // Import fs để đọc file
import { FACTORY_ADDRESS } from '../config/contracts';
import { setContractTradingPair } from '../config/tradingPairs';
import { useAuth } from '../context/AuthContext';

interface OwnerProps {
  address: string;
}

// Thêm interface cho Coin
interface Coin {
  value: string;
  label: string;
}

const Owner: React.FC<OwnerProps> = ({ address }) => {
  const { isConnected, walletAddress, balance, connectWallet, refreshBalance } = useAuth();
  const [contractAddress, setContractAddress] = useState('');
  const [strikePrice, setStrikePrice] = useState('');
  const [contractBalance, setContractBalance] = useState('');
  const [deployedContracts, setDeployedContracts] = useState<string[]>([]); // Add this line
  const [factoryAddress, setFactoryAddress] = useState('');
  // Thêm state cho selectedCoin
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [maturityDate, setMaturityDate] = useState('');
  const [maturityTime, setMaturityTime] = useState('');
  const [fundingAmount, setFundingAmount] = useState('1000'); // Default 1000 sUSD
  
  // Danh sách coins có sẵn
  const availableCoins: Coin[] = [
    { value: "BTCUSD", label: "BTC/USD" },
    { value: "ETHUSD", label: "ETH/USD" },
    { value: "ICPUSD", label: "ICP/USD" }
  ];

  // Thêm handler cho việc chọn coin
  const handleCoinSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = availableCoins.find(coin => coin.value === event.target.value);
    setSelectedCoin(selected || null);
  };

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

  // Thêm useEffect để cập nhật balance theo thời gian thực
  useEffect(() => {
    if (isConnected) {
      // Cập nhật ban đầu
      refreshBalance();

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      provider.on("block", refreshBalance);

      return () => {
        provider.removeAllListeners("block");
      };
    }
  }, [isConnected, refreshBalance]);

  // Thêm hàm fetchBalance
  const fetchBalance = async () => {
    if (!walletAddress) return;
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const balanceWei = await provider.getBalance(walletAddress);
      const balanceEth = parseFloat(ethers.utils.formatEther(balanceWei));
      refreshBalance();
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  };

  // Thêm useEffect để lắng nghe sự kiện từ blockchain
  useEffect(() => {
    if (!walletAddress) return;

    // Cập nhật balance ban đầu
    fetchBalance();

    // Lắng nghe sự kiện block mới
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    provider.on("block", () => {
      fetchBalance();
    });

    // Sử dụng type assertion cho ethereum
    const ethereum = window.ethereum as any;
    ethereum.on('accountsChanged', fetchBalance);

    return () => {
      provider.removeAllListeners("block");
      if (ethereum && typeof ethereum.removeListener === 'function') {
        ethereum.removeListener('accountsChanged', fetchBalance);
      }
    };
  }, [walletAddress]);

  // Thêm hàm resetForm
  const resetForm = () => {
    setSelectedCoin(null);
    setStrikePrice('');
    setMaturityDate('');
    setMaturityTime('');
    setFundingAmount('1000'); // Reset về giá trị mặc định
  };

  // Sửa lại hàm deployContract
  const deployContract = async () => {
    try {
      // Validation checks
      if (!selectedCoin || !strikePrice || !maturityDate || !maturityTime || !fundingAmount) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          status: "error",
          duration: 5000,
          isClosable: true
        });
        return;
      }

      // Convert maturityDate và maturityTime thành timestamp
      const maturityTimestamp = Math.floor(new Date(`${maturityDate} ${maturityTime}`).getTime() / 1000);
      
      // Kiểm tra xem maturityTimestamp có lớn hơn thời gian hiện tại không
      if (maturityTimestamp <= Math.floor(Date.now() / 1000)) {
        toast({
          title: "Error",
          description: "Maturity time must be in the future",
          status: "error",
          duration: 5000,
          isClosable: true
        });
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const strikePriceValue = ethers.utils.parseUnits(strikePrice, "0");

      const factory = new ethers.ContractFactory(
        BinaryOptionMarket.abi,
        BinaryOptionMarket.bytecode,
        signer
      );

      // Deploy với thêm maturityTimestamp
      const contract = await factory.deploy(
        strikePriceValue,
        await signer.getAddress(),
        selectedCoin.label,
        maturityTimestamp  // Thêm tham số này
      );
      await contract.deployed();

      // Register with Factory
      const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, signer);
      await factoryContract.deploy(contract.address);

      setContractAddress(contract.address);
      await fetchContractsByOwner();
      await fetchBalance(); // Thêm dòng này

      toast({
        title: "Success",
        description: `Contract deployed at: ${contract.address}`,
        status: "success",
        duration: 5000,
        isClosable: true
      });

      // Reset form
      resetForm();

    } catch (error) {
      console.error("Deploy error:", error);
      toast({
        title: "Error",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true
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
    try {
      // Check if wallet is connected
      if (!walletAddress) {
        console.log("No wallet address available");
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(FactoryAddress, Factory.abi, provider);

      // Log để debug
      console.log("Fetching contracts for address:", walletAddress);
      console.log("Using Factory at:", FactoryAddress);

      // Thêm check address hợp lệ
      if (!ethers.utils.isAddress(walletAddress)) {
        throw new Error("Invalid wallet address");
      }

      const contracts = await contract.getContractsByOwner(walletAddress);
      console.log("Contracts fetched:", contracts);
      setDeployedContracts(contracts);

    } catch (error: any) {
      console.error("Failed to fetch contracts:", error);
      toast({
        title: "Error fetching contracts",
        description: "Please make sure your wallet is connected",
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
      await fetchBalance(); // Thêm dòng này
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
    if (walletAddress) {
      fetchContractsByOwner();
    }
  }, [walletAddress]);

  const shortenAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

  // Thêm component hiển thị market details
  const MarketDetails = () => (
    <Box
      p={6}
      bg="#1A1A1A"
      borderRadius="xl"
      border="1px solid #2D3748"
      w="full"
      maxW="400px"
    >
      <VStack spacing={4} align="stretch">
        <Text fontSize="xl" fontWeight="bold" color="#FEDF56">Market Details</Text>
        
        <HStack justify="space-between">
          <Text color="gray.400">Strike price</Text>
          <Text color="#FEDF56">${strikePrice || '0.00'}</Text>
        </HStack>

        <HStack justify="space-between">
          <Text color="gray.400">Current market price</Text>
          <Text color="#FEDF56">${'47,406.92'}</Text>
        </HStack>

        <HStack justify="space-between">
          <Text color="gray.400">Maturity date</Text>
          <Text color="#FEDF56">{maturityDate || 'Not set'}</Text>
        </HStack>

        <HStack justify="space-between">
          <Text color="gray.400">Time to exercise</Text>
          <Text color="#FEDF56">5 months</Text>
        </HStack>

        <Divider borderColor="#2D3748" />

        <VStack spacing={2} align="stretch">
          <HStack justify="space-between">
            <Text color="gray.400">Minting fee</Text>
            <Text color="#FEDF56">1.00%</Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="gray.400">You will earn</Text>
            <Text color="#FEDF56">0.50%</Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="gray.400">Fee pool earns</Text>
            <Text color="#FEDF56">0.50%</Text>
          </HStack>
        </VStack>
      </VStack>
    </Box>
  );

  return (
    <Box bg="black" minH="100vh">
      {/* Header - Wallet Info */}
      {isConnected && (
        <HStack 
          spacing={6} 
          p={4} 
          bg="rgba(0,0,0,0.5)" 
          borderRadius="lg" 
          border="1px solid #FEDF56"
          w="full"
          justify="space-between"
          position="sticky"
          top={0}
          zIndex={10}
        >
          <HStack>
            <Icon as={FaWallet} color="#FEDF56" />
            <Text color="#FEDF56">{shortenAddress(walletAddress)}</Text>
          </HStack>
          <HStack>
            <Icon as={FaEthereum} color="#FEDF56" />
            <Text color="#FEDF56">{parseFloat(balance).toFixed(4)} ETH</Text>
          </HStack>
          <Button
            variant="outline"
            borderColor="#FEDF56"
            color="#FEDF56"
            size="md"
            onClick={withdraw}
            isDisabled={contractBalance === '0.0000' || contractAddress === ''}
            _hover={{ 
              bg: 'rgba(254, 223, 86, 0.1)',
              transform: 'translateY(-2px)'
            }}
            transition="all 0.2s"
          >
            Withdraw
          </Button>
        </HStack>
      )}

      <VStack spacing={8} p={8}>
        {!isConnected ? (
          <Button
            onClick={connectWallet}
            variant="outline"
            borderColor="#FEDF56"
            color="#FEDF56"
            fontSize="xl"
            fontWeight="bold"
            w="500px"
            p={6}
            _hover={{ 
              bg: 'rgba(254, 223, 86, 0.1)',
              transform: 'translateY(-2px)'
            }}
            transition="all 0.2s"
          >
            Connect Wallet
          </Button>
        ) : (
          <>
            {/* Main content area */}
            <HStack spacing={8} w="full" maxW="1200px" align="flex-start">
              {/* Left side - Market Creation Form */}
              <Box flex={2}>
                <VStack spacing={6}>
                  <Text 
                    fontSize="2xl" 
                    fontWeight="bold" 
                    color="#FEDF56"
                    alignSelf="flex-start"
                  >
                    Deploy New Market
                  </Text>

                  {/* Trading Pair and Strike Price */}
                  <HStack spacing={6} w="full">
                    <Box flex={1}>
                      <Text color="gray.400" mb={2}>Trading Pair</Text>
                      <Select
                        placeholder="Select Trading Pair"
                        value={selectedCoin?.value || ''}
                        onChange={handleCoinSelect}
                        bg="#2D3748"
                        border="1px solid #FEDF56"
                        color="#FEDF56"
                        _hover={{
                          borderColor: "#FEDF56",
                        }}
                        _focus={{
                          borderColor: "#FEDF56",
                          boxShadow: "0 0 0 1px #FEDF56",
                        }}
                      >
                        {availableCoins.map((coin) => (
                          <option 
                            key={coin.value} 
                            value={coin.value}
                            style={{
                              backgroundColor: "#2D3748",
                              color: "#FEDF56"
                            }}
                          >
                            {coin.label}
                          </option>
                        ))}
                      </Select>
                    </Box>

                    <Box flex={2}>
                      <Text color="gray.400" mb={2}>Strike Price (USD)</Text>
                      <Input
                        placeholder="Enter strike price"
                        value={strikePrice}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d*$/.test(value)) {
                            setStrikePrice(value);
                          }
                        }}
                        bg="#2D3748"
                        border="1px solid #FEDF56"
                        color="#FEDF56"
                        _hover={{
                          borderColor: "#FEDF56",
                        }}
                        _focus={{
                          borderColor: "#FEDF56",
                          boxShadow: "0 0 0 1px #FEDF56",
                        }}
                      />
                    </Box>
                  </HStack>

                  {/* Market Funding Amount */}
                  <Box w="full">
                    <Text color="gray.400" mb={2}>Market Funding Amount (sUSD)</Text>
                    <Input
                      value={fundingAmount}
                      onChange={(e) => setFundingAmount(e.target.value)}
                      bg="#2D3748"
                      border="1px solid #FEDF56"
                      color="#FEDF56"
                      placeholder="Enter funding amount"
                    />
                  </Box>

                  {/* Maturity Date and Time in one row */}
                  <HStack spacing={6} w="full">
                    <Box flex={1}>
                      <Text color="gray.400" mb={2}>Maturity Date</Text>
                      <Input
                        type="date"
                        value={maturityDate}
                        onChange={(e) => setMaturityDate(e.target.value)}
                        bg="#2D3748"
                        border="1px solid #FEDF56"
                        color="#FEDF56"
                      />
                    </Box>
                    <Box flex={1}>
                      <Text color="gray.400" mb={2}>Maturity Time (UTC)</Text>
                      <Input
                        type="time"
                        value={maturityTime}
                        onChange={(e) => setMaturityTime(e.target.value)}
                        bg="#2D3748"
                        border="1px solid #FEDF56"
                        color="#FEDF56"
                      />
                    </Box>
                  </HStack>

                  {/* Deploy Button */}
                  <Button
                    onClick={deployContract}
                    bg="#FEDF56"
                    color="black"
                    size="lg"
                    w="full"
                    mt={4}
                    _isDisabled={!selectedCoin || !strikePrice} // Thêm điều kiện disable
                    _hover={{ 
                      bg: selectedCoin && strikePrice ? '#FFE56B' : '#FEDF56',
                      transform: selectedCoin && strikePrice ? 'translateY(-2px)' : 'none'
                    }}
                    transition="all 0.2s"
                    opacity={selectedCoin && strikePrice ? 1 : 0.6}
                    cursor={selectedCoin && strikePrice ? 'pointer' : 'not-allowed'}
                  >
                    Deploy Contract
                  </Button>

                  {/* Contract Address Display */}
                  {contractAddress && (
                    <Box 
                      p={4} 
                      bg="#1A1A1A"
                      borderRadius="xl"
                      border="1px solid #2D3748"
                      w="full"
                      maxW="1200px"
                    >
                      <HStack spacing={4}>
                        <Text color="gray.400">Contract Address:</Text>
                        <Text color="#FEDF56">{contractAddress}</Text>
                      </HStack>
                    </Box>
                  )}
                </VStack>
              </Box>

              {/* Right side - Market Details and Note */}
              <VStack flex={1} spacing={6}>
                <MarketDetails />
                
                {/* Note section moved to right side */}
                <Box
                  p={4}
                  bg="#1A1A1A"
                  borderRadius="xl"
                  border="1px solid #2D3748"
                  w="full"
                >
                  <Text color="gray.400" fontSize="sm">
                    Note: The amount of sUSD deposited will dictate how many long and short options tokens will be minted. 
                    For example, depositing 1,000 sUSD mints 1,000 sLONG and 1,000 sSHORT options tokens for this market.
                  </Text>
                </Box>
              </VStack>
            </HStack>

            {/* Progress bar */}
            <Box w="full" maxW="1200px">
              <HStack spacing={4} justify="space-between" mb={4}>
                <Text color="#FEDF56">Approving sUSD</Text>
                <Text color="gray.400">Creating market</Text>
                <Text color="gray.400">Finished</Text>
              </HStack>
              <Progress value={33} colorScheme="yellow" bg="#2D3748" />
            </Box>
          </>
        )}
      </VStack>
    </Box>
  );
};


export default Owner;