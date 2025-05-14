import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, Input, VStack, useToast, HStack, Icon, SimpleGrid, Text, Select, Divider, Progress, InputGroup, InputRightAddon, Spinner, Slider, SliderTrack, SliderFilledTrack, SliderThumb, Tooltip, InputRightElement } from '@chakra-ui/react';
import { FaEthereum, FaWallet, FaArrowUp, FaArrowDown, FaClock } from 'react-icons/fa';
import BinaryOptionMarket from '../contracts/abis/BinaryOptionMarketChainlinkABI.json';
import Factory from '../contracts/abis/FactoryABI.json';  
import { FACTORY_ADDRESS } from '../config/contracts';
import { setContractTradingPair } from '../config/tradingPairs';
import { useAuth } from '../context/AuthContext';
import { UnorderedList, ListItem } from '@chakra-ui/react';
import { PriceService } from '../services/PriceService';
import { format, toZonedTime } from 'date-fns-tz';
import { useRouter } from 'next/router';


// Define the properties expected by the Owner component
interface OwnerProps {
  address: string; // Wallet address of the user
}

// Define the structure of a Coin object with its properties
interface Coin {
  value: string; // The value identifier for the coin
  label: string; // The display label for the coin
  currentPrice: number; // The current price of the coin
  priceFeedAddress: string; // The address of the price feed for the coin
}

// Constant for converting real numbers to a specific format
const STRIKE_PRICE_MULTIPLIER = 100000000; // 10^8 - allows up to 8 decimal places

