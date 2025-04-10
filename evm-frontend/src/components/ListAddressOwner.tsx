import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, HStack, Icon, Text, VStack, SimpleGrid, Flex, Input, Select, Divider, Progress, InputGroup, InputRightAddon, Spinner, Slider, SliderTrack, SliderFilledTrack, SliderThumb, Tooltip, Spacer, Image } from '@chakra-ui/react';

import { FaCalendarDay, FaPlayCircle, FaClock, FaCheckCircle, FaListAlt, FaRegClock } from 'react-icons/fa'; // Import các biểu tượng
import { IoWalletOutline } from "react-icons/io5";
import { FaEthereum, FaWallet, FaTrophy, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { GoInfinity } from "react-icons/go";
import { SiBitcoinsv } from "react-icons/si";
import { FaCoins } from "react-icons/fa";
import Factory from '../contracts/abis/FactoryABI.json';
import { useToast } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { FACTORY_ADDRESS } from '../config/contracts';
import BinaryOptionMarket from '../contracts/abis/BinaryOptionMarketABI.json';
import { useAuth } from '../context/AuthContext';
import { PriceService } from '../services/PriceService';
import { format, formatDistanceToNow } from 'date-fns';
import { getCurrentTimestamp, isTimestampPassed, getTimeRemaining } from '../utils/timeUtils';
import { STRIKE_PRICE_MULTIPLIER } from '../utils/constants';

interface ListAddressOwnerProps {
  ownerAddress: string;
  page: number;
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
  owner: string;
  indexBg: string;
}

enum Phase { Trading, Bidding, Maturity, Expiry }


// function to get color for phase
const getPhaseColor = (phase: number) => {
  switch (phase) {
    case Phase.Trading:
      return "green.400";
    case Phase.Bidding:
      return "blue.400";
    case Phase.Maturity:
      return "orange.400";
    case Phase.Expiry:
      return "red.400";
    default:
      return "gray.400";
  }
};

// function to get name for phase
const getPhaseName = (phase: number) => {
  switch (phase) {
    case Phase.Trading:
      return "Trading";
    case Phase.Bidding:
      return "Bidding";
    case Phase.Maturity:
      return "Maturity";
    case Phase.Expiry:
      return "Expiry";
    default:
      return "Unknown";
  }
};



// update getMarketTitle to format strikePrice correctly
const getMarketTitle = (contract) => {
  try {
    // Format trading pair
    const pair = contract.tradingPair.replace('/', '-');

    // Format maturity time
    const timestamp = Number(contract.maturityTime);
    if (isNaN(timestamp) || timestamp === 0) return `${pair} Market`;

    const date = new Date(timestamp * 1000);
    const maturityTimeFormatted = format(date, 'MMM d, yyyy h:mm a');

    // convert strikePrice from integer to float
    const strikePriceInteger = parseInt(contract.strikePrice);
    const strikePriceFormatted = (strikePriceInteger / STRIKE_PRICE_MULTIPLIER).toFixed(2);

    return `${pair} will reach $${strikePriceFormatted} by ${maturityTimeFormatted} ?`;
  } catch (error) {
    console.error("Error getting market title:", error);
    return "Unknown Market";
  }
};

/**
 * Cleans up market titles by removing timestamp references in parentheses
 * @param {string} title - The original market title
 * @return {string} Cleaned title without timestamp information
 */
const cleanupMarketTitle = (title: string) => {
  // Remove any string within parentheses containing "Sat"
  return title.replace(/\([^)]*Sat[^)]*\)/g, '').trim();
};

/**
 * ListAddressOwner Component
 * Displays a list of binary option markets owned by a specific address
 * Provides filtering, pagination, and real-time market data updates
 * 
 * @param {string} ownerAddress - Ethereum address to display contracts for
 * @param {number} page - Current pagination page number
 */
