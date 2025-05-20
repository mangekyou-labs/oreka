import React, { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, HStack, Icon, Text, VStack, SimpleGrid, Flex, Input, Select, Divider, InputGroup, Image, InputRightElement } from '@chakra-ui/react';

import { FaRegClock, FaDollarSign } from 'react-icons/fa';
import { FaEthereum, FaWallet, FaSearch } from 'react-icons/fa';
import { TbDropletHalf2Filled } from "react-icons/tb";
import { GrDeploy } from 'react-icons/gr';
import { SiBitcoinsv, SiChainlink, SiExpertsexchange } from "react-icons/si";
import Factory from '../contracts/abis/FactoryABI.json';
import { useToast } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { FACTORY_ADDRESS } from '../config/contracts';
import BinaryOptionMarket from '../contracts/abis/BinaryOptionMarketABI.json';
import { useAuth } from '../context/AuthContext';
import { PriceService } from '../services/PriceService';
import { format, formatDistanceToNow } from 'date-fns';
import { getCurrentTimestamp, isTimestampPassed, getTimeRemaining, formatTimeToLocal } from '../utils/timeUtils';
import { getChartSymbolFromTradingPair } from '../utils/priceFeeds';

interface ListAddressOwnerProps {
  ownerAddress: string;
  page: number;
}


interface ContractData {
  address: string;
  deployTime: number;
  longAmount: string;
  shortAmount: string;
  strikePrice: string;
  finalPrice: string;
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

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContractData[]>([]);

  // Contract position percentage tracking for visualizing LONG/SHORT distribution
  const [contractPercentages, setContractPercentages] = useState<{ [key: string]: { long: number, short: number } }>({});

  // Pagination configuration
  const currentPage = page;
  const contractsPerPage = 12;
  const [currentContracts, setCurrentContracts] = useState<ContractData[]>([]);

  // Factory contract address for interacting with the main factory
  const FactoryAddress = FACTORY_ADDRESS;

  // Get deployed contracts for the specified owner address
  const [marketResults, setMarketResults] = useState<{ [key: string]: string }>({});
  // Tab selection for filtering markets
  const [currentTab, setCurrentTab] = useState<string>('All Markets');
  const { currentTab: currentTabQuery } = router.query;

  // Trading pair filter
  const [currentTradingPairFilter, setCurrentTradingPairFilter] = useState<string | null>(null);

  // User holdings contracts
  const [userHoldingsContracts, setUserHoldingsContracts] = useState<string[]>([]);

  // Update current phase when it change
  const [currentPhase, setCurrentPhase] = useState<number>(Phase.Trading);

  /**
   * Filters contracts based on the currently selected tab
   * Different tabs show different subsets of markets (All, Recent, Active, Expired, By Asset)
   */

  useEffect(() => {
    if (typeof currentTabQuery === 'string') {
      setCurrentTab(currentTabQuery);
    }
  }, [currentTabQuery]);

  const indexOfLastContract = page * contractsPerPage;
  const indexOfFirstContract = indexOfLastContract - contractsPerPage;

  const filteredContracts = useMemo(() => {
    const filtered = deployedContracts.filter(contract => {
      switch (currentTab) {
        case 'All Markets':
          return true;
        case 'Quests':
          return (
            (Number(contract.phase) === Phase.Trading || Number(contract.phase) === Phase.Bidding) &&
            Date.now() < Number(contract.maturityTime) * 1000
          );
        case 'Results':
          return Number(contract.phase) === Phase.Maturity || Number(contract.phase) === Phase.Expiry;
        case 'Pair':
          return currentTradingPairFilter
            ? contract.tradingPair === currentTradingPairFilter
            : true;
        case 'My Markets':
          return contract.owner.toLowerCase() === walletAddress?.toLowerCase();
        case 'My Holdings':
          return userHoldingsContracts.includes(contract.address.toLowerCase());
        default:
          return true;
      }
    });

    const sorted = [...filtered].sort((a, b) => {
      const aTimestamp = a.deployTime ? new Date(a.deployTime * 1000).getTime() : 0;
      const bTimestamp = b.deployTime ? new Date(b.deployTime * 1000).getTime() : 0;
      return bTimestamp - aTimestamp;
    });


    return sorted;
  }, [
    deployedContracts,
    currentTab,
    currentTradingPairFilter,
    walletAddress,
    userHoldingsContracts,
  ]);


  const paginatedContracts = useMemo(() => {
    return filteredContracts.slice(indexOfFirstContract, indexOfLastContract);
  }, [filteredContracts, indexOfFirstContract, indexOfLastContract]);


  const fetchMarketResults = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const results: { [key: string]: string } = {};

    for (const contract of paginatedContracts) {
      try {
        const instance = new ethers.Contract(contract.address, BinaryOptionMarket.abi, provider);
        const oracle = await instance.oracleDetails();
        const final = parseFloat(oracle.finalPrice.toString());
        const strike = parseFloat(oracle.strikePrice.toString());
        results[contract.address] = final < strike ? 'SHORT' : 'LONG';
      } catch (err) {
        console.error(`Error fetching market result for ${contract.address}`, err);
      }
    }