// Owner component: Allows users to create and manage binary option markets
const Owner: React.FC<OwnerProps> = ({ address }) => {
  // Authentication context for wallet connection and balance
  const { isConnected, walletAddress, balance, connectWallet, refreshBalance } = useAuth();

  // State variables for contract information
  const [contractAddress, setContractAddress] = useState(''); // Address of the deployed contract
  const [strikePrice, setStrikePrice] = useState(''); // Strike price for the option
  const [contractBalance, setContractBalance] = useState(''); // Balance of the contract
  const [deployedContracts, setDeployedContracts] = useState<string[]>([]); // List of user's deployed contracts

  // State for selected trading pair
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null); // Currently selected coin

  // State for maturity date and time
  const [maturityDate, setMaturityDate] = useState(''); // Maturity date of the option
  const [maturityTime, setMaturityTime] = useState(''); // Maturity time of the option

  // State for gas settings and fee estimation
  const [gasPrice, setGasPrice] = useState('78'); // Current gas price in gwei
  const [estimatedGasFee, setEstimatedGasFee] = useState('276.40'); // Estimated gas fee in USD
  const [estimatedGasUnits, setEstimatedGasUnits] = useState<string>("0"); // Estimated gas units required
  const [isCalculatingFee, setIsCalculatingFee] = useState(false); // Flag to indicate if fee calculation is in progress
  const [daysToExercise, setDaysToExercise] = useState<string>('Not set'); // Days until the option can be exercised

  // State for price tracking
  const [currentPrice, setCurrentPrice] = useState<number | null>(null); // Current price of the selected coin
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0); // Percentage change in price

  // Available trading pairs with current prices
  const [availableCoins, setAvailableCoins] = useState<Coin[]>([
    { value: "BTCUSD", label: "BTC/USD", currentPrice: 47406.92, priceFeedAddress: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43" },
    { value: "ETHUSD", label: "ETH/USD", currentPrice: 3521.45, priceFeedAddress: "0x694AA1769357215DE4FAC081bf1f309aDC325306" },
    { value: "LINKUSD", label: "LINK/USD", currentPrice: 12.87, priceFeedAddress: "0xc59E3633BAAC79493d908e63626716e204A45EdF" },
    { value: "SNXUSD", label: "SNX/USD", currentPrice: 0.65, priceFeedAddress: "0xc0F82A46033b8BdBA4Bb0B0e28Bc2006F64355bC" },
    { value: "WSTETHUSD", label: "WSTETH/USD", currentPrice: 2000.00, priceFeedAddress: "0xaaabb530434B0EeAAc9A42E25dbC6A22D7bE218E" },
  ]);

  // State for market creator fee
  const [feePercentage, setFeePercentage] = useState<string>("1.0"); // Percentage fee for market creation
  const [showTooltip, setShowTooltip] = useState(false); // Flag to show tooltip

  // State for index background
  const [indexBg, setIndexBg] = useState<number>(1); // Background index for UI

  // Factory contract address from config
  const FactoryAddress = FACTORY_ADDRESS; // Address of the factory contract
  const toast = useToast(); // Toast notification handler

  // Router for redirecting to the new contract page
  const router = useRouter();

  // Handler for coin selection dropdown
  const handleCoinSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = availableCoins.find(coin => coin.value === event.target.value); // Find selected coin
    setSelectedCoin(selected || null); // Set selected coin state
    setCurrentPrice(null); // Reset current price
  };

  // Calculate network fee (gas) for contract deployment
  const calculateNetworkFee = async () => {
    // Check if all required fields are filled
    if (!selectedCoin || !strikePrice || !maturityDate || !maturityTime) {
      setEstimatedGasFee(""); // Default value if fields are not filled
      return;
    }

    try {
      setIsCalculatingFee(true);
  
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
  
      // Convert strike price to BigNumber
      const strikePriceFloat = parseFloat(strikePrice);
      const strikePriceInteger = Math.round(strikePriceFloat * STRIKE_PRICE_MULTIPLIER);
      const strikePriceValue = ethers.BigNumber.from(strikePriceInteger.toString());
  
      // Convert maturity datetime to timestamp
      const maturityTimestamp = Math.floor(new Date(`${maturityDate} ${maturityTime}`).getTime() / 1000);
  
      // Convert fee to integer
      const feeValue = Math.round(parseFloat(feePercentage) * 10);
  
      // Use the actual priceFeedAddress from selectedCoin
      const normalizedPriceFeedAddress = ethers.utils.getAddress(selectedCoin.priceFeedAddress);
  
      // Generate random indexBg for estimation
      const randomIndexBg = Math.floor(Math.random() * 10) + 1;
  
      const factory = new ethers.ContractFactory(
        BinaryOptionMarket.abi,
        BinaryOptionMarket.bytecode,
        signer
      );
  
      // Create deploy transaction
      const deployTx = factory.getDeployTransaction(
        strikePriceValue,
        await signer.getAddress(),
        selectedCoin.label,
        normalizedPriceFeedAddress,
        maturityTimestamp,
        feeValue,
        randomIndexBg
      );
  
      const gasUnitsDeploy = await provider.estimateGas({
        from: walletAddress,
        data: deployTx.data || "0x",
      });
  
      // Fake deploy address to estimate Factory.deploy
      const fakeAddress = ethers.Wallet.createRandom().address;
  
      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, Factory.abi, signer);
      const factoryData = factoryContract.interface.encodeFunctionData('deploy', [fakeAddress]);
  
      const gasUnitsFactory = await provider.estimateGas({
        from: walletAddress,
        to: FACTORY_ADDRESS,
        data: factoryData,
      });
  
      const totalGasUnits = gasUnitsDeploy.add(gasUnitsFactory);
      setEstimatedGasUnits(totalGasUnits.toString());
  
      const gasPriceWei = ethers.utils.parseUnits(gasPrice, "gwei");
      const gasFeeWei = totalGasUnits.mul(gasPriceWei);
      const gasFeeEth = parseFloat(ethers.utils.formatEther(gasFeeWei));
  
      // Get live ETH price
      const priceService = PriceService.getInstance();
      let usdPrice = 0;
      try {
        const priceData = await priceService.fetchPrice(selectedCoin?.label);
        usdPrice = priceData.price;
      } catch (err) {
        console.error("ETH price fetch failed:", err);
        usdPrice = 3500; // fallback
      }
  
      const gasFeeUsd = (gasFeeEth * usdPrice).toFixed(2);
      setEstimatedGasFee(gasFeeUsd);
    } catch (err) {
      console.error("Error calculating gas fee:", err);
      setEstimatedGasFee("276.40"); // fallback
    } finally {
      setIsCalculatingFee(false);
    }
  };

  // Listen for contract deployment events from the Factory contract
  useEffect(() => {
    const provider = new ethers.providers.Web3Provider(window.ethereum); // Create provider
    const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, provider); // Create factory contract instance

    // Listen to Deployed event
    factoryContract.on("Deployed", (owner, newContractAddress, index) => {
      console.log("Event 'Deployed' received:"); // Log event
      console.log("Owner:", owner); // Log owner address
      console.log("New contract deployed:", newContractAddress); // Log new contract address
      console.log("Index:", index); // Log index

      setContractAddress(newContractAddress); // Update contract address state
      setDeployedContracts(prev => [...prev, newContractAddress]); // Update deployed contracts list

      // Show success toast notification
      toast({
        title: "Contract deployed successfully!",
        description: `New Contract Address: ${newContractAddress}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    });

    return () => {
      // Cleanup: remove listener when component unmounts
      console.log("Removing event listener on Factory contract..."); // Log cleanup
      factoryContract.removeAllListeners("Deployed"); // Remove event listener
    };
  }, []);

  // Recalculate network fee when parameters change
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateNetworkFee(); // Call fee calculation function
    }, 500); // Delay 500ms to avoid too many calculations

    return () => clearTimeout(timer); // Cleanup timer
  }, [selectedCoin, strikePrice, maturityDate, maturityTime, gasPrice]);

  // Handler for gas price dropdown
  const handleGasPriceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newGasPrice = event.target.value; // Get new gas price from dropdown
    setGasPrice(newGasPrice); // Update gas price state
  };

  // Update wallet balance in real time
  useEffect(() => {
    if (isConnected) {
      // Update initial balance
      refreshBalance(); // Refresh wallet balance

      const provider = new ethers.providers.Web3Provider(window.ethereum); // Create provider
      provider.on("block", refreshBalance); // Listen for block events to refresh balance

      return () => {
        provider.removeAllListeners("block"); // Cleanup block listener
      };
    }
  }, [isConnected, refreshBalance]);

  // Fetch wallet balance
  // Fetch wallet balance
  const fetchBalance = async () => {
    if (!walletAddress) return; // Exit if no wallet address
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum); // Create provider
      const balanceWei = await provider.getBalance(walletAddress); // Get wallet balance in Wei
      const balanceEth = parseFloat(ethers.utils.formatEther(balanceWei)); // Convert balance to ETH
      refreshBalance(); // Refresh wallet balance
    } catch (error) {
      console.error("Error fetching balance:", error); // Log error if fetching fails
    }
  };

  // Listen to blockchain events to update balance
  useEffect(() => {
    if (!walletAddress) return; // Exit if no wallet address

    // Update initial balance
    fetchBalance(); // Fetch wallet balance

    // Listen to block event
    const provider = new ethers.providers.Web3Provider(window.ethereum); // Create provider
    provider.on("block", () => {
      fetchBalance(); // Fetch balance on block event
    });

    // Use type assertion for ethereum
    const ethereum = window.ethereum as any; // Type assertion for Ethereum object
    ethereum.on('accountsChanged', fetchBalance); // Listen for account changes to fetch balance

    return () => {
      provider.removeAllListeners("block"); // Cleanup block listener
      if (ethereum && typeof ethereum.removeListener === 'function') {
        ethereum.removeListener('accountsChanged', fetchBalance); // Cleanup account change listener
      }
    };
  }, [walletAddress]);

  // Reset form to default values
  const resetForm = () => {
    setSelectedCoin(null); // Reset selected coin
    setStrikePrice(''); // Reset strike price
    setMaturityDate(''); // Reset maturity date
    setMaturityTime(''); // Reset maturity time
    setFeePercentage('1'); // Reset fee percentage
    setDaysToExercise('Not set'); // Reset days to exercise
    setCurrentPrice(null); // Reset current price
    setPriceChangePercent(0); // Reset price change percentag
  };

  // Estimate gas for contract deployment
  const estimateGas = async () => {
    try {
      // Check if all required fields are filled
      if (!selectedCoin || !strikePrice || !maturityDate || !maturityTime) {
        return; // Exit if fields are not filled
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum); // Create provider
      const signer = provider.getSigner(); // Get signer

      // Convert float to large integer
      const strikePriceFloat = parseFloat(strikePrice); // Parse strike price as float
      const strikePriceInteger = Math.round(strikePriceFloat * STRIKE_PRICE_MULTIPLIER); // Convert to integer
      const strikePriceValue = ethers.BigNumber.from(strikePriceInteger.toString()); // Convert to BigNumber

      const maturityTimestamp = Math.floor(new Date(`${maturityDate} ${maturityTime}`).getTime() / 1000); // Get maturity timestamp

      // Convert fee to integer (multiply by 10 to handle decimal)
      const feeValue = Math.round(parseFloat(feePercentage) * 10); // Convert fee percentage to integer

      // Sample index background (using 5 as an example for estimation)
      const indexBg = Math.floor(Math.random() * 10) + 1; // Generate random index background

      // Create contract factory to estimate gas
      const factory = new ethers.ContractFactory(
        BinaryOptionMarket.abi,
        BinaryOptionMarket.bytecode,
        signer
      );

      // Estimate gas for deployment - add indexBg here
      const estimatedGas = await provider.estimateGas({
        from: walletAddress,
        data: factory.getDeployTransaction(
          strikePriceValue,
          await signer.getAddress(),
          selectedCoin.label,
          maturityTimestamp,
          feeValue,
          indexBg
        ).data || '0x' // Get deploy transaction data
      });

      // Calculate gas fee based on current gas price
      const gasPriceWei = ethers.utils.parseUnits(gasPrice, "gwei"); // Convert gas price to Wei
      const gasFeeEth = parseFloat(ethers.utils.formatEther(estimatedGas.mul(gasPriceWei))); // Calculate gas fee in ETH

      // Fetch current ETH price from PriceService instead of using hardcoded value
      const priceService = PriceService.getInstance(); // Get price service instance
      let ethUsdPrice = 3500; // Default fallback value if fetch fails

      try {
        // Use ETH-USD as the symbol for Ethereum price
        const ethPriceData = await priceService.fetchPrice('ETH-USD'); // Fetch current ETH price
        ethUsdPrice = ethPriceData.price; // Update ETH price
        console.log('Current ETH price:', ethUsdPrice); // Log current ETH price
      } catch (priceError) {
        console.error('Error fetching ETH price:', priceError); // Log error if fetching fails
        // Continue with default value if fetch fails
      }

      // Calculate fee in USD using the fetched ETH price
      const gasFeeUsd = (gasFeeEth * ethUsdPrice).toFixed(2); // Calculate gas fee in USD
      setEstimatedGasFee(gasFeeUsd); // Set estimated gas fee state
    } catch (error) {
      console.error("Error estimating gas:", error); // Log error if estimation fails
      setEstimatedGasFee("276.40"); // Default value if error occurs
    }
  };

  // Call the estimate gas function when necessary params change
  useEffect(() => {
    estimateGas(); // Call estimate gas function
  }, [selectedCoin, strikePrice, maturityDate, maturityTime, gasPrice]);

  // Handler for fee input changes
  const handleFeeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value; // Get input value
    // Only allow numbers and decimal point
    if (/^\d*\.?\d*$/.test(value)) {
      const numValue = parseFloat(value); // Parse input value as float
      if (isNaN(numValue) || value === '') {
        setFeePercentage(''); // Reset fee percentage if invalid
      } else if (numValue < 0.1) {
        setFeePercentage('0.1'); // Set minimum fee percentage
      } else if (numValue > 20) {
        setFeePercentage('20'); // Set maximum fee percentage
      } else {
        // Ensure value has 1 decimal place to sync with slider
        setFeePercentage(numValue.toFixed(1)); // Set fee percentage with one decimal place
      }
    }
  };

  // Deploy a new binary option market contract
  const deployContract = async () => {
    try {
      // Check if all required fields are filled
      if (!selectedCoin || !strikePrice || !maturityDate || !maturityTime) {
        toast({
          title: "Missing information", // Toast title
          description: "Please fill in all required fields.", // Toast description
          status: "error", // Toast status
          duration: 5000, // Toast duration
          isClosable: true, // Allow toast to be closed
        });
        return; // Exit if fields are not filled
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum); // Create provider
      const signer = provider.getSigner(); // Get signer
      
      // Get current network to adapt parameters
      const network = await provider.getNetwork(); // Get network information
      console.log("Deploying on network:", network.name, network.chainId); // Log network information

      // Convert float to large integer by multiplying with MULTIPLIER
      const strikePriceFloat = parseFloat(strikePrice); // Parse strike price as float
      const strikePriceInteger = Math.round(strikePriceFloat * STRIKE_PRICE_MULTIPLIER); // Convert to integer
      const strikePriceValue = ethers.BigNumber.from(strikePriceInteger.toString()); // Convert to BigNumber
      
      // Calculate maturity timestamp from date/time inputs
      const maturityTimestamp = Math.floor(new Date(`${maturityDate} ${maturityTime}`).getTime() / 1000); // Get maturity timestamp
      
      // Convert fee percentage to the format expected by the contract (multiply by 10)
      const feeValue = Math.round(parseFloat(feePercentage) * 10); // Convert fee percentage to integer
      
      // Create a factory with signer
      const factory = new ethers.ContractFactory(
        BinaryOptionMarket.abi,
        BinaryOptionMarket.bytecode,
        signer
      );

      // IMPORTANT: Use the normalized price feed address from selectedCoin
      // Get network-appropriate price feed address
      const normalizedPriceFeedAddress = ethers.utils.getAddress(selectedCoin.priceFeedAddress); // Normalize price feed address
      
      // Generate a random indexBg value between 1 and 10
      const randomIndexBg = Math.floor(Math.random() * 10) + 1; // Generate random index background
      
      console.log("Deploying contract with parameters:", {
        strikePrice: strikePriceValue.toString(), // Log strike price
        owner: await signer.getAddress(), // Log owner address
        tradingPair: selectedCoin.label, // Log trading pair
        priceFeedAddress: normalizedPriceFeedAddress, // Log price feed address
        maturityTime: maturityTimestamp, // Log maturity timestamp
        feePercentage: feeValue, // Log fee percentage
        indexBg: randomIndexBg // Log index background
      });
      
      // Adjust gas parameters based on network - with proper typing
      const overrides: { gasLimit?: any; gasPrice?: any } = {}; // Gas parameters
      if (network.chainId === 1) {
        // Mainnet requires more careful gas settings
        overrides.gasLimit = ethers.utils.hexlify(3000000); // Set gas limit for mainnet
        // Only set gasPrice if not using EIP-1559
        if (gasPrice) {
          overrides.gasPrice = ethers.utils.parseUnits(gasPrice, "gwei"); // Set gas price
        }
      } else if (network.chainId === 11155111) {
        // Sepolia testnet
        overrides.gasLimit = ethers.utils.hexlify(3000000); // Set gas limit for Sepolia
      } else {
        // Local or other networks
        overrides.gasLimit = ethers.utils.hexlify(6000000); // Set gas limit for local or other networks
      }
       
      // Deploy with ALL required parameters in correct order
      const contract = await factory.deploy(
        strikePriceValue,                // int _strikePrice
        await signer.getAddress(),       // address _owner
        selectedCoin.label,              // string memory _tradingPair
        normalizedPriceFeedAddress,      // address _priceFeedAddress
        maturityTimestamp,               // uint _maturityTime
        feeValue,                        // uint _feePercentage
        randomIndexBg,                   // uint _indexBg
        overrides                        // Gas parameters
      );
      
      console.log("Transaction hash:", contract.deployTransaction.hash); // Log transaction hash
      
      // Show toast while waiting for deployment
      const deployToastId = toast({
        title: "Deploying Market", // Toast title
        description: `Transaction submitted: ${contract.deployTransaction.hash.substring(0, 10)}...`, // Toast description
        status: "info", // Toast status
        duration: null, // No duration for loading toast
        isClosable: true, // Allow toast to be closed
      });
      
      // Wait for contract to be deployed
      await contract.deployed(); // Wait for deployment
      
      // Update toast to show success
      toast.update(deployToastId, {
        title: "Market Deployed", // Toast title
        description: `Contract deployed at: ${contract.address}`, // Toast description
        status: "success", // Toast status
        duration: 5000, // Toast duration
      });
      
      console.log("Contract deployed to:", contract.address); // Log deployed contract address
      setContractAddress(contract.address); // Update contract address state

      // Register with Factory contract on current network
      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, Factory.abi, signer); // Create factory contract instance
      const registerTx = await factoryContract.deploy(contract.address, overrides); // Register contract with factory
      
      // Show toast while waiting for registration
      const registerToastId = toast({
        title: "Registering with Factory", // Toast title
        description: `Transaction submitted: ${registerTx.hash.substring(0, 10)}...`, // Toast description
        status: "info", // Toast status
        duration: null, // No duration for loading toast
        isClosable: true, // Allow toast to be closed
      });
      
      // Wait for transaction to be mined
      await registerTx.wait(); // Wait for registration transaction
      
      // Update toast
      toast.update(registerToastId, {
        title: "Registration Complete", // Toast title
        description: "Market registered with Factory", // Toast description
        status: "success", // Toast status
        duration: 5000, // Toast duration
      });
      
      // Update deployed contracts list
      setDeployedContracts([...deployedContracts, contract.address]); // Update deployed contracts state
      
      // Reset form after successful deployment
      resetForm(); // Reset form fields
      
      // Refresh wallet balance after deployment
      refreshBalance(); // Refresh wallet balance
      router.push('/listaddress/1');
      
    } catch (error) {
      console.error("Error deploying contract:", error); // Log error if deployment fails
      toast({
        title: "Deployment Failed", // Toast title
        description: error.message || "Failed to deploy market contract", // Toast description
        status: "error", // Toast status
        duration: 5000, // Toast duration
        isClosable: true, // Allow toast to be closed
      });
    }
  };

  // Fetch contract balance
  const fetchContractBalance = async () => {
    try {
      console.log("Fetching contract balance..."); // Log before fetching balance
      const provider = new ethers.providers.Web3Provider(window.ethereum); // Create provider
      const contractBalanceWei = await provider.getBalance(contractAddress); // Get contract balance in Wei
      const contractBalanceEth = parseFloat(ethers.utils.formatEther(contractBalanceWei)); // Convert from Wei to ETH
      setContractBalance(contractBalanceEth.toFixed(4)); // Update contract balance state
      console.log("Contract Balance:", contractBalanceEth); // Log contract balance
    } catch (error: any) {
      console.error("Failed to fetch contract balance:", error); // Log error if fetching fails
      toast({
        title: "Error fetching contract balance", // Toast title
        description: error.message || "An unexpected error occurred.", // Toast description
        status: "error", // Toast status
        duration: 5000, // Toast duration
        isClosable: true, // Allow toast to be closed
      });
    }
  };

  // Listen for new contract deployment events to update contracts list
  useEffect(() => {
    const provider = new ethers.providers.Web3Provider(window.ethereum); // Create provider
    const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, provider); // Create factory contract instance

    // Listen for Deployed event to update contracts when a new contract is created
    factoryContract.on("Deployed", (owner, contractAddress, index) => {
      console.log("New contract stored:", contractAddress); // Log new contract address
      fetchContractsByOwner(); // Update contracts list after receiving event
    });

    return () => {
      // Unsubscribe from event when component unmounts
      factoryContract.off("Deployed", (owner, contractAddress, index) => {
        console.log("New contract stored:", contractAddress); // Log new contract address
        fetchContractsByOwner(); // Update contracts list after receiving event
      });
    };
  }, [walletAddress]);

  // Fetch all contracts owned by the current wallet address
  const fetchContractsByOwner = async () => {
    try {
      // Check if wallet is connected
      if (!walletAddress) {
        console.log("No wallet address available"); // Log if no wallet address
        return; // Exit if no wallet address
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum); // Create provider
      const contract = new ethers.Contract(FactoryAddress, Factory.abi, provider); // Create factory contract instance

      // Debug logs
      console.log("Fetching contracts for address:", walletAddress); // Log wallet address
      console.log("Using Factory at:", FactoryAddress); // Log factory address

      // Add valid address check
      if (!ethers.utils.isAddress(walletAddress)) {
        throw new Error("Invalid wallet address"); // Throw error if wallet address is invalid
      }

      const contracts = await contract.getContractsByOwner(walletAddress); // Fetch contracts by owner
      console.log("Contracts fetched:", contracts); // Log fetched contracts
      setDeployedContracts(contracts); // Update deployed contracts state

    } catch (error: any) {
      console.error("Failed to fetch contracts:", error); // Log error if fetching fails
      toast({
        title: "Error fetching contracts", // Toast title
        description: "Please make sure your wallet is connected", // Toast description
        status: "error", // Toast status
        duration: 5000, // Toast duration
        isClosable: true, // Allow toast to be closed
      });
    }
  };

  // Fetch contract balance when contract address changes
  useEffect(() => {
    if (contractAddress) {
      fetchContractBalance(); // Fetch contract balance
    }
  }, [contractAddress]);

  // Fetch contracts when wallet address changes
  useEffect(() => {
    if (walletAddress) {
      fetchContractsByOwner(); // Fetch contracts by owner
    }
  }, [walletAddress]);

  // Utility function to shorten addresses for display
  const shortenAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Fetch current prices from Coinbase API
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD');
        const data = await response.json();
        const rates = data.data.rates;

        // Update available coins with current prices
        setAvailableCoins([
          { value: "BTCUSD", label: "BTC/USD", currentPrice: 1 / parseFloat(rates.BTC), priceFeedAddress: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43" },
          { value: "ETHUSD", label: "ETH/USD", currentPrice: 1 / parseFloat(rates.ETH), priceFeedAddress: "0x694AA1769357215DE4FAC081bf1f309aDC325306" },
          { value: "LINKUSD", label: "LINK/USD", currentPrice: 1 / parseFloat(rates.LINK), priceFeedAddress: "0xc59E3633BAAC79493d908e63626716e204A45EdF" },
          { value: "SNXUSD", label: "SNX/USD", currentPrice: 1 / parseFloat(rates.SNX), priceFeedAddress: "0xc0F82A46033b8BdBA4Bb0B0e28Bc2006F64355bC" },
          { value: "WSTETHUSD", label: "WSTETH/USD", currentPrice: 1 / parseFloat(rates.WSTETH), priceFeedAddress: "0xaaabb530434B0EeAAc9A42E25dbC6A22D7bE218E" }
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

      // Calculate remaining days
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

  // Fetch current price from Coinbase via PriceService
  useEffect(() => {
    if (selectedCoin) {
      const priceService = PriceService.getInstance();
      const fetchCurrentPrice = async () => {
        try {
          // Convert from BTCUSD to BTC-USD if needed
          const symbol = selectedCoin.value;
const formattedSymbol = symbol.includes('-')
  ? symbol
  : `${symbol.slice(0, symbol.length - 3)}-${symbol.slice(-3)}`;

          const priceData = await priceService.fetchPrice(formattedSymbol);
          setCurrentPrice(priceData.price);

          // Calculate percent change if strikePrice is set
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

      // Update price every 30 seconds
      const intervalId = setInterval(fetchCurrentPrice, 30000);

      return () => clearInterval(intervalId);
    }
  }, [selectedCoin, strikePrice]);

  // Component UI render
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
        </HStack>
      )}

      <VStack spacing={8} p={8}>
        {!isConnected ? (
          // Wallet connection button shown when not connected
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
            {/* Main content area - displayed after wallet connection */}
            {/* Main content area with two columns */}
            <HStack spacing={0} w="full" maxW="1200px" align="flex-start" position="relative">
              {/* Left side - Market Creation Form */}
              <Box flex={1} pr={8} position="relative">
                <VStack spacing={6} align="stretch">
                  {/* Information note about market creation */}
                  <Box p={4} bg="rgba(255,255,255,0.05)" borderRadius="xl">
                    <Text fontSize="sm" color="white">
                      Note: When creating a market, you're establishing a binary options contract
                      where users can bid on whether the price will be above (LONG) or below (SHORT)
                      the strike price at maturity. The fee you set (between 0.1% and 20%) will be
                      applied to winning positions and distributed to you as the market creator.
                    </Text>
                  </Box>

                  {/* Asset selection dropdown */}
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

                  {/* Strike price input */}
                  <Box>
                    <Text color="white" mb={4} fontWeight="bold">STRIKE PRICE:</Text>
                    <InputGroup>
                      <Input
                        placeholder="Enter strike price"
                        value={strikePrice}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d*\.?\d*$/.test(value)) {
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

                  {/* Maturity date and time inputs */}
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
                      <Text color="white" mb={4} fontWeight="bold">TIME :</Text>
                      <InputGroup>
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
                      </InputGroup>
                    </Box>
                  </HStack>

                  {/* Fee Setting Box - slider and input */}
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
                            // Update feePercentage with 1 decimal place
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

                  {/* Network Fee Section - gas settings */}
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
                          <option value="60" style={{ backgroundColor: "#0a1647", color: "white" }}>60.00 (Slow)</option>
                          <option value="78" style={{ backgroundColor: "#0a1647", color: "white" }}>78.00 (Normal)</option>
                          <option value="90" style={{ backgroundColor: "#0a1647", color: "white" }}>90.00 (Fast)</option>
                          <option value="120" style={{ backgroundColor: "#0a1647", color: "white" }}>120.00 (Rapid)</option>
                        </Select>
                      </HStack>
                    </HStack>
                    <Text color="gray.500" fontSize="xs" mt={1}>
                      Estimated gas: {parseInt(estimatedGasUnits).toLocaleString()} units
                    </Text>
                  </Box>
                </VStack>
              </Box>

              {/* Vertical Divider between columns */}
              <Box
                position="absolute"
                left="50%"
                top={0}
                bottom={0}
                width="1px"
                bg="rgba(255,255,255,0.2)"
                transform="translateX(-50%)"
              />

              {/* Right side - Market Details and Preview */}
              <Box flex={1} pl={8}>
                <VStack spacing={6} align="center">
                  {/* OREKA Logo */}
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

                  {/* Market Details Box - Preview of market parameters */}
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
                            ${currentPrice ? currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Loading...'}
                          </Text>
                        </HStack>
                      </HStack>

                      <Divider borderColor="rgba(255,255,255,0.1)" />

                      <HStack justify="space-between">
                        <Text color="gray.400">Maturity date</Text>
                        <Text color="white">{maturityDate || 'Not set'} {maturityTime ? `${maturityTime} ` : ''}</Text>
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