const ListAddressOwner: React.FC<ListAddressOwnerProps> = ({ ownerAddress, page }) => {
  // Authentication and wallet context
  const { isConnected, walletAddress, balance, connectWallet, refreshBalance } = useAuth();

  // Contract data state management
  const [deployedContracts, setDeployedContracts] = useState<ContractData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const toast = useToast();
  const router = useRouter();

  // Contract position percentage tracking for visualizing LONG/SHORT distribution
  const [contractPercentages, setContractPercentages] = useState<{ [key: string]: { long: number, short: number } }>({});

  // Pagination configuration
  const currentPage = page;
  const contractsPerPage = 32;
  const [currentContracts, setCurrentContracts] = useState<ContractData[]>([]);

  // Factory contract address for interacting with the main factory
  const FactoryAddress = FACTORY_ADDRESS;

  // Tab selection for filtering markets
  const [currentTab, setCurrentTab] = useState<string>('All Markets');

  /**
   * Filters contracts based on the currently selected tab
   * Different tabs show different subsets of markets (All, Recent, Active, Expired, By Asset)
   */
  const filteredContracts = currentContracts.filter(contract => {
    if (currentTab === 'All Markets') return true;
    if (currentTab === 'Most recent') return true; // Will be sorted later, no filtering needed
    if (currentTab === 'Quests') return contract.phase === Phase.Trading || contract.phase === Phase.Bidding;
    if (currentTab === 'Results') return contract.phase === Phase.Maturity || contract.phase === Phase.Expiry;
    return contract.tradingPair === currentTab; // Filter by trading pair if tab matches a pair name
  });

  /**
     * Sorts contracts by creation date when "Most recent" tab is selected
     * Newest contracts appear at the top of the list
     */
  useEffect(() => {
    if (currentTab === 'Most recent') {
      // Create a copy of the array to avoid modifying the original state directly
      const sortedContracts = [...currentContracts].sort((a, b) => {
        // Sort by creation date in descending order (newest first)
        return new Date(b.createDate).getTime() - new Date(a.createDate).getTime();
      });
      setCurrentContracts(sortedContracts);
    }
  }, [currentTab]);





  /**
   * Calculates total page count based on number of contracts and pagination settings
   * Provides a navigation handler for changing pages
   */
  // const totalPages = Math.ceil(deployedContracts.length / contractsPerPage);

  /**
   * Handles pagination navigation
   * @param {number} page - Target page number to navigate to
   */
  // const handlePageChange = (page: number) => {
  //   if (page !== currentPage) { // Only change if page is different from current
  //     router.push(`/listaddress/page${page}`);
  //   }
  // };

  /**
 * Updates displayed contracts when page changes or when contract data updates
 * Slices the full contracts array to show only the current page's worth of contracts
 */
  useEffect(() => {
    const indexOfLastContract = page * contractsPerPage;
    const indexOfFirstContract = indexOfLastContract - contractsPerPage;
    const newCurrentContracts = deployedContracts.slice(indexOfFirstContract, indexOfLastContract);
    setCurrentContracts(newCurrentContracts);
  }, [deployedContracts, page]);

  /**
   * Updates displayed contracts when page changes or when contract data updates
   * Slices the full contracts array to show only the current page's worth of contracts
   */
  useEffect(() => {
    fetchDeployedContracts();
  }, [ownerAddress, page]);

  /**
   * Fetches all deployed contracts from the blockchain
   * Retrieves contracts from known owners and falls back to event logs if needed
   */
  const fetchDeployedContracts = async () => {
    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, provider);

      console.log("Fetching all contracts from all known owners");

      // List of known wallet addresses to check for contracts
      // Can be expanded with additional addresses as the platform grows
      const knownOwners = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Default Hardhat account #0
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Default Hardhat account #1
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Default Hardhat account #2
        // Additional known addresses can be added here
      ];

      // Add current user's address and requested owner address to the lookup list
      if (walletAddress && !knownOwners.includes(walletAddress)) {
        knownOwners.push(walletAddress);
      }
      if (ownerAddress && !knownOwners.includes(ownerAddress)) {
        knownOwners.push(ownerAddress);
      }

      console.log("Known owners:", knownOwners);

      // Retrieve all contracts from all known owner addresses
      let allContracts: string[] = [];

      for (const owner of knownOwners) {
        try {
          if (owner && owner !== "") {
            const ownerContracts = await factoryContract.getContractsByOwner(owner);
            console.log(`Contracts for owner ${owner}:`, ownerContracts);

            // Add new contracts to the list (avoiding duplicates)
            ownerContracts.forEach((contract: string) => {
              if (!allContracts.includes(contract)) {
                allContracts.push(contract);
              }
            });
          }
        } catch (err) {
          console.error(`Error fetching contracts for owner ${owner}:`, err);
        }
      }

      console.log("All contracts:", allContracts);

      // Fallback to event logs if no contracts found through direct lookup
      if (allContracts.length === 0) {
        try {
          console.log("Trying to fetch from event logs");
          const filter = factoryContract.filters.Deployed();
          const events = await factoryContract.queryFilter(filter);

          console.log("Found events:", events.length);

          // Extract contract addresses from deployment events
          events.forEach(event => {
            const contractAddress = event.args?.contractAddress;
            if (contractAddress && !allContracts.includes(contractAddress)) {
              allContracts.push(contractAddress);
            }
          });

          console.log("Contracts from events:", allContracts);
        } catch (error) {
          console.error("Error fetching from events:", error);
        }
      }

      // Fetch detailed data for each contract address
      const contractsData = await Promise.all(allContracts.map(async (address: string) => {
        const contract = new ethers.Contract(address, BinaryOptionMarket.abi, provider);

        try {
          // Get basic data from contract
          const [
            positions,
            strikePriceBN,
            phase,
            maturityTimeBN,
            tradingPair,
            owner
          ] = await Promise.all([
            contract.positions(),
            contract.strikePrice(),
            contract.currentPhase(),
            contract.maturityTime(),
            contract.tradingPair().catch(() => 'Unknown'),
            contract.owner()
          ]);

          // Handle background index separately to support backward compatibility with older contracts
          let indexBgValue = 1; // Default value
          try {
            const indexBgResult = await contract.indexBg();
            indexBgValue = indexBgResult.toNumber ? indexBgResult.toNumber() : parseInt(indexBgResult.toString());
            console.log(`Contract ${address} has indexBg: ${indexBgValue}`);
          } catch (error) {
            console.log(`Error getting indexBg for contract ${address}, using default: 1`);
          }

          // Convert maturityTime from BigNumber to number
          let maturityTimeValue;
          if (maturityTimeBN && typeof maturityTimeBN.toNumber === 'function') {
            maturityTimeValue = maturityTimeBN.toNumber();
            console.log("Converted maturityTime from BigNumber:", maturityTimeValue);
          } else if (typeof maturityTimeBN === 'string') {
            maturityTimeValue = parseInt(maturityTimeBN);
            console.log("Converted maturityTime from string:", maturityTimeValue);
          } else {
            maturityTimeValue = maturityTimeBN;
            console.log("Using maturityTime as is:", maturityTimeValue);
          }

          // Check for valid maturityTime
          if (!maturityTimeValue || isNaN(maturityTimeValue) || maturityTimeValue <= 0) {
            console.log("Invalid maturityTime, using current time + 1 day as fallback");
            maturityTimeValue = Math.floor(Date.now() / 1000) + 86400; // Current time + 1 day
          }

          // Diagnostic logging for maturity time validation
          const maturityDate = new Date(maturityTimeValue * 1000);
          console.log("Maturity date:", maturityDate.toISOString());
          console.log("Current time:", new Date().toISOString());
          console.log("Is maturity in the past?", maturityDate <= new Date());

          return {
            address,
            createDate: new Date().toISOString(),
            longAmount: ethers.utils.formatEther(positions.long),
            shortAmount: ethers.utils.formatEther(positions.short),
            strikePrice: strikePriceBN.toString(),
            phase: phase.toString(),
            maturityTime: maturityTimeValue,
            tradingPair,
            owner,
            indexBg: indexBgValue.toString()
          };
        } catch (error) {
          console.error(`Error fetching data for contract ${address}:`, error);
          return {
            address,
            createDate: new Date().toISOString(),
            longAmount: '0',
            shortAmount: '0',
            strikePrice: '0',
            phase: '0',
            maturityTime: 0,
            tradingPair: 'Unknown',
            owner: '',
            indexBg: '1'
          };
        }
      }));

      setDeployedContracts(contractsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching deployed contracts:", error);
      setLoading(false);
    }
  };

  /**
   * Log owner address on component mount for debugging
   */
  useEffect(() => {
    console.log("Component mounted. Owner address:", ownerAddress);
  }, []);

  /**
 * Initial contract data loading when owner address changes
 */
  useEffect(() => {
    fetchDeployedContracts();
  }, [ownerAddress]);

  /**
   * Set up event listeners for new contract deployments
   * Refreshes contract list automatically when new contracts are deployed
   */
  useEffect(() => {
    fetchDeployedContracts();

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(FactoryAddress, Factory.abi, provider);

    /**
     * Handler for new contract deployment events
     * @param {string} owner - Address of the contract owner
     * @param {string} contractAddress - Address of the newly deployed contract
     * @param {number} index - Index of the contract in the owner's list
     */
    const handleNewContract = (owner: string, contractAddress: string, index: number) => {
      console.log("New contract deployed event received:", contractAddress);
      console.log("Owner:", owner);
      console.log("Index:", index);

      // Always update contract list when a new contract is deployed
      fetchDeployedContracts();
    };

    // Listen for Deployed events
    contract.on("Deployed", handleNewContract);

    // Cleanup listener on unmount
    return () => {
      contract.removeListener("Deployed", handleNewContract);
    };
  }, []);

  /**
 * Handles contract selection and navigation
 * Stores contract data in localStorage and redirects to appropriate view
 * 
 * @param {string} contractAddress - Address of the selected contract
 * @param {string} owner - Owner address of the contract
 * @param {ContractData} contractData - Full contract data object
 */
  const handleAddressClick = (contractAddress: string, owner: string, contractData: ContractData) => {
    // Store contract address in localStorage for persistence across page navigations
    localStorage.setItem('selectedContractAddress', contractAddress);

    // Store additional contract data for Customer.tsx to use immediately
    localStorage.setItem('contractData', JSON.stringify({
      address: contractAddress,
      strikePrice: contractData.strikePrice,
      maturityTime: contractData.maturityTime,
      tradingPair: contractData.tradingPair,
      phase: contractData.phase,
      longAmount: contractData.longAmount,
      shortAmount: contractData.shortAmount,
      owner: contractData.owner,
      timestamp: Date.now()
    }));

    // Always navigate to the customer view for the contract
    router.push(`/customer/${contractAddress}`);

    // Show warning toast if user is not the contract owner
    if (isConnected && walletAddress.toLowerCase() !== owner.toLowerCase()) {
      toast({
        title: "Access restricted",
        description: "You are not the owner of this contract. Redirecting to market view.",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  /**
   * Shortens an Ethereum address for display purposes
   * @param {string} address - The full Ethereum address to shorten
   * @returns {string} - The shortened version of the address
   */
  const shortenAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  /**
   * Updates balance in real-time using Web3Provider
   * Listens for block events to refresh balance
   */
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

  /**
 * State for storing fixed background image indices for contract cards
 * Maps contract addresses to specific background image indices
 */
  const [contractImageIndices, setContractImageIndices] = useState<{ [key: string]: number }>({});

  /**
 * State for storing countdown timers for each contract
 * Maps contract addresses to formatted time remaining strings
 */
  const [countdowns, setCountdowns] = useState<{ [key: string]: string }>({});

  /**
  * Updates countdown timers for all contracts every second
  * Shows "Ended" for expired contracts and time remaining for active ones
  */
  useEffect(() => {
    /**
    * Updates all contract countdowns with current values
    */
    const updateCountdowns = () => {
      const newCountdowns: { [key: string]: string } = {};

      currentContracts.forEach(contract => {
        const timestamp = Number(contract.maturityTime);
        if (!isNaN(timestamp) && timestamp > 0) {
          if (isTimestampPassed(timestamp)) {
            newCountdowns[contract.address] = "Ended";
          } else {
            newCountdowns[contract.address] = getTimeRemaining(timestamp);
          }
        } else {
          newCountdowns[contract.address] = "Unknown";
        }
      });

      setCountdowns(newCountdowns);
    };

    // Update countdowns immediately
    updateCountdowns();

    // Set interval to update countdowns every second
    const intervalId = setInterval(updateCountdowns, 1000);

    return () => clearInterval(intervalId);
  }, [currentContracts]);

  /**
  * Assigns fixed background image indices to contracts when the contract list changes
  * Uses indexBg from contract data if available, with fallback to default value
  */
  useEffect(() => {
    console.log("Setting contract image indices...");
    const newImageIndices: { [key: string]: number } = {};

    currentContracts.forEach(contract => {
      if (!contract) return;

      // Read indexBg from contract and convert to number
      const bgIndex = contract.indexBg ?
        Math.min(Math.max(parseInt(contract.indexBg), 1), 10) :
        1;

      console.log(`Contract ${contract.address} using background index: ${bgIndex}`);
      newImageIndices[contract.address] = bgIndex;
    });

    setContractImageIndices(newImageIndices);
  }, [currentContracts]);

  /**
 * Renders time remaining for a contract using the countdown state
 * 
 * @param {string} contractAddress - Address of the contract to display time for
 * @return {string} Formatted time remaining or status message
 */
  const renderTimeRemaining = (contractAddress: string) => {
    const countdown = countdowns[contractAddress];
    if (!countdown) return "Unknown";

    return countdown;
  };

  /**
   * State for storing current prices of asset pairs
   * Maps asset pairs to their current prices
   */
  const [assetPrices, setAssetPrices] = useState<{ [key: string]: number }>({});

  /**
   * Replaces the old useEffect for polling prices with WebSocket implementation
   * Uses Coinbase WebSocket API to get real-time price updates
   */
  useEffect(() => {
    // Define the trading pairs we want to subscribe to
    // Make sure these match the format used by Coinbase API (with hyphens)
    const tradingPairs = ['BTC-USD', 'ETH-USD', 'ICP-USD'];

    // Get PriceService instance
    const priceService = PriceService.getInstance();

    // Create a mapping function to convert from API format to display format
    const formatPairForDisplay = (apiSymbol: string) => apiSymbol.replace('-', '/');

    // Subscribe to websocket updates
    const unsubscribe = priceService.subscribeToWebSocketPrices((priceData) => {
      // When we get a price update, update our state
      // Convert the symbol format from API format (BTC-USD) to display format (BTC/USD)
      const displaySymbol = formatPairForDisplay(priceData.symbol);

      setAssetPrices(prev => ({
        ...prev,
        [displaySymbol]: priceData.price
      }));

      console.log(`Updated price for ${displaySymbol}: $${priceData.price}`);
    }, tradingPairs);

    // Load initial prices directly
    tradingPairs.forEach(async (pair) => {
      try {
        const priceData = await priceService.fetchPrice(pair);
        const displaySymbol = formatPairForDisplay(pair);

        setAssetPrices(prev => ({
          ...prev,
          [displaySymbol]: priceData.price
        }));

        console.log(`Initial price for ${displaySymbol}: $${priceData.price}`);
      } catch (error) {
        console.error(`Error fetching initial price for ${pair}:`, error);
      }
    });

    // Clean up by unsubscribing when component unmounts
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const newPercentages: { [key: string]: { long: number, short: number } } = {};

    currentContracts.forEach(contract => {
      const longAmount = parseFloat(contract.longAmount || '0');
      const shortAmount = parseFloat(contract.shortAmount || '0');
      const total = longAmount + shortAmount;

      if (total > 0) {
        const longPercent = (longAmount / total) * 100;
        const shortPercent = (shortAmount / total) * 100;

        newPercentages[contract.address] = {
          long: longPercent,
          short: shortPercent
        };
      } else {
        // Default to 50/50 if no amounts are present
        newPercentages[contract.address] = {
          long: 50,
          short: 50
        };
      }
    });

    setContractPercentages(newPercentages);
  }, [currentContracts]);


  return (
    <Box bg="white" minH="100vh">
      {/* Application header with wallet connection status */}
      <Flex
        as="header"
        align="center"
        justify="space-between"
        p={4}
        bg="white"
        borderBottom="1px"
        borderColor="gray.200"
        position="sticky"
        top="0"
        zIndex="sticky"
        boxShadow="sm"
      >
        {/* Platform logo/name */}
        <Text fontSize="xl" fontWeight="bold" color="gray.800">
          OREKA
        </Text>

        <Spacer />
        {/* Conditional rendering based on wallet connection status */}
        {isConnected ? (
          <HStack spacing={4}>
            {/* ETH balance display for connected users */}
            <HStack
              p={2}
              bg="gray.50"
              borderRadius="md"
              borderWidth="1px"
              borderColor="gray.200"
            >
              <Icon as={FaEthereum} color="blue.500" />
              <Text color="gray.700" fontWeight="medium">
                {parseFloat(balance).toFixed(4)} ETH
              </Text>
            </HStack>
{/* Connected wallet address (shortened) */}
            <Button
              leftIcon={<FaWallet />}
              colorScheme="blue"
              variant="outline"
              size="md"
            >
              {shortenAddress(walletAddress)}
            </Button>
          </HStack>
        ) : (
          // {/* Connect wallet button for non-connected users */} 
          <Button
            leftIcon={<FaWallet />}
            colorScheme="blue"
            size="md"
            onClick={connectWallet}
          >
            Connect Wallet
          </Button>
        )}
      </Flex>

      <Box p={6}>
        {/* Header with tabs */}
        <Box mb={6}>

          {/* Horizontally scrollable tab navigation */}
          <Flex
            overflowX="auto"
            pb={2}
            mb={4}
            css={{
              '&::-webkit-scrollbar': {
                height: '8px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.1)',
                borderRadius: '4px',
              }
            }}
          >
            <HStack spacing={4}>
              {/* List of tabs */}
              {['All Markets', 'Most recent', 'Quests', 'Results', 'BTC/USD', 'ETH/USD', 'ICP/USD'].map((tab) => (
                <Button
                  key={tab}
                  size="md"
                  variant={currentTab === tab ? "solid" : "ghost"}
                  colorScheme={currentTab === tab ? "blue" : "gray"}
                  onClick={() => setCurrentTab(tab)}
                  minW="120px"
                  leftIcon={
                    tab === 'All Markets' ? <FaListAlt /> :
                      tab === 'Most recent' ? <FaCalendarDay /> :
                        tab === 'Quests' ? <FaPlayCircle /> :
                          tab === 'Results' ? <FaTrophy /> :
                            tab === 'BTC/USD' ? <SiBitcoinsv /> :
                              tab === 'ETH/USD' ? <FaEthereum /> :
                                <FaCoins />
                  }
                >
                  {tab}
                </Button>
              ))}
            </HStack>
          </Flex>
        </Box>

        {loading ? (
          // {/* Loading message */}
          <Text color="gray.600">Loading...</Text>
        ) : deployedContracts.length > 0 ? (
          // {/* Display contracts in a grid layout */}
          <SimpleGrid
            columns={{ base: 1, md: 2, lg: 3, xl: 4 }}
            spacing={4}
            width="100%"
          >
            {filteredContracts.map(({ address, createDate, longAmount, shortAmount, strikePrice, phase, maturityTime, tradingPair, owner }, index) => (

              <Box
                key={index}
                p="2px"
                borderRadius="lg"
                background="linear-gradient(135deg, #00c6ff, #0072ff, #6a11cb, #2575fc)" // Gradient border
                transition="transform 0.2s"
                _hover={{ transform: 'translateY(-4px)' }}
                cursor="pointer"
              >
                <Box
                  borderRadius="md"
                  overflow="hidden"
                  boxShadow="md"
                  bg="#1A202C"
                  onClick={() =>
                    handleAddressClick(address, owner, {
                      address,
                      createDate,
                      longAmount,
                      shortAmount,
                      strikePrice,
                      phase,
                      maturityTime,
                      tradingPair,
                      owner,
                      indexBg: contractImageIndices[address] ? contractImageIndices[address].toString() : '1'
                    })
                  }
                >
                  {/* Image section - use fixed random number from state */}
                  <Box
                    h="230px"
                    w="100%"
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    bg="#151A23"
                    p={1}
                    position="relative"

                  >
                    <Image
                      src={`/images/${tradingPair.split('/')[0].toLowerCase()}/${tradingPair.split('/')[0].toLowerCase()}${contractImageIndices[address] || 1}.png`}
                      alt={tradingPair}
                      w="100%"
                      h="100%"
                      objectFit="cover"
                      position="relative"
                      fallback={<Box h="100%" w="100%" bg="#1A202C" borderRadius="full" />}
                    />
                    <Box
                      display="inline-block"
                      bg={getPhaseColor(parseInt(phase))}
                      color="white"
                      px={3}
                      py={1}
                      borderRadius="md"
                      fontSize="sm"
                      fontWeight="bold"
                      mb={2}
                      position="absolute"
                      bottom="3px"
                      left="7px"
                    >
                      {getPhaseName(parseInt(phase))}
                    </Box>
                  </Box>

                  {/* Info section in the middle - Giảm padding và margin */}
                  <Box p={3}>
                    {/* Phase indicator - Giảm margin bottom */}


                    {/* Market title - Giảm margin bottom */}
                    <Text fontWeight="bold" mb={1} color="white" fontSize="xl">
                      {cleanupMarketTitle(getMarketTitle({ address, createDate, longAmount, shortAmount, strikePrice, phase, maturityTime, tradingPair, owner }))}
                    </Text>


                    {/* LONG/SHORT ratio */}
                    <Flex
                      align="center"
                      w="100%"
                      h="25px"
                      borderRadius="full"
                      bg="gray.800"
                      border="1px solid"
                      borderColor="gray.600"
                      position="relative"
                      overflow="hidden"
                      boxShadow="inset 0 1px 3px rgba(0,0,0,0.6)"
                      mb={4}
                    >
                      {/* LONG Section */}
                      <Box
                        width={`${contractPercentages[address]?.long}%`}
                        bgGradient="linear(to-r, #0f0c29, #00ff87)"
                        transition="width 0.6s ease"
                        h="full"
                        display="flex"
                        alignItems="center"
                        justifyContent="flex-end"
                        pr={3}
                        position="relative"
                        zIndex={1}
                      >
                        {contractPercentages[address]?.long > 8 && (
                          <Text
                            fontSize="sm"
                            fontWeight="bold"
                            color="whiteAlpha.800"
                          >
                            {contractPercentages[address]?.long.toFixed(0)}%
                          </Text>
                        )}
                      </Box>

                      {/* SHORT Section (in absolute layer for smooth overlap) */}
                      <Box
                        position="absolute"
                        right="0"
                        top="0"
                        h="100%"
                        width={`${contractPercentages[address]?.short}%`}
                        bgGradient="linear(to-r, #ff512f, #dd2476)"
                        transition="width 0.6s ease"
                        display="flex"
                        alignItems="center"
                        justifyContent="flex-start"
                        pl={3}
                        zIndex={0}
                      >
                        {contractPercentages[address]?.short > 8 && (
                          <Text
                            fontSize="sm"
                            fontWeight="bold"
                            color="whiteAlpha.800"
                          >
                            {contractPercentages[address]?.short.toFixed(0)}%
                          </Text>
                        )}
                      </Box>
                    </Flex>

                    <Flex justify="space-between" align="center" mb={2}>
                      <Box>
                        <Button fontSize="sm"
                          color="#1E4146"
                          textAlign="right"
                          w="200px"
                          h="45px"
                          borderRadius="full"
                          bg="#1B3B3F"
                          border="1px solid"
                          borderColor="gray.600"
                          boxShadow="inset 0 1px 3px rgba(0,0,0,0.6)"
                          textColor="#20BCBB"
                          _hover={{
                            bg: "green.500",
                            color: "white",
                          }}
                          ml={3}
                        >
                          LONG
                        </Button>
                      </Box>
                      <Box>
                        <Button fontSize="sm"
                          color="#3D243A"
                          textAlign="right"
                          w="200px"
                          h="45px"
                          borderRadius="full"
                          bg="#3D243A"
                          border="1px solid"
                          borderColor="gray.600"
                          textColor="#FF6492"
                          boxShadow="inset 0 1px 3px rgba(0,0,0,0.6)"
                          _hover={{
                            bg: "red.500",
                            color: "white",
                          }}
                          mr={3}
                        >
                          SHORT
                        </Button>
                      </Box>
                    </Flex>

                    <Divider my={4} borderColor="gray.600" />

                    <Flex justify="space-between" align="center">
                      <HStack spacing={2}>
                        <Icon
                          as={
                            tradingPair.includes("BTC")
                              ? SiBitcoinsv
                              : tradingPair.includes("ETH")
                                ? FaEthereum
                                : GoInfinity
                          }
                          color="blue.300"
                        />
                        <Text fontWeight="bold" fontSize="lg" color="white">
                          {assetPrices[tradingPair]
                            ? `$${assetPrices[tradingPair].toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}`
                            : "Loading..."}
                        </Text>
                      </HStack>
                      <HStack>
                        <Icon as={FaRegClock} color="gray.400" />
                        <Text fontSize="sm" color="gray.400" textAlign="right">
                          {renderTimeRemaining(address)}
                        </Text>
                      </HStack>
                    </Flex>
                  </Box>
                </Box>
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