    setMarketResults(results);
  };

  useEffect(() => {
    if (paginatedContracts.length > 0) {
      fetchMarketResults();
    }
  }, [paginatedContracts]);
  /**
     * Fetch user holdings contracts
     */
  useEffect(() => {
    if (!walletAddress || !deployedContracts.length) return;

    const fetchUserHoldings = async () => {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const result: string[] = [];

      for (const contract of deployedContracts) {
        try {
          const instance = new ethers.Contract(contract.address, BinaryOptionMarket.abi, provider);

          const [longBid, shortBid] = await Promise.all([
            instance.longBids(walletAddress),
            instance.shortBids(walletAddress)
          ]);

          if (!longBid.isZero() || !shortBid.isZero()) {
            result.push(contract.address.toLowerCase());
          }
        } catch (err) {
          console.error(`Error checking bids for ${contract.address}`, err);
        }
      }

      setUserHoldingsContracts(result);
    };

    fetchUserHoldings();
  }, [walletAddress, deployedContracts]);


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
      const network = await provider.getNetwork();
      console.log("Current network:", network.name, network.chainId);

      // Use network-specific factory address if necessary
      let factoryAddress = FACTORY_ADDRESS;
      console.log("Using factory address:", factoryAddress);

      const factoryContract = new ethers.Contract(factoryAddress, Factory.abi, provider);

      console.log("Fetching all deployed contracts from blockchain events");

      // Initialize contracts array
      let allContracts: string[] = [];

      // CHANGED: Always fetch contracts from events first to get ALL deployed contracts
      try {
        console.log("Fetching all contracts from deployment events");
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

      // Optionally supplement with owner-specific contracts if we missed any
      const knownOwners = [
        // No need to include hardcoded addresses as we already got all contracts from events
      ];

      // Add current user's address and requested owner address to the lookup list
      if (walletAddress && !knownOwners.includes(walletAddress)) {
        knownOwners.push(walletAddress);
      }
      if (ownerAddress && !knownOwners.includes(ownerAddress)) {
        knownOwners.push(ownerAddress);
      }

      console.log("Additional known owners:", knownOwners);

      // Check for any additional contracts that might not have appeared in events
      for (const owner of knownOwners) {
        try {
          if (owner && owner !== "") {
            const ownerContracts = await factoryContract.getContractsByOwner(owner);
            console.log(`Checking additional contracts for owner ${owner}:`, ownerContracts);

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

      console.log("Final all contracts list:", allContracts);

      // Fetch detailed data for each contract address
      const contractsData = await Promise.all(allContracts.map(async (address: string) => {
        const contract = new ethers.Contract(address, BinaryOptionMarket.abi, provider);
        let deployTimeValue = 0;
        try {

          const deployTimeBN = await contract.deployTime();
          deployTimeValue = deployTimeBN.toNumber();
          // Get basic data from contract
          const [
            positions,
            oracleDetails,
            phase,
            deployTime,
            maturityTimeBN,
            tradingPair,
            owner
          ] = await Promise.all([
            contract.positions(),
            contract.oracleDetails(),
            contract.currentPhase(),
            contract.deployed(),
            contract.maturityTime(),
            contract.tradingPair().catch(() => 'Unknown'),
            contract.owner()
          ]);

          const strikePriceBN = oracleDetails.strikePrice;

          // Handle background index separately
          let indexBgValue = 1; // Default random value
          try {
            const indexBgResult = await contract.indexBg();
            indexBgValue = indexBgResult.toNumber ? indexBgResult.toNumber() : parseInt(indexBgResult.toString());
            console.log(`Contract ${address} has indexBg: ${indexBgValue}`);
          } catch (error) {
            console.log(`Error getting indexBg for contract ${address}, using random: ${indexBgValue}`);
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

          const finalPriceBN = oracleDetails.finalPrice;

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
            deployTime: deployTimeValue,
            longAmount: ethers.utils.formatEther(positions.long),
            shortAmount: ethers.utils.formatEther(positions.short),
            strikePrice: strikePriceBN.toString(),
            phase: phase.toString(),
            maturityTime: maturityTimeValue,
            tradingPair,
            owner,
            indexBg: indexBgValue.toString(),
            finalPrice: finalPriceBN.toString() || "0"
          };
        } catch (error) {
          console.error(`Error fetching data for contract ${address}:`, error);
          return {
            address,
            deployTime: deployTimeValue,
            longAmount: '0',
            shortAmount: '0',
            strikePrice: '0',
            phase: '0',
            maturityTime: 0,
            tradingPair: 'Unknown',
            owner: '',
            indexBg: '1',
            finalPrice: '0'
          };
        }
      }));

      setDeployedContracts(contractsData);
      const imageIndexMap: { [key: string]: number } = {};
      contractsData.forEach(contract => {
        imageIndexMap[contract.address] = parseInt(contract.indexBg);
      });
      localStorage.setItem('contractImageIndices', JSON.stringify(imageIndexMap));
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

      // Fetch the updated phase for the new contract
      const fetchUpdatedPhase = async () => {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(contractAddress, BinaryOptionMarket.abi, provider);
        const phase = await contract.currentPhase();
        setCurrentPhase(Number(phase));
      };

      fetchUpdatedPhase();

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
 * Calculate position percentages for a contract
 * @param {string} longAmount - Long position amount
 * @param {string} shortAmount - Short position amount
 * @returns Object with long and short percentages
 */
  const calculatePositionPercentages = (longAmount: string, shortAmount: string) => {
    const long = parseFloat(longAmount || '0');
    const short = parseFloat(shortAmount || '0');
    const total = long + short;

    if (total > 0) {
      return {
        long: (long / total) * 100,
        short: (short / total) * 100
      };
    }

    // Default 50/50 if no amounts
    return { long: 50, short: 50 };
  };

  const [assetPrices, setAssetPrices] = useState<{ [key: string]: number }>({});

  /**
 * Handles contract selection and navigation
 * Stores contract data in localStorage and redirects to appropriate view
 * 
 * @param {string} contractAddress - Address of the selected contract
 * @param {string} owner - Owner address of the contract
 * @param {ContractData} contractData - Full contract data object
 */
  const handleAddressClick = (contractAddress: string, owner: string, contractData: ContractData) => {
    try {
      // First, clear any existing stored contract data to prevent old data persistence
      localStorage.removeItem('contractData');
      localStorage.removeItem('selectedContractAddress');

      // Convert necessary values to appropriate formats
      const longAmount = parseFloat(contractData.longAmount || '0');
      const shortAmount = parseFloat(contractData.shortAmount || '0');
      const totalAmount = longAmount + shortAmount;
      const phaseNumber = Number(contractData.phase);
      const maturityTime = Number(contractData.maturityTime);
      const finalPriceNumber = parseInt(contractData.finalPrice) / 100000000;
      const formattedFinalPrice = finalPriceNumber.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
      });

      // Store finalPrice in localStorage
      localStorage.setItem('finalPrice', formattedFinalPrice);

      // Determine if user address is the owner of this contract
      const isOwner = owner.toLowerCase() === walletAddress?.toLowerCase();

      // Get formatted strike price for immediate display
      const formattedStrikePrice = formatStrikePrice(contractData.strikePrice, contractData.tradingPair);

      // Format trading pair for chart display
      const chartSymbol = getChartSymbolFromTradingPair(contractData.tradingPair);

      // Calculate position percentages for visualization
      const positionPercentages = calculatePositionPercentages(contractData.longAmount, contractData.shortAmount);

      // Parse numeric value for direct use in chart
      const strikePriceNumber = parseInt(contractData.strikePrice) / 100000000;

      // Calculate bidding start time (for position chart)
      // Use 24 hours before maturity as default if not available
      const biddingStartTime = maturityTime - (24 * 60 * 60);

      // Calculate resolve time for maturity phase
      // In most cases, this will be updated from blockchain on load if needed
      const resolveTime = 0; // Default value, will be updated from blockchain

      const strikePriceFormatted = (parseInt(contractData.strikePrice) / 1e8).toFixed(2);
      const finalPriceFormatted = (Number(contractData.phase) >= Phase.Maturity && contractData.finalPrice)
        ? (parseInt(contractData.finalPrice) / 1e8).toFixed(2)
        : 'N/A';

      // Create initial position history data point for chart
      const initialPositionHistory = [
        {
          timestamp: biddingStartTime,
          longPercentage: 50,
          shortPercentage: 50,
          isMainPoint: false
        },
        {
          timestamp: Math.floor(Date.now() / 1000),
          longPercentage: positionPercentages.long,
          shortPercentage: positionPercentages.short,
          isCurrentPoint: true,
          isMainPoint: true
        }
      ];

      // Get current price and format for comparison to strike price
      const currentPrice = assetPrices[contractData.tradingPair] || null;
      let priceDifference = null;
      let percentageDifference = null;

      if (currentPrice && strikePriceNumber) {
        priceDifference = currentPrice - strikePriceNumber;
        percentageDifference = (priceDifference / strikePriceNumber) * 100;
      }

      // Prepare simple price chart data if real data not available yet
      const simplePriceData = [];
      if (currentPrice) {
        // Create simple chart data for immediate display
        const now = Date.now();
        for (let i = 6; i >= 0; i--) {
          const dayOffset = i * 24 * 60 * 60 * 1000;
          simplePriceData.push({
            time: now - dayOffset,
            close: currentPrice * (0.98 + Math.random() * 0.04) // Randomize within ±2%
          });
        }
      }

      // Define potential timeRemaining
      const timeRemaining = countdowns[contractAddress] || getTimeRemaining(maturityTime);

      // Format maturity time for display
      const maturityTimeFormatted = formatTimeToLocal(maturityTime);

      // Calculate final price if in maturity or expiry phase (placeholder)
      let finalPrice = null;
      if (phaseNumber === Phase.Maturity || phaseNumber === Phase.Expiry) {
        // This is a placeholder, will be updated from blockchain
        finalPrice = strikePriceNumber.toFixed(4);
      }

      // Enhance contract data with fields needed by both components
      const enhancedContractData = {
        // Base contract data
        address: contractAddress,
        owner: owner,
        isOwner: isOwner,
        timestamp: Date.now(),
        completeData: true, // Flag to indicate this data is complete for Customer.tsx
        isPreloaded: true,



        // Phase and time information
        phase: phaseNumber,
        currentPhase: phaseNumber, // Additional field for direct use
        maturityTime: maturityTime,
        maturityTimeFormatted: maturityTimeFormatted,
        timeRemaining: timeRemaining,
        biddingStartTime: biddingStartTime,
        resolveTime: resolveTime,
        deployTime: Math.floor(Date.now() / 1000) - 86400, // Default value, will be updated

        // Price-related information
        strikePrice: formattedStrikePrice, // Raw value
        strikePriceNumber: formattedStrikePrice, // Numeric value
        finalPrice: finalPriceNumber, // raw value (numeric)
        formattedFinalPrice: finalPriceFormatted, // for UI display
        formattedStrikePrice: strikePriceFormatted, // For UI display
        displayStrikePrice: formattedStrikePrice, // For UI display
        currentPrice: currentPrice,
        priceDifference: priceDifference,
        percentageDifference: percentageDifference,

        // Trading pair information
        tradingPair: contractData.tradingPair,
        chartSymbol: chartSymbol,

        // Position data
        positionData: {
          long: longAmount,
          short: shortAmount
        },
        longAmount: longAmount,
        shortAmount: shortAmount,
        totalAmount: totalAmount,
        positionPercentages: positionPercentages,
        longPercentage: positionPercentages.long,
        shortPercentage: positionPercentages.short,

        // User position data (will be updated)
        userPositions: {
          long: 0,
          short: 0
        },
        userPosition: null,

        // Chart data for immediate rendering
        initialPositionHistory: initialPositionHistory,
        simplePriceData: simplePriceData,

        // Market result
        marketResult: marketResults,

        // Contract state flags (will be updated)
        canResolve: phaseNumber === Phase.Bidding && (Date.now() / 1000) >= maturityTime,
        canExpire: phaseNumber === Phase.Maturity && resolveTime > 0 && (Date.now() / 1000) >= resolveTime + 30,

        // Visual information
        indexBg: contractImageIndices[contractAddress] ?
          contractImageIndices[contractAddress].toString() : contractData.indexBg || '1',

        // Additional fields for Customer.tsx
        totalDeposited: totalAmount.toString(),
        feePercentage: '5', // Default value, will be updated
      };

      // Store enhanced contract data in localStorage for components to use
      localStorage.setItem('contractData', JSON.stringify(enhancedContractData));
      localStorage.setItem('selectedContractAddress', contractAddress);

      // Navigate to customer view with clean URL
      router.push(`/customer/${contractAddress}`);

    } catch (error) {
      console.error("Error preparing contract data:", error);
      // Fallback to original behavior if error occurs
      localStorage.removeItem('contractData'); // Clear to be safe
      localStorage.setItem('selectedContractAddress', contractAddress);
      // Even in error case, use clean URL
      router.push(`/customer/${contractAddress}`);
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

      deployedContracts.forEach(contract => {
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
  }, [deployedContracts]);

  /**
  * Assigns fixed background image indices to contracts when the contract list changes
  * Uses indexBg from contract data if available, with fallback to default value
  */
  useEffect(() => {
    console.log("Setting contract image indices...");
    const newImageIndices: { [key: string]: number } = {};

    deployedContracts.forEach(contract => {
      if (!contract) return;

      // Read indexBg from contract and convert to number
      const bgIndex = contract.indexBg ?
        Math.min(Math.max(parseInt(contract.indexBg), 1), 10) :
        1;

      console.log(`Contract ${contract.address} using background index: ${bgIndex}`);
      newImageIndices[contract.address] = bgIndex;
    });

    setContractImageIndices(newImageIndices);
  }, [deployedContracts]);

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
   * Replaces the old useEffect for polling prices with WebSocket implementation
   * Uses Coinbase WebSocket API to get real-time price updates
   */
  useEffect(() => {
    // Define the trading pairs we want to subscribe to
    // Make sure these match the format used by Coinbase API (with hyphens)
    const tradingPairs = ['BTC-USD', 'ETH-USD', 'LINK-USD', 'SNX-USD', 'WSTETH-USD'];

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

    deployedContracts.forEach(contract => {
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
  }, [deployedContracts]);

  /**
 * Format strike price properly based on token type and size
 * Safely handles BigNumber conversion and applies proper decimal formatting
 * 
 * @param {string|BigNumber} strikePrice - Raw strike price from contract
 * @param {string} tradingPair - Trading pair (e.g. "BTC/USD")
 * @returns {string} Formatted strike price for display
 */
  const formatStrikePrice = (strikePrice: string | any, tradingPair: string): string => {
    // First convert to BigNumber safely if it isn't already
    let strikePriceBN;
    try {
      // Check if it's already a BigNumber
      if (strikePrice.toString && typeof strikePrice.toString === 'function' &&
        strikePrice._isBigNumber) {
        strikePriceBN = strikePrice;
      } else {
        strikePriceBN = ethers.BigNumber.from(strikePrice.toString());
      }
    } catch (e) {
      // Fallback to string parsing for very large numbers
      console.warn("Error converting strike price to BigNumber, using string parsing", e);

      // For very large numbers, use string operations instead
      const priceStr = strikePrice.toString();

      // Handle numbers that might be scientific notation
      if (priceStr.includes('e')) {
        return parseFloat(priceStr).toFixed(4);
      }

      // Manual decimal conversion (divide by 10^8)
      if (priceStr.length > 8) {
        const integerPart = priceStr.slice(0, priceStr.length - 8);
        const decimalPart = priceStr.slice(priceStr.length - 8);
        return `${integerPart}.${decimalPart}`;
      }

      // Small numbers
      return (parseInt(priceStr) / 10 ** 8).toFixed(8);
    }

    // Convert to decimal with proper scaling
    let decimalValue;
    try {
      // The BigNumber division approach for more precision
      const divisor = ethers.BigNumber.from(10).pow(8);
      const wholePart = strikePriceBN.div(divisor);
      const fractionalPart = strikePriceBN.mod(divisor);

      // Format fractional part to ensure leading zeros
      let fractionalStr = fractionalPart.toString().padStart(8, '0');
      // Trim trailing zeros for cleaner display
      fractionalStr = fractionalStr.replace(/0+$/, '');

      // If no fractional part, just return the whole part
      if (fractionalStr === '') {
        decimalValue = wholePart.toString();
      } else {
        decimalValue = `${wholePart.toString()}.${fractionalStr}`;
      }
    } catch (e) {
      console.warn("Error in BigNumber division, using basic division", e);
      decimalValue = (parseFloat(strikePriceBN.toString()) / 10 ** 8).toString();
    }

    // Format according to trading pair
    if (tradingPair.includes('BTC') || tradingPair.includes('ETH')) {
      return parseFloat(decimalValue).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } else {
      return parseFloat(decimalValue).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
      });
    }
  };

  const filterContractsByQuery = (query: string) => {
    const lowerCaseQuery = query.toLowerCase();
    return deployedContracts.filter(contract => {
      const title = getMarketTitleText(contract).toLowerCase();
      return title.includes(lowerCaseQuery);
    });
  };

  // Function to get market title text
  const getMarketTitleText = (contract: any): string => {
    try {
      const pair = contract.tradingPair.replace('/', '-');
      const timestamp = Number(contract.maturityTime);
      if (isNaN(timestamp) || timestamp === 0) return `${pair} Market`;

      const date = new Date(timestamp * 1000);
      const maturityTimeFormatted = format(date, 'MMM d, yyyy h:mm a');

      // Use the new formatStrikePrice function
      const strikePriceFormatted = formatStrikePrice(contract.strikePrice, contract.tradingPair);

      return `${pair} will reach $${strikePriceFormatted} by ${maturityTimeFormatted}?`;
    } catch (error) {
      console.error("Error formatting market title:", error);
      return 'Unknown Market';
    }

  };

  // Function to get market title JSX
  const getMarketTitleJSX = (contract: any): JSX.Element => {
    const text = getMarketTitleText(contract);

    const bgColors = [
      "#6EE7B7", "#FCD34D", "#FCA5A5", "#A5B4FC", "#F9A8D4",
      "#FDBA74", "#67E8F9", "#C4B5FD", "#F87171", "#34D399"
    ];
    const indexBg = contract.indexBg ?? 0;
    const bgColor = bgColors[indexBg % bgColors.length];

    const pair = contract.tradingPair.replace('/', '-');
    const pairColor = "white";

    return (
      <Text>
        <Text as="span" color={pairColor} fontWeight="semibold">{pair}</Text>{' '}
        will reach{' '}
        <Text as="span" color={bgColor} fontWeight="bold">
          ${text.split('$')[1]?.split(' ')[0]}
        </Text>{' '}
        by {text.split('by ')[1]}
      </Text>
    );
  };

  /**
     * State for storing market titles for each contract
     * Maps contract addresses to their respective titles
     */
  const [marketTitles, setMarketTitles] = useState({});

  /**
   * Fetches market titles for all deployed contracts
   * Maps contract addresses to their respective titles
   */
  useEffect(() => {
    const fetchTitles = async () => {
      const titles = {};
      for (const contract of deployedContracts) {
        titles[contract.address] = await getMarketTitleJSX(contract);
      }
      setMarketTitles(titles);
    };

    if (deployedContracts.length > 0) {
      fetchTitles();
    }
  }, [deployedContracts]);

  const getIconBySymbol = (tradingPair: string) => {
    if (tradingPair.includes("BTC")) return SiBitcoinsv;
    if (tradingPair.includes("ETH")) return FaEthereum;
    if (tradingPair.includes("LINK")) return SiChainlink;
    if (tradingPair.includes("SNX")) return SiExpertsexchange;
    if (tradingPair.includes("WSTETH")) return TbDropletHalf2Filled;
    return FaDollarSign;
  };



  return (
    <Box display="flex"
      flexDirection="column"
      minHeight="100vh"
      bg="#0A0B0E">
      {/* Application header with wallet connection status */}
      <Flex
        as="header"
        align="center"
        justify="space-between"
        p={4}
        bg="#0A0B0E"
        borderBottom="1px"
        borderColor="gray.200"
        position="sticky"
        top="0"
        zIndex="sticky"
        boxShadow="sm"
      >
        {/* Left group: Logo + Search */}
        <HStack spacing={6}>
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

          {/* Search input */}
          <Box position="relative" maxW="600px" w="100%" height="50px" display="flex" alignItems="center">
            <InputGroup ml="50px" w="500px" height="50px">
              <Input
                placeholder="Search OREKA"
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchQuery(value);
                  if (value.trim() === '') {
                    setSearchResults([]);
                  } else {
                    const results = filterContractsByQuery(value);
                    setSearchResults(results);
                  }
                }}
                bg="#1A1C21"
                color="white"
                borderColor="gray.600"
                borderRadius="3xl"
                fontSize="md"
                py={6}
                px={4}
                boxShadow="0 4px 10px rgba(0, 0, 0, 0.2)"
                _placeholder={{ color: 'gray.400' }}
                _focus={{ borderColor: 'blue.400', boxShadow: '0 0 0 2px rgba(66, 153, 225, 0.6)' }}
                _hover={{ borderColor: 'blue.300' }}
              />
              <InputRightElement
                pointerEvents="none"
                height="90%"
                pr={4}
                mr="5px"
                mt="1px"
                mb="1px"
                bg="#1A1C21"
                borderColor="gray.600"
                borderRadius="3xl"
              >
                <Icon as={FaSearch as React.ElementType} color="gray.400" />
              </InputRightElement>
            </InputGroup>

            {/* Search results */}
            {searchResults.length > 0 && (
              <Box
                position="absolute"
                top="60px"
                left="50px"
                width="500px"
                bg="gray.900"
                borderRadius="lg"
                boxShadow="xl"
                zIndex="dropdown"
                maxHeight="300px"
                overflowY="auto"
                border="1px solid"
                borderColor="gray.700"
              >
                {searchResults.slice(0, 6).map((contract) => {
                  const tradingPair = contract.tradingPair || "";
                  const address = contract.address;
                  const baseToken = tradingPair.split('/')[0]?.toLowerCase();

                  // Ensure we have a valid index even if contractImageIndices is not fully loaded yet
                  const imageIndex = contractImageIndices?.[address] || (contract.indexBg ? parseInt(contract.indexBg) : 1);

                  // Make sure we have a valid path and fallback if the specific image doesn't exist
                  const imageSrc = `/images/${baseToken}/${baseToken}${imageIndex}.png`;
                  return (
                    <Box
                      key={address}
                      display="flex"
                      alignItems="center"
                      px={4}
                      py={3}
                      _hover={{ bg: "gray.700", cursor: "pointer" }}
                      onClick={() => {
                        handleAddressClick(contract.address, contract.owner, contract);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                    >
                      <Image
                        src={`/images/${tradingPair.split('/')[0].toLowerCase()}/${tradingPair.split('/')[0].toLowerCase()}${contractImageIndices[address] || 2}.png`}
                        alt={tradingPair}
                        boxSize="32px"
                        borderRadius="full"
                        objectFit="cover"
                        position="relative"
                        mr="20px"
                        fallback={<Box h="100%" w="100%" bg="#1A202C" borderRadius="full" />}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/images/default-token.png';
                        }}
                      />

                      <Text fontSize="sm" fontWeight="medium" color="white">
                        {getMarketTitleJSX(contract)}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>

        </HStack>

        {/* Right group: Wallet info */}
        {isConnected ? (
          <HStack spacing={4}>
            <Box
              mr="10px"
              bg="#1A1C21"
              borderRadius="3xl"
              border="1px solid transparent"
              backgroundImage="linear-gradient(to right, #00B894, #00A8FF)"
              boxShadow="0 4px 10px rgba(0, 0, 0, 0.3)"
            >
              <Button
                leftIcon={GrDeploy as unknown as JSX.Element}
                variant="solid"
                color="white"
                bg="#1A1C21"
                borderRadius="3xl"
                onClick={() => router.push('/owner')}
                _hover={{
                  bg: 'rgba(0, 183, 148, 0.8)',
                  color: 'white',
                  transform: 'scale(1.05)',
                }}
                _active={{
                  transform: 'scale(0.95)',
                }}
              >
                Deploy Markets
              </Button>
            </Box>
            <Box
              p="2px"
              borderRadius="md"
              bg="transparent"
              sx={{
                backgroundImage: "linear-gradient(270deg, #ff0059, #5a73d8, #5858b5 , #77efef, #4a63c8)",
                backgroundSize: "400% 400%",
                animation: "gradient-border 8s ease infinite",
                borderRadius: "8px"
              }}
            >
              <HStack
                p={2}
                bg="#1A1C21"
                borderRadius="md"
                w="full"
              >
                <Text color="white" fontWeight="medium">
                  {parseFloat(balance).toFixed(4)} ETH
                </Text>
              </HStack>

            </Box>

            <Box
              p="2px"
              borderRadius="md"
              sx={{
                backgroundImage: "linear-gradient(270deg, #eaea72, #f49a24, #e25375, #f2f2bf, #f2f2cd)",
                backgroundSize: "400% 400%",
                animation: "gradient-border 6s ease infinite",
                display: "inline-block",
                borderRadius: "8px",
              }}
            >
              <Button
                variant="ghost"
                size="md"
                bg="#1A1C21"
                color="white"
                borderRadius="md"
                _hover={{
                  bg: "transparent",
                  transform: "scale(1.03)",
                }}
                _active={{
                  bg: "transparent"
                }}
              >
                {shortenAddress(walletAddress)}
              </Button>

            </Box>
          </HStack>
        ) : (
          <Button
            leftIcon={FaWallet as unknown as JSX.Element}
            colorScheme="white"
            size="md"
            onClick={connectWallet}
          >
            Connect Wallet
          </Button>
        )}
      </Flex>

      <Box p={6} flex="1">
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
              {['All Markets', 'Quests', 'Results', 'My Markets', 'My Holdings'].map((tab) => (
                <Button
                  key={tab}
                  size="md"
                  variant="ghost"
                  value={currentTradingPairFilter || ''}
                  onClick={() => {
                    setCurrentTab(tab)
                    setCurrentTradingPairFilter('');
                  }}
                  minW="120px"
                  fontWeight="bold"
                  fontSize="lg"
                  color={currentTab === tab ? "white" : "gray.400"}
                  transform={currentTab === tab ? "scale(1.1)" : "scale(1)"}
                  transition="all 0.2s ease-in-out"
                  _hover={{
                    color: "white",
                    transform: "scale(1.1)",
                    bg: "transparent",
                  }}
                  _active={{
                    bg: "transparent",
                  }}
                  bg="transparent"
                >
                  {tab}
                </Button>

              ))}

              <Box minW="100px">
                <Select
                  w="150px"
                  placeholder="Pair"
                  mb={0.5}
                  size="md"
                  variant="unstyled"
                  value={currentTradingPairFilter || ''}
                  onChange={(e) => {
                    setCurrentTradingPairFilter(e.target.value);
                    setCurrentTab('Pair');
                  }}
                  fontWeight="bold"
                  fontSize="lg"
                  borderRadius="lg"
                  height="40px"
                  bg="transparent"
                  transform={currentTradingPairFilter ? "scale(1.1)" : "scale(1)"}
                  transition="all 0.2s ease-in-out"
                  color={currentTradingPairFilter ? "white" : "gray.400"}
                  _hover={{
                    bg: "transparent",
                    color: "white",
                    transform: "scale(1.1)",
                  }}
                  _focus={{
                    boxShadow: "none",
                    bg: "transparent",
                  }}
                  iconColor="#EDEDEE"
                >
                  {Array.from(new Set(deployedContracts.map(c => c.tradingPair))).map(pair => (
                    <option key={pair} value={pair} style={{ padding: '8px', backgroundColor: '#0A0B0E', color: 'white' }}>
                      {pair}
                    </option>
                  ))}
                </Select>
              </Box>

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
            {paginatedContracts.map(({ address, deployTime, longAmount, shortAmount, strikePrice, finalPrice, phase, maturityTime, tradingPair, owner }, index) => (

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
                      deployTime,
                      longAmount,
                      shortAmount,
                      strikePrice,
                      finalPrice,
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
                      bg={getPhaseColor(Number(phase))}
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
                      {getPhaseName(Number(phase))}
                    </Box>
                  </Box>

                  {/* Info section in the middle - Giảm padding và margin */}
                  <Box p={3} display="flex" flexDirection="column" justifyContent="flex-start" height="100%">
                    {/* Phase indicator - Giảm margin bottom */}


                    {/* Market title */}
                    <Box
                      fontSize="xl"
                      fontWeight="semibold"
                      color="white"
                      mb={2}
                      lineHeight="1.3"
                      maxHeight="3.4em"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      display="-webkit-box"
                      style={{
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        height: '3em',
                      }}
                    >
                      {marketTitles[address] || "Loading..."}
                    </Box>
                    <HStack direction="column" w="100%" mb={4} width="100%">
                      {Number(phase) === Phase.Maturity || Number(phase) === Phase.Expiry ? (
                        <Box
                          w="100%"
                          py={2}
                          alignItems="center"
                          borderRadius="md"
                          bg={marketResults[address] === 'LONG' ? "#1B3B3F" : "#3D243A"}
                          border="1px solid"
                          borderColor="gray.600"
                          textAlign="center"
                          mt="10px"
                        >
                          <Text
                            fontSize="md"
                            fontWeight="bold"
                            color={marketResults[address] === 'LONG' ? "#20BCBB" : "#FF6492"}
                          >
                            {marketResults[address]}
                          </Text>
                        </Box>
                      ) : (
                        // Display Expired stetus when contract don't use
                        (Number(phase) === Phase.Trading && Date.now() / 1000 > Number(maturityTime)) ? (
                          <Box
                            w="100%"
                            py={2}
                            alignItems="center"
                            borderRadius="md"
                            bg="#3D3D3D"
                            border="1px solid"
                            borderColor="gray.600"
                            textAlign="center"
                            mt="10px"
                          >
                            <Text
                              fontSize="md"
                              fontWeight="bold"
                              color="#A9A9A9"
                            >
                              Expired
                            </Text>
                          </Box>
                        ) : (
                          <>
                            {/* Percentage LONG */}
                            <Flex justify="space-between" mb={1}>
                              <Text fontSize="sm" fontWeight="bold" color="#5FDCC6" textAlign="left">
                                {contractPercentages[address]?.long.toFixed(0)}%
                              </Text>
                            </Flex>

                            {/* Long/Short bar */}
                            <Flex
                              w="1000%"
                              h="13px"
                              borderRadius="full"
                              overflow="hidden"
                              border="1px solid"
                              borderColor="gray.600"
                              bg="gray.800"
                              boxShadow="inset 0 1px 3px rgba(0,0,0,0.6)"
                              mt="18px"
                              mb="20px"
                            >
                              <Box
                                h="100%"
                                w={`${contractPercentages[address]?.long}%`}
                                bgGradient="linear(to-r, #00ea00, #56ff56, #efef8b)"
                                transition="width 0.6s ease"
                              />

                              <Box
                                h="100%"
                                w={`${contractPercentages[address]?.short}%`}
                                bgGradient="linear(to-r, #FF6B81, #D5006D)"
                                transition="width 0.6s ease"
                              />
                            </Flex>

                            {/* Percentage SHORT */}
                            <Flex justify="space-between" mb={1}>
                              <Text fontSize="sm" fontWeight="bold" color="#ED5FA7" textAlign="left">
                                {contractPercentages[address]?.short.toFixed(0)}%
                              </Text>
                            </Flex>
                          </>
                        )
                      )}
                    </HStack>


                    {/* Divider */}
                    <Divider my={4} borderColor="gray.600" />

                    {/* Price and time remaining */}
                    <Flex justify="space-between" align="center">
                      <HStack spacing={2}>
                        <Icon as={getIconBySymbol(tradingPair) as React.ElementType} color="blue.300" boxSize={6} />
                        <Text fontWeight="bold" fontSize="lg" color="white">
                          {assetPrices[tradingPair]
                            ? `$${assetPrices[tradingPair].toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}`
                            : "Loading..."}
                        </Text>
                      </HStack>
                      <HStack>
                        <Icon as={FaRegClock as React.ElementType} color="gray.400" />
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
      {paginatedContracts.length > 0 && (
        <Flex
          justify="center"
          mt={8}
          bg="#0A0B0E"
          py={4}
          boxShadow="0 -2px 10px rgba(0, 0, 0, 0.5)"
        >
          <HStack spacing={4}>
            <Button
              onClick={() => router.push(`?page=${Math.max(1, page - 1)}`)}
              isDisabled={page <= 1}
              variant="outline"
              colorScheme="gray"
            >
              Previous
            </Button>
            <Text color="white" fontWeight="bold">Page {page}</Text>
            <Button
              onClick={() => router.push(`?page=${page + 1}`)}
              isDisabled={paginatedContracts.length < contractsPerPage}
              variant="outline"
              colorScheme="gray"
            >
              Next
            </Button>
          </HStack>
        </Flex>
      )}
    </Box>


  );
};

export default ListAddressOwner;