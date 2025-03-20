import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, Input, VStack, useToast, HStack, Icon, SimpleGrid, Text, Select, Divider, Progress, InputGroup, InputRightAddon, Spinner, Slider, SliderTrack, SliderFilledTrack, SliderThumb, Tooltip } from '@chakra-ui/react';
import { FaEthereum, FaWallet, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import BinaryOptionMarket from '../../../forgeout/out/BinaryOptionMarket.sol/BinaryOptionMarket.json';
import Factory from '../../../forgeout/out/Factory.sol/Factory.json';  // ABI của Factory contract
import ListAddressOwner from './ListAddressOwner'; // Import ListAddressOwner
import { fetchMarketDetails } from './Customer';
import { FACTORY_ADDRESS } from '../config/contracts';
import { setContractTradingPair } from '../config/tradingPairs';
import { useAuth } from '../context/AuthContext';
import { UnorderedList, ListItem } from '@chakra-ui/react';
import { PriceService } from '../services/PriceService';

interface OwnerProps {
  address: string;
}

// Thêm interface cho Coin với currentPrice
interface Coin {
  value: string;
  label: string;
  currentPrice: number;
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
  
  // Thêm state cho gas price và estimated fee
  const [gasPrice, setGasPrice] = useState('78');
  const [estimatedGasFee, setEstimatedGasFee] = useState('276.40');
  const [estimatedGasUnits, setEstimatedGasUnits] = useState<string>("0");
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [daysToExercise, setDaysToExercise] = useState<string>('Not set');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0);
  
  // Cập nhật danh sách coins có sẵn với giá hiện tại
  const [availableCoins, setAvailableCoins] = useState<Coin[]>([
    { value: "BTCUSD", label: "BTC/USD", currentPrice: 47406.92 },
    { value: "ETHUSD", label: "ETH/USD", currentPrice: 3521.45 },
    { value: "ICPUSD", label: "ICP/USD", currentPrice: 12.87 }
  ]);

  // Thêm state cho fee
  const [feePercentage, setFeePercentage] = useState<string>("1.0");
  const [showTooltip, setShowTooltip] = useState(false);

  // Thêm handler cho việc chọn coin
  const handleCoinSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = availableCoins.find(coin => coin.value === event.target.value);
    setSelectedCoin(selected || null);
    setCurrentPrice(null); // Reset giá để trigger useEffect lấy giá mới
  };

  // Thêm hàm tính Network fee (gas)
  const calculateNetworkFee = async () => {
    if (!selectedCoin || !strikePrice || !maturityDate || !maturityTime) {
      setEstimatedGasFee("276.40"); // Giá trị mặc định
      return;
    }

    try {
      setIsCalculatingFee(true);
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Chuyển đổi strikePrice thành BigNumber
      const strikePriceValue = ethers.utils.parseUnits(strikePrice, "0");
      
      // Chuyển đổi maturity date và time thành timestamp
      const maturityTimestamp = Math.floor(new Date(`${maturityDate} ${maturityTime}`).getTime() / 1000);
      
      // Tạo một factory để ước tính gas khi deploy
      const factory = new ethers.ContractFactory(
        BinaryOptionMarket.abi,
        BinaryOptionMarket.bytecode,
        signer
      );
      
      // Chuyển đổi fee thành số nguyên (nhân 10 để xử lý số thập phân)
      const feeValue = Math.round(parseFloat(feePercentage) * 10);
      
      // Tạo dữ liệu cho việc deploy - THÊM feeValue vào đây
      const deployData = factory.getDeployTransaction(
        strikePriceValue,
        await signer.getAddress(),
        selectedCoin.label,
        maturityTimestamp,
        feeValue
      ).data || '0x';
      
      // Ước tính gas units cần thiết cho việc deploy
      const gasUnits = await provider.estimateGas({
        from: walletAddress,
        data: deployData
      });
      
      // Ước tính gas cho việc đăng ký với Factory
      const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, signer);
      const factoryData = factoryContract.interface.encodeFunctionData('deploy', [FACTORY_ADDRESS]); // Địa chỉ tạm thời
      
      const factoryGasUnits = await provider.estimateGas({
        from: walletAddress,
        to: FactoryAddress,
        data: factoryData
      });
      
      // Tổng gas units cần thiết
      const totalGasUnits = gasUnits.add(factoryGasUnits);
      setEstimatedGasUnits(totalGasUnits.toString());
      
      // Tính toán chi phí gas
      const gasPriceWei = ethers.utils.parseUnits(gasPrice, "gwei");
      const gasFeeWei = totalGasUnits.mul(gasPriceWei);
      const gasFeeEth = parseFloat(ethers.utils.formatEther(gasFeeWei));
      
      // Chuyển đổi từ ETH sang USD (giả sử 1 ETH = 3500 USD - bạn có thể sử dụng PriceService để lấy giá chính xác)
      const priceService = PriceService.getInstance();
      let ethUsdPrice = 3500;
      try {
        const ethPriceData = await priceService.fetchPrice('ETH-USD');
        ethUsdPrice = ethPriceData.price;
      } catch (error) {
        console.error('Error fetching ETH price:', error);
      }
      
      const gasFeeUsd = (gasFeeEth * ethUsdPrice).toFixed(2);
      setEstimatedGasFee(gasFeeUsd);
    } catch (error) {
      console.error('Error calculating network fee:', error);
      setEstimatedGasFee("276.40"); // Giá trị mặc định nếu có lỗi
    } finally {
      setIsCalculatingFee(false);
    }
  };
  
  // Thêm useEffect để tính lại network fee khi các thông số thay đổi
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateNetworkFee();
    }, 500); // Delay 500ms để tránh tính toán quá nhiều lần
    
    return () => clearTimeout(timer);
  }, [selectedCoin, strikePrice, maturityDate, maturityTime, gasPrice]);
  
  // Thêm handler cho việc chọn gas price
  const handleGasPriceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newGasPrice = event.target.value;
    setGasPrice(newGasPrice);
    // Không cần gọi calculateNetworkFee ở đây vì useEffect sẽ tự động gọi
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
  };

  // Thêm hàm để ước tính gas
  const estimateGas = async () => {
    try {
      if (!selectedCoin || !strikePrice || !maturityDate || !maturityTime) {
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const strikePriceValue = ethers.utils.parseUnits(strikePrice, "0");
      const maturityTimestamp = Math.floor(new Date(`${maturityDate} ${maturityTime}`).getTime() / 1000);
      
      // Chuyển đổi fee thành số nguyên (nhân 10 để xử lý số thập phân)
      const feeValue = Math.round(parseFloat(feePercentage) * 10);

      // Tạo contract factory để ước tính gas
      const factory = new ethers.ContractFactory(
        BinaryOptionMarket.abi,
        BinaryOptionMarket.bytecode,
        signer
      );

      // Ước tính gas cho việc deploy - THÊM feeValue vào đây
      const estimatedGas = await provider.estimateGas({
        from: walletAddress,
        data: factory.getDeployTransaction(
          strikePriceValue,
          await signer.getAddress(),
          selectedCoin.label,
          maturityTimestamp,
          feeValue
        ).data || '0x'
      });

      // Tính toán phí gas dựa trên gas price hiện tại
      const gasPriceWei = ethers.utils.parseUnits(gasPrice, "gwei");
      const gasFeeEth = parseFloat(ethers.utils.formatEther(estimatedGas.mul(gasPriceWei)));
      const gasFeeUsd = (gasFeeEth * 3500).toFixed(2); // Giả sử 1 ETH = 3500 USD
      
      setEstimatedGasFee(gasFeeUsd);
    } catch (error) {
      console.error("Error estimating gas:", error);
      setEstimatedGasFee("276.40"); // Giá trị mặc định nếu có lỗi
    }
  };

  // Gọi hàm ước tính gas khi các thông tin cần thiết thay đổi
  useEffect(() => {
    estimateGas();
  }, [selectedCoin, strikePrice, maturityDate, maturityTime, gasPrice]);

  // Hàm xử lý khi thay đổi fee từ input
  const handleFeeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Chỉ cho phép số và dấu chấm
    if (/^\d*\.?\d*$/.test(value)) {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || value === '') {
        setFeePercentage('');
      } else if (numValue < 0.1) {
        setFeePercentage('0.1');
      } else if (numValue > 20) {
        setFeePercentage('20');
      } else {
        // Đảm bảo giá trị có 1 chữ số thập phân để đồng bộ với slider
        setFeePercentage(numValue.toFixed(1));
      }
    }
  };
  
  // Hàm xử lý khi thay đổi fee từ slider
  const handleFeeSliderChange = (value: number) => {
    setFeePercentage(value.toFixed(1));
  };

  // Cập nhật hàm deployContract để bao gồm fee
  const deployContract = async () => {
    try {
      // Validation checks
      if (!selectedCoin || !strikePrice || !maturityDate || !maturityTime ) {
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

      // Thiết lập gas price
      const overrides = {
        gasPrice: ethers.utils.parseUnits(gasPrice, "gwei")
      };

      const factory = new ethers.ContractFactory(
        BinaryOptionMarket.abi,
        BinaryOptionMarket.bytecode,
        signer
      );

      // Chuyển đổi fee thành số nguyên (nhân 10 để xử lý số thập phân)
      const feeValue = Math.round(parseFloat(feePercentage) * 10);

      // Deploy với thêm maturityTimestamp, gas price và fee
      const contract = await factory.deploy(
        strikePriceValue,
        await signer.getAddress(),
        selectedCoin.label,
        maturityTimestamp,
        feeValue,
        overrides
      );
      await contract.deployed();

      // Register with Factory
      const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, signer);
      await factoryContract.deploy(contract.address, overrides);

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
          <HStack>
            {priceChangePercent !== 0 && (
              <>
                <Icon 
                  as={priceChangePercent > 0 ? FaArrowUp : FaArrowDown} 
                  color={priceChangePercent > 0 ? "green.400" : "red.400"} 
                />
                <Text 
                  color={priceChangePercent > 0 ? "green.400" : "red.400"}
                >
                  {Math.abs(priceChangePercent).toFixed(2)}%
                </Text>
              </>
            )}
            <Text color="white" fontSize="xl" fontWeight="bold">
              ${currentPrice ? currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'Loading...'}
            </Text>
          </HStack>
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

  // Fetch current prices from Coinbase API
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD');
        const data = await response.json();
        const rates = data.data.rates;
        
        // Update available coins with current prices
        setAvailableCoins([
          { value: "BTCUSD", label: "BTC/USD", currentPrice: 1 / parseFloat(rates.BTC) },
          { value: "ETHUSD", label: "ETH/USD", currentPrice: 1 / parseFloat(rates.ETH) },
          { value: "ICPUSD", label: "ICP/USD", currentPrice: 1 / parseFloat(rates.ICP) || 12.87 }
        ]);
      } catch (error) {
        console.error("Error fetching prices from Coinbase:", error);
      }
    };
    
    fetchPrices();
    // Refresh prices every 60 seconds
    const interval = setInterval(fetchPrices, 60000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Calculate days to exercise when maturity date changes
  useEffect(() => {
    if (maturityDate && maturityTime) {
      const now = new Date();
      const maturityDateTime = new Date(`${maturityDate} ${maturityTime}`);
      
      // Tính số ngày còn lại
      const diffTime = maturityDateTime.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) {
        setDaysToExercise('Expired');
      } else if (diffDays === 1) {
        setDaysToExercise('1 day');
      } else if (diffDays < 30) {
        setDaysToExercise(`${diffDays} days`);
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        setDaysToExercise(`${months} ${months === 1 ? 'month' : 'months'}`);
      } else {
        const years = Math.floor(diffDays / 365);
        const remainingMonths = Math.floor((diffDays % 365) / 30);
        if (remainingMonths === 0) {
          setDaysToExercise(`${years} ${years === 1 ? 'year' : 'years'}`);
        } else {
          setDaysToExercise(`${years} ${years === 1 ? 'year' : 'years'}, ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`);
        }
      }
    }
  }, [maturityDate, maturityTime]);

  // Lấy giá hiện tại từ Coinbase thông qua PriceService
  useEffect(() => {
    if (selectedCoin) {
      const priceService = PriceService.getInstance();
      const fetchCurrentPrice = async () => {
        try {
          // Chuyển đổi từ BTCUSD sang BTC-USD nếu cần
          const formattedSymbol = selectedCoin.value.includes('-') 
            ? selectedCoin.value 
            : `${selectedCoin.value.substring(0, 3)}-${selectedCoin.value.substring(3)}`;
          
          const priceData = await priceService.fetchPrice(formattedSymbol);
          setCurrentPrice(priceData.price);
          
          // Tính toán phần trăm thay đổi nếu có strikePrice
          if (strikePrice && strikePrice !== '') {
            const strikePriceNum = parseFloat(strikePrice);
            if (!isNaN(strikePriceNum) && strikePriceNum > 0) {
              const changePercent = ((priceData.price - strikePriceNum) / strikePriceNum) * 100;
              setPriceChangePercent(changePercent);
            }
          }
        } catch (error) {
          console.error('Error fetching current price:', error);
        }
      };
      
      fetchCurrentPrice();
      
      // Cập nhật giá mỗi 30 giây
      const intervalId = setInterval(fetchCurrentPrice, 30000);
      
      return () => clearInterval(intervalId);
    }
  }, [selectedCoin, strikePrice]);

  return (
    <Box bg="#0a1647" minH="100vh" color="white">
      {/* Header - Wallet Info */}
      {isConnected && (
        <HStack 
          spacing={6} 
          p={4} 
          bg="rgba(10,22,71,0.8)" 
          borderRadius="lg" 
          border="1px solid rgba(255,255,255,0.1)"
          w="full"
          justify="space-between"
          position="sticky"
          top={0}
          zIndex={10}
        >
          <HStack>
            <Icon as={FaWallet} color="white" />
            <Text color="white">{shortenAddress(walletAddress)}</Text>
          </HStack>
          <HStack>
            <Icon as={FaEthereum} color="white" />
            <Text color="white">{parseFloat(balance).toFixed(4)} ETH</Text>
          </HStack>
          <Button
            variant="outline"
            borderColor="white"
            color="white"
            size="md"
            onClick={withdraw}
            isDisabled={contractBalance === '0.0000' || contractAddress === ''}
            _hover={{ 
              bg: 'rgba(255,255,255,0.1)',
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
            borderColor="white"
            color="white"
            fontSize="xl"
            fontWeight="bold"
            w="500px"
            p={6}
            _hover={{ 
              bg: 'rgba(255,255,255,0.1)',
              transform: 'translateY(-2px)'
            }}
            transition="all 0.2s"
          >
            Connect Wallet
          </Button>
        ) : (
          <>
            {/* OREKA Logo */}


            {/* Main content area with two columns */}
            <HStack spacing={0} w="full" maxW="1200px" align="flex-start" position="relative">
              {/* Left side - Market Creation Form */}
              <Box flex={1} pr={8} position="relative">
                <VStack spacing={6} align="stretch">
                  <Box p={4} bg="rgba(255,255,255,0.05)" borderRadius="xl">
                    <Text fontSize="sm" color="white">
                      Note: When creating a market, you're establishing a binary options contract
                       where users can bid on whether the price will be above (LONG) or below (SHORT)
                        the strike price at maturity. The fee you set (between 0.1% and 20%) will be 
                        applied to winning positions and distributed to you as the market creator.
                    </Text>
                  </Box>

                  <Box>
                    <Text color="white" mb={4} fontWeight="bold">SELECT ASSET:</Text>
                    <Select
                      placeholder="Select Trading Pair"
                      value={selectedCoin?.value || ''}
                      onChange={handleCoinSelect}
                      bg="rgba(255,255,255,0.1)"
                      border="1px solid rgba(255,255,255,0.2)"
                      color="white"
                      borderRadius="xl"
                      h="60px"
                      _hover={{
                        borderColor: "white",
                      }}
                      _focus={{
                        borderColor: "white",
                        boxShadow: "0 0 0 1px white",
                      }}
                      icon={<Icon as={FaEthereum} color="white" />}
                    >
                      {availableCoins.map((coin) => (
                        <option 
                          key={coin.value} 
                          value={coin.value}
                          style={{
                            backgroundColor: "#0a1647",
                            color: "white"
                          }}
                        >
                          {coin.label}
                        </option>
                      ))}
                    </Select>
                  </Box>

                  <Box>
                    <Text color="white" mb={4} fontWeight="bold">STRIKE PRICE:</Text>
                    <InputGroup>
                      <Input
                        placeholder="Enter strike price"
                        value={strikePrice}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d*$/.test(value)) {
                            setStrikePrice(value);
                          }
                        }}
                        bg="rgba(255,255,255,0.1)"
                        border="1px solid rgba(255,255,255,0.2)"
                        color="white"
                        borderRadius="xl"
                        h="60px"
                        _hover={{
                          borderColor: "white",
                        }}
                        _focus={{
                          borderColor: "white",
                          boxShadow: "0 0 0 1px white",
                        }}
                      />
                      <InputRightAddon 
                        h="60px"
                        children="$" 
                        bg="transparent" 
                        borderColor="rgba(255,255,255,0.2)"
                        color="white"
                      />
                    </InputGroup>
                  </Box>

                  <HStack spacing={4}>
                    <Box flex={1}>
                      <Text color="white" mb={4} fontWeight="bold">MARKET MATURITY DATE:</Text>
                      <Input
                        type="date"
                        value={maturityDate}
                        onChange={(e) => setMaturityDate(e.target.value)}
                        bg="rgba(255,255,255,0.1)"
                        border="1px solid rgba(255,255,255,0.2)"
                        color="white"
                        borderRadius="xl"
                        h="60px"
                        _hover={{
                          borderColor: "white",
                        }}
                        _focus={{
                          borderColor: "white",
                        }}
                      />
                    </Box>
                    <Box flex={1}>
                      <Text color="white" mb={4} fontWeight="bold">TIME (UTC):</Text>
                      <Input
                        type="time"
                        value={maturityTime}
                        onChange={(e) => setMaturityTime(e.target.value)}
                        bg="rgba(255,255,255,0.1)"
                        border="1px solid rgba(255,255,255,0.2)"
                        color="white"
                        borderRadius="xl"
                        h="60px"
                        _hover={{
                          borderColor: "white",
                        }}
                        _focus={{
                          borderColor: "white",
                        }}
                      />
                    </Box>
                  </HStack>

                  {/* Fee Setting Box */}
                  <Box>
                    <HStack spacing={4} align="center">
                      <Text color="white" fontWeight="bold" minW="50px">FEE:</Text>
                      
                      <Box flex={1} maxW="300px" position="relative">
                        <Slider
                          id="fee-slider"
                          min={0.1}
                          max={20}
                          step={0.1}
                          value={parseFloat(feePercentage) || 0.1}
                          onChange={(val) => {
                            // Cập nhật giá trị feePercentage với số thập phân 1 chữ số
                            const formattedValue = val.toFixed(1);
                            setFeePercentage(formattedValue);
                          }}
                          onMouseEnter={() => setShowTooltip(true)}
                          onMouseLeave={() => setShowTooltip(false)}
                        >
                          <SliderTrack bg="rgba(255,255,255,0.1)" h="4px">
                            <SliderFilledTrack bg="#4a63c8" />
                          </SliderTrack>
                          <Tooltip
                            hasArrow
                            bg="#4a63c8"
                            color="white"
                            placement="top"
                            isOpen={showTooltip}
                            label={`${parseFloat(feePercentage) || 0.1}%`}
                          >
                            <SliderThumb boxSize={6} bg="white" />
                          </Tooltip>
                        </Slider>
                      </Box>
                      
                      <Box flex={1}>
                        <InputGroup>
                          <Input
                            placeholder="Enter fee"
                            value={feePercentage}
                            onChange={handleFeeInputChange}
                            bg="rgba(255,255,255,0.1)"
                            border="1px solid rgba(255,255,255,0.2)"
                            color="white"
                            borderRadius="xl"
                            h="60px"
                            _hover={{
                              borderColor: "white",
                            }}
                            _focus={{
                              borderColor: "white",
                              boxShadow: "0 0 0 1px white",
                            }}
                          />
                          <InputRightAddon 
                            h="60px"
                            children="%" 
                            bg="transparent" 
                            borderColor="rgba(255,255,255,0.2)"
                            color="white"
                          />
                        </InputGroup>
                      </Box>
                    </HStack>
                    
                    <Text color="gray.400" fontSize="sm" mt={1}>
                      This fee will be applied to winning positions and distributed to the market creator.
                    </Text>
                  </Box>

                  {/* Network Fee Section */}
                  <Box mt={4}>
                    <HStack justify="space-between">
                      <Text color="white">Network fee (gas)</Text>
                      <HStack>
                        {isCalculatingFee && (
                          <Spinner size="sm" color="blue.200" mr={2} />
                        )}
                        <Text color="white">${estimatedGasFee}</Text>
                      </HStack>
                    </HStack>
                    <HStack mt={2} justify="space-between">
                      <Text color="gray.400">Gas price (gwei)</Text>
                      <HStack>
                        <Select 
                          w="120px" 
                          size="sm" 
                          bg="rgba(255,255,255,0.1)"
                          border="1px solid rgba(255,255,255,0.2)"
                          color="white"
                          borderRadius="md"
                          _hover={{
                            borderColor: "white",
                          }}
                          _focus={{
                            borderColor: "white",
                            boxShadow: "0 0 0 1px white",
                          }}
                          value={gasPrice}
                          onChange={handleGasPriceChange}
                          sx={{
                            "& option": {
                              backgroundColor: "#0a1647",
                              color: "white"
                            }
                          }}
                        >
                          <option value="60" style={{backgroundColor: "#0a1647", color: "white"}}>60.00 (Slow)</option>
                          <option value="78" style={{backgroundColor: "#0a1647", color: "white"}}>78.00 (Normal)</option>
                          <option value="90" style={{backgroundColor: "#0a1647", color: "white"}}>90.00 (Fast)</option>
                          <option value="120" style={{backgroundColor: "#0a1647", color: "white"}}>120.00 (Rapid)</option>
                        </Select>
                      </HStack>
                    </HStack>
                    <Text color="gray.500" fontSize="xs" mt={1}>
                      Estimated gas: {parseInt(estimatedGasUnits).toLocaleString()} units
                    </Text>
                  </Box>
                </VStack>
              </Box>

              {/* Vertical Divider */}
              <Box 
                position="absolute" 
                left="50%" 
                top={0} 
                bottom={0} 
                width="1px" 
                bg="rgba(255,255,255,0.2)"
                transform="translateX(-50%)"
              />

              {/* Right side - Market Details */}
              <Box flex={1} pl={8}>
                <VStack spacing={6} align="center">
                  {/* OREKA Logo instead of BTC icon */}
                  <Text 
                    fontSize="5xl" 
                    fontWeight="bold" 
                    bgGradient="linear(to-r, #4a63c8, #5a73d8, #6a83e8)" 
                    bgClip="text"
                    letterSpacing="wider"
                    textShadow="0 0 10px rgba(74, 99, 200, 0.7), 0 0 20px rgba(74, 99, 200, 0.5)"
                    fontFamily="'Orbitron', sans-serif"
                  >
                    OREKA
                  </Text>

                  {/* Market Details Box */}
                  <Box
                    p={6}
                    bg="rgba(255,255,255,0.05)"
                    borderRadius="xl"
                    border="1px solid rgba(255,255,255,0.1)"
                  >
                    <VStack spacing={4} align="stretch">
                      <HStack justify="space-between">
                        <Text color="gray.400">Strike price</Text>
                        <HStack>
                          <Text color="white" fontSize="xl" fontWeight="bold">
                            ${strikePrice || 'Not set'}
                          </Text>
                        </HStack>
                      </HStack>

                      <HStack justify="space-between">
                        <Text color="gray.400">Current market price</Text>
                        <HStack>
                          {priceChangePercent !== 0 && (
                            <>
                              <Icon 
                                as={priceChangePercent > 0 ? FaArrowUp : FaArrowDown} 
                                color={priceChangePercent > 0 ? "green.400" : "red.400"} 
                              />
                              <Text 
                                color={priceChangePercent > 0 ? "green.400" : "red.400"}
                              >
                                {Math.abs(priceChangePercent).toFixed(2)}%
                              </Text>
                            </>
                          )}
                          <Text color="white" fontSize="xl" fontWeight="bold">
                            ${currentPrice ? currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'Loading...'}
                          </Text>
                        </HStack>
                      </HStack>

                      <Divider borderColor="rgba(255,255,255,0.1)" />

                      <HStack justify="space-between">
                        <Text color="gray.400">Maturity date</Text>
                        <Text color="white">{maturityDate || 'Not set'}</Text>
                      </HStack>

                      <HStack justify="space-between">
                        <Text color="gray.400">Time to exercise</Text>
                        <Text color="white">{daysToExercise}</Text>
                      </HStack>

                      <Divider borderColor="rgba(255,255,255,0.1)" />

                      {/* Replace fee section with Note */}
                      <Box p={3} bg="rgba(255,255,255,0.03)" borderRadius="md">
                        <Text fontSize="sm" color="white">
                          Note: When creating a market, you're establishing a binary options contract where users can bid on whether the price will be above (LONG) or below (SHORT) the strike price at maturity. The fee you set (between 0.1% and 20%) will be applied to winning positions and distributed to you as the market creator.
                        </Text>
                      </Box>
                    </VStack>
                  </Box>

                  {/* Market Creation Info */}
                  <Box
                    p={4}
                    bg="rgba(255,255,255,0.05)"
                    borderRadius="xl"
                    border="1px solid rgba(255,255,255,0.1)"
                  >
                    <Text color="white" fontWeight="bold" mb={2}>
                      When creating a market you will:
                    </Text>
                    <UnorderedList spacing={2} pl={4}>
                      <ListItem color="gray.300">
                        Earn the fee percentage you set (currently {feePercentage}%) from all winning positions at market expiry.
                      </ListItem>
                      <ListItem color="gray.300">
                        Control when to start the bidding phase after market creation.
                      </ListItem>
                      <ListItem color="gray.300">
                        Pay Ethereum network fees (gas) for deploying the market contract.
                      </ListItem>
                    </UnorderedList>
                  </Box>
                </VStack>
              </Box>
            </HStack>

            {/* Progress bar and Create Market Button */}
            <VStack spacing={6} w="full" maxW="1200px" mt={8}>
              <Box w="full">
                <HStack spacing={4} justify="space-between" mb={4}>
                  <Text color="white" fontWeight={600}>Approving sUSD</Text>
                  <Text color="gray.400">Creating market</Text>
                  <Text color="gray.400">Finished</Text>
                </HStack>
                <Box position="relative" h="2px" bg="rgba(255,255,255,0.1)" w="full">
                  <Box position="absolute" left={0} top={0} h="2px" w="33%" bg="white" />
                  <HStack justify="space-between" position="absolute" w="full" top="-8px">
                    <Box w="20px" h="20px" borderRadius="full" bg="white" />
                    <Box w="20px" h="20px" borderRadius="full" bg="rgba(255,255,255,0.1)" />
                    <Box w="20px" h="20px" borderRadius="full" bg="rgba(255,255,255,0.1)" />
                  </HStack>
                </Box>
              </Box>

              <Button
                onClick={deployContract}
                bg="#4a63c8"
                color="white"
                size="lg"
                w="300px"
                h="60px"
                borderRadius="full"
                fontSize="xl"
                _hover={{ 
                  bg: '#5a73d8',
                  transform: 'translateY(-2px)'
                }}
                transition="all 0.2s"
                isDisabled={!selectedCoin || !strikePrice || !maturityDate || !maturityTime}
              >
                Create market
              </Button>
            </VStack>
          </>
        )}
      </VStack>
    </Box>
  );
};


export default Owner;