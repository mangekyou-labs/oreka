import React, { useEffect, useState } from 'react';
import {
    Box, Button, HStack, Icon, Text, VStack, SimpleGrid, Flex,
    Input, Select, Divider, Progress, Tooltip, Spacer, Image,
    Spinner, InputGroup, InputRightElement
} from '@chakra-ui/react';
import {
    FaCalendarDay, FaPlayCircle, FaClock, FaCheckCircle,
    FaListAlt, FaRegClock, FaEthereum, FaWallet, FaTrophy,
    FaArrowUp, FaArrowDown, FaCoins, FaSearch
} from 'react-icons/fa';
import { IoWalletOutline } from "react-icons/io5";
import { SiBitcoinsv } from "react-icons/si";
import { GoInfinity } from "react-icons/go";
import { useToast } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { format, formatDistanceToNow } from 'date-fns';
import { BinaryOptionMarketService } from '../service/binary-option-market-service';
import { getCurrentTimestamp, isTimestampPassed, getTimeRemaining } from '../utils/timeUtils';
import { AuthClient } from '@dfinity/auth-client';
import { Principal } from '@dfinity/principal';

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
    indexBg?: string;
    currentPrice?: number;
}

enum Phase { Trading, Bidding, Maturity, Expiry }

// Function to get color for phase
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

// Function to get name for phase
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

// Format maturity time
const formatMaturityTime = (maturityTime: any) => {
    try {
        if (!maturityTime) return "Unknown";

        // Check if we have a large timestamp (nanoseconds/microseconds)
        let timestamp = Number(maturityTime);
        if (isNaN(timestamp)) return "Unknown";

        // Convert to milliseconds if needed
        if (timestamp > 1e15) { // Likely nanoseconds
            timestamp = Math.floor(timestamp / 1e6); // Convert nanoseconds to milliseconds
        } else if (timestamp > 1e12) { // Likely microseconds
            timestamp = Math.floor(timestamp / 1e3); // Convert microseconds to milliseconds
        } else if (timestamp < 1e10) { // Likely seconds
            timestamp = timestamp * 1000; // Convert seconds to milliseconds
        }

        // Validate range
        if (timestamp <= 0) return "Unknown";
        const year = new Date(timestamp).getFullYear();
        if (year < 2020 || year > 2050) return "Invalid date";

        return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
    } catch (error) {
        console.error("Error formatting maturity time:", error);
        return "Unknown";
    }
};

// Check if market has ended
const isMarketEnded = (maturityTime: any, phase: number): boolean => {
    try {
        if (!maturityTime) return false;

        // Check if we have a large timestamp (nanoseconds/microseconds)
        let timestamp = Number(maturityTime);
        if (isNaN(timestamp)) return false;

        // Convert to milliseconds if needed
        if (timestamp > 1e15) { // Likely nanoseconds
            timestamp = Math.floor(timestamp / 1e6); // Convert nanoseconds to milliseconds
        } else if (timestamp > 1e12) { // Likely microseconds
            timestamp = Math.floor(timestamp / 1e3); // Convert microseconds to milliseconds
        } else if (timestamp < 1e10) { // Likely seconds
            timestamp = timestamp * 1000; // Convert seconds to milliseconds
        }

        // Validate range
        if (timestamp <= 0) return false;
        const year = new Date(timestamp).getFullYear();
        if (year < 2020 || year > 2050) return false;

        const maturityDate = new Date(timestamp);
        const currentTime = new Date();
        return currentTime.getTime() > maturityDate.getTime();
    } catch (error) {
        console.error("Error checking if market ended:", error);
        return false;
    }
};

// Format time remaining
const formatTimeRemaining = (maturityTime: any) => {
    try {
        if (!maturityTime) return "Unknown";

        // Check if we have a large timestamp (nanoseconds/microseconds)
        let timestamp = Number(maturityTime);
        if (isNaN(timestamp)) return "Unknown";

        // Convert to milliseconds if needed
        if (timestamp > 1e15) { // Likely nanoseconds
            timestamp = Math.floor(timestamp / 1e6); // Convert nanoseconds to milliseconds
        } else if (timestamp > 1e12) { // Likely microseconds
            timestamp = Math.floor(timestamp / 1e3); // Convert microseconds to milliseconds
        } else if (timestamp < 1e10) { // Likely seconds
            timestamp = timestamp * 1000; // Convert seconds to milliseconds
        }

        // Validate range
        if (timestamp <= 0) return "Unknown";
        const year = new Date(timestamp).getFullYear();
        if (year < 2020 || year > 2050) return "Invalid date";

        const maturityDate = new Date(timestamp);
        const currentTime = new Date();
        if (currentTime > maturityDate) {
            return "Ended";
        }

        // Safely format the date with error handling
        try {
            return formatDistanceToNow(maturityDate, { addSuffix: true });
        } catch (formatError) {
            console.warn(`Could not format date: ${timestamp}`, formatError);
            return "Unknown";
        }
    } catch (error) {
        console.error("Error formatting time remaining:", error);
        return "Unknown";
    }
};

// Get market title
const getMarketTitle = (contract: ContractData) => {
    try {
        // Format trading pair
        const pair = contract.tradingPair?.replace('/', '-') || 'Unknown';

        // Handle the timestamp - check for different time formats
        let timestamp = Number(contract.maturityTime);
        if (isNaN(timestamp) || timestamp <= 0) return `${pair} Market`;

        // Convert to milliseconds if needed
        if (timestamp > 1e15) { // Likely nanoseconds
            timestamp = Math.floor(timestamp / 1e6); // Convert nanoseconds to milliseconds
            console.log(`Converting large timestamp ${contract.maturityTime} to milliseconds: ${timestamp}`);
        } else if (timestamp > 1e12) { // Likely microseconds
            timestamp = Math.floor(timestamp / 1e3); // Convert microseconds to milliseconds
        } else if (timestamp < 1e10) { // Likely seconds
            timestamp = timestamp * 1000; // Convert seconds to milliseconds
        }

        // Validate timestamp is within reasonable range
        const year = new Date(timestamp).getFullYear();
        if (year < 2020 || year > 2050) {
            console.warn(`Timestamp out of reasonable range: ${timestamp}, year: ${year}`);
            return `${pair} Market`;
        }

        // Safely format the date
        let maturityTimeFormatted;
        try {
            maturityTimeFormatted = format(new Date(timestamp), 'MMM d, yyyy h:mm a');
        } catch (formatError) {
            console.warn(`Could not format maturity date: ${timestamp}`, formatError);
            return `${pair} Market`;
        }

        // Format strike price with appropriate precision based on trading pair
        let precision = 2;
        if (pair.includes('BTC')) precision = 0;
        if (pair.includes('ETH')) precision = 0;
        if (pair.includes('ICP')) precision = 2;

        const strikePriceVal = parseFloat(contract.strikePrice);
        if (isNaN(strikePriceVal)) return `${pair} Market`;

        const strikePriceFormatted = strikePriceVal.toLocaleString('en-US', {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision
        });

        return `${pair} will reach $${strikePriceFormatted} by ${maturityTimeFormatted} ?`;
    } catch (error) {
        console.error("Error getting market title:", error);
        return "Unknown Market";
    }
};

// Clean up market titles
const cleanupMarketTitle = (title: string) => {
    // Remove any string within parentheses containing timestamp references
    return title.replace(/\([^)]*Sat[^)]*\)/g, '').trim();
};

// Shorten address for display
const shortenAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// New function to determine market result
const determineMarketResult = (longAmount: number, shortAmount: number): string => {
    if (longAmount > shortAmount) {
        return 'LONG';
    } else if (shortAmount > longAmount) {
        return 'SHORT';
    } else {
        return 'TIE';
    }
};

function ListAddressOwner({ ownerAddress, page }: ListAddressOwnerProps) {
    const [contracts, setContracts] = useState<ContractData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalContracts, setTotalContracts] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [identityPrincipal, setIdentityPrincipal] = useState("");
    const [marketService, setMarketService] = useState<BinaryOptionMarketService | null>(null);
    const [currentTab, setCurrentTab] = useState<string>('All Markets');
    const [contractPercentages, setContractPercentages] = useState<{ [key: string]: { long: number, short: number } }>({});
    const [contractImageIndices, setContractImageIndices] = useState<{ [key: string]: number }>({});
    const [countdowns, setCountdowns] = useState<{ [key: string]: string }>({});
    const [balance, setBalance] = useState("0");
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ContractData[]>([]);

    const CONTRACTS_PER_PAGE = 10;
    const router = useRouter();
    const toast = useToast();

    useEffect(() => {
        initIdentity();
    }, []);

    useEffect(() => {
        if (marketService) {
            fetchContracts();
        }
    }, [marketService, currentTab, page]);

    // Initialize identity and market service
    const initIdentity = async () => {
        try {
            setIsLoading(true);
            const authClient = await AuthClient.create();
            const isAuthenticated = await authClient.isAuthenticated();

            if (isAuthenticated) {
                const identity = authClient.getIdentity();
                setIdentityPrincipal(identity.getPrincipal().toText());
                const service = BinaryOptionMarketService.getInstance();
                await service.initialize();
                setMarketService(service);

                // Also initialize ICP ledger service for balance
                try {
                    const { IcpLedgerService } = await import('../service/icp-ledger-service');
                    const { setIcpLedgerIdentity } = await import('../service/actor-locator');

                    await setIcpLedgerIdentity(identity);
                    const ledgerService = IcpLedgerService.getInstance();
                    await ledgerService.initialize();

                    // Get balance
                    const userBalance = await ledgerService.getBalance({
                        owner: identity.getPrincipal(),
                        subaccount: []
                    });
                    setBalance((Number(userBalance) / 10e7).toFixed(4));
                } catch (balanceError) {
                    console.error("Error fetching balance:", balanceError);
                    // Don't set error state for balance issues
                }
            } else {
                // Don't treat authentication failure as an error
                // Just set identity principal to empty and continue
                setIdentityPrincipal("");
                console.log("User is not authenticated");
            }
        } catch (error) {
            console.error("Error initializing identity:", error);
            setError("Failed to initialize. Please try again.");
        } finally {
            // Always set loading to false regardless of outcome
            setIsLoading(false);
        }
    };

    // Get the actual trading pair from a market canister
    const getMarketTradingPair = async (marketId: string): Promise<string> => {
        try {
            console.log(`Getting trading pair for market ${marketId}`);

            // Import dynamically to avoid circular dependencies
            const { idlFactory } = await import("../declarations/binary_option_market/binary_option_market.did.js");
            const { getActor } = await import("../service/actor-locator");

            // Get an actor for this specific market canister
            const marketActor = await getActor(idlFactory, marketId);

            try {
                // Call the getTradingPair function directly
                const tradingPair = await marketActor.getTradingPair() as string;
                console.log(`Market ${marketId} trading pair: ${tradingPair}`);

                // Convert from ICP-USD format to ICP/USD format if needed
                return tradingPair.replace('-', '/');
            } catch (error) {
                console.error(`Error calling getTradingPair for market ${marketId}:`, error);

                // Fallback: try to get trading pair from market details as it might be included there
                try {
                    const details = await marketActor.getMarketDetails() as any;
                    if (details && details.tradingPair) {
                        const tradingPair = details.tradingPair as string;
                        console.log(`Got trading pair from market details: ${tradingPair}`);
                        return tradingPair.replace('-', '/');
                    }
                } catch (detailsError) {
                    console.error(`Error getting market details: ${detailsError}`);
                }

                return 'ICP/USD'; // Default fallback if both methods fail
            }
        } catch (error) {
            console.error(`Error getting trading pair for market ${marketId}:`, error);
            return 'ICP/USD'; // Default fallback
        }
    };

    // Get the actual strike price from a market canister
    const getMarketStrikePrice = async (marketId: string): Promise<string> => {
        try {
            console.log(`Getting strike price for market ${marketId}`);

            // Import dynamically to avoid circular dependencies
            const { idlFactory } = await import("../declarations/binary_option_market/binary_option_market.did.js");
            const { getActor } = await import("../service/actor-locator");

            // Get an actor for this specific market canister
            const marketActor = await getActor(idlFactory, marketId);

            // Get market details from the canister directly
            if ('getMarketDetails' in marketActor) {
                const details = await marketActor.getMarketDetails() as any;

                if (details && details.oracleDetails && details.oracleDetails.strikePrice) {
                    const strikePrice = Number(details.oracleDetails.strikePrice);
                    console.log(`Market ${marketId} strike price: ${strikePrice}`);
                    return strikePrice.toString();
                }
            }

            console.log(`Could not get strike price for market ${marketId}, using fallback`);
            return '0'; // Default fallback
        } catch (error) {
            console.error(`Error getting strike price for market ${marketId}:`, error);
            return '0'; // Default fallback
        }
    };

    // Get the actual maturity time from a market canister
    const getMarketMaturityTime = async (marketId: string): Promise<string> => {
        try {
            console.log(`Getting maturity time for market ${marketId}`);

            // Import dynamically to avoid circular dependencies
            const { idlFactory } = await import("../declarations/binary_option_market/binary_option_market.did.js");
            const { getActor } = await import("../service/actor-locator");

            // Get an actor for this specific market canister
            const marketActor = await getActor(idlFactory, marketId);

            // Get the maturity time from the canister directly
            if ('getEndTimestamp' in marketActor) {
                const timestamp = await marketActor.getEndTimestamp() as bigint;
                console.log(`Market ${marketId} maturity time: ${timestamp.toString()}`);
                return timestamp.toString();
            }

            console.log(`Could not get maturity time for market ${marketId}, using fallback`);
            return '0'; // Default fallback
        } catch (error) {
            console.error(`Error getting maturity time for market ${marketId}:`, error);
            return '0'; // Default fallback
        }
    };

    // Fetch contract list
    const fetchContracts = async () => {
        try {
            setIsLoading(true);
            setError(null);

            if (!marketService) {
                setError("Market service not initialized");
                setIsLoading(false);
                return;
            }

            console.log("Fetching all markets via BinaryOptionMarketService...");
            // Get all markets from the market service
            const allMarkets = await marketService.getAllMarkets();
            console.log(`Got ${allMarkets ? allMarkets.length : 0} markets from market service:`, allMarkets);

            if (!allMarkets || allMarkets.length === 0) {
                console.log("No markets found, setting empty contracts list");
                setContracts([]);
                setTotalContracts(0);
                setTotalPages(1);
                setIsLoading(false);
                return;
            }

            // Calculate pagination
            const startIdx = (page - 1) * CONTRACTS_PER_PAGE;
            const endIdx = startIdx + CONTRACTS_PER_PAGE;
            const paginatedMarkets = allMarkets.slice(startIdx, endIdx);
            console.log(`Showing markets ${startIdx + 1}-${Math.min(endIdx, allMarkets.length)} of ${allMarkets.length}`);

            // Transform market data
            console.log("Fetching details for each market in the current page");
            const contractDataPromises = paginatedMarkets.map(async (marketId: string, index) => {
                console.log(`Fetching details for market ID: ${marketId}`);
                const marketDetails = await marketService.getMarketDetails(marketId);
                console.log(`Market details for ${marketId}:`, marketDetails);

                // Get actual trading pair from the market canister
                const tradingPair = await getMarketTradingPair(marketId);

                // Get actual strike price from the market canister
                const strikePrice = await getMarketStrikePrice(marketId);

                // Get actual maturity time from the market canister
                const maturityTime = await getMarketMaturityTime(marketId);

                // Parse phase
                let phase = Phase.Trading;
                if (marketDetails.currentPhase && 'Trading' in marketDetails.currentPhase) {
                    phase = Phase.Trading;
                } else if (marketDetails.currentPhase && 'Bidding' in marketDetails.currentPhase) {
                    phase = Phase.Bidding;
                } else if (marketDetails.currentPhase && 'Maturity' in marketDetails.currentPhase) {
                    phase = Phase.Maturity;
                } else if (marketDetails.currentPhase && 'Expiry' in marketDetails.currentPhase) {
                    phase = Phase.Expiry;
                }

                // Get current price for trading pair if available
                let currentPrice;
                try {
                    if (marketService && tradingPair) {
                        currentPrice = await marketService.getPrice(tradingPair);
                        console.log(`Current price for ${tradingPair}: ${currentPrice}`);
                    }
                } catch (error) {
                    console.error(`Error getting price for ${tradingPair}:`, error);
                }

                // Format data for UI with price included
                const contractData: ContractData = {
                    address: marketId,
                    createDate: marketDetails.createTimestamp ? new Date(Number(marketDetails.createTimestamp) * 1000).toISOString() : '',
                    longAmount: marketDetails.positions ? (Number(marketDetails.positions.long) / 10e7).toString() : '0',
                    shortAmount: marketDetails.positions ? (Number(marketDetails.positions.short) / 10e7).toString() : '0',
                    strikePrice, // Use the actual strike price from the market canister
                    phase: phase,
                    maturityTime, // Use the actual maturity time from the market canister
                    tradingPair,
                    owner: marketDetails.owner ? marketDetails.owner.toString() : '',
                    indexBg: (index % 5 + 1).toString(), // Assign a random image index (1-5)
                    currentPrice: currentPrice
                };

                console.log(`Formatted contract data for ${marketId}:`, contractData);
                return contractData;
            });

            try {
                const contractDataList: ContractData[] = await Promise.all(contractDataPromises);
                console.log("All market details fetched successfully:", contractDataList);

                // Filter contracts based on current tab
                const filteredContractList = contractDataList.filter((contract: ContractData) => {
                    if (currentTab === 'All Markets') return true;
                    if (currentTab === 'Most recent') return true; // Will be sorted later
                    if (currentTab === 'Quests') return contract.phase === Phase.Trading || contract.phase === Phase.Bidding;
                    if (currentTab === 'Results') return contract.phase === Phase.Maturity || contract.phase === Phase.Expiry;
                    return contract.tradingPair === currentTab; // Filter by trading pair
                });

                // Sort by creation date if "Most recent" tab
                if (currentTab === 'Most recent') {
                    filteredContractList.sort((a: ContractData, b: ContractData) => {
                        return new Date(b.createDate).getTime() - new Date(a.createDate).getTime();
                    });
                }

                console.log(`Setting ${filteredContractList.length} contracts after filtering by tab '${currentTab}'`);
                setContracts(filteredContractList);
                setTotalContracts(allMarkets.length);
                setTotalPages(Math.ceil(allMarkets.length / CONTRACTS_PER_PAGE));

                // Calculate percentages for each contract
                const newPercentages: { [key: string]: { long: number, short: number } } = {};
                filteredContractList.forEach((contract: ContractData) => {
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

                // Set image indices for contracts
                const newImageIndices: { [key: string]: number } = {};
                filteredContractList.forEach((contract: ContractData) => {
                    const bgIndex = contract.indexBg ? parseInt(contract.indexBg) : 1;
                    newImageIndices[contract.address] = bgIndex;
                });
                setContractImageIndices(newImageIndices);

                // Start countdown timers
                updateCountdowns(filteredContractList);
            } catch (detailsError) {
                console.error("Error processing market details:", detailsError);
                setError("Failed to process market details. Please try again.");
            }

            setIsLoading(false);
        } catch (error) {
            console.error("Error fetching contracts:", error);
            setError("Failed to fetch markets. Please try again.");
            setIsLoading(false);
        }
    };

    // Update countdowns for all contracts
    const updateCountdowns = (contracts: ContractData[]) => {
        const newCountdowns: { [key: string]: string } = {};

        contracts.forEach(contract => {
            try {
                let timestamp = Number(contract.maturityTime);
                if (isNaN(timestamp)) {
                    newCountdowns[contract.address] = "Unknown";
                    return;
                }

                // Convert to milliseconds if needed
                if (timestamp > 1e15) { // Likely nanoseconds
                    timestamp = Math.floor(timestamp / 1e6); // Convert nanoseconds to milliseconds
                } else if (timestamp > 1e12) { // Likely microseconds
                    timestamp = Math.floor(timestamp / 1e3); // Convert microseconds to milliseconds
                } else if (timestamp < 1e10) { // Likely seconds
                    timestamp = timestamp * 1000; // Convert seconds to milliseconds
                }

                if (timestamp <= 0) {
                    newCountdowns[contract.address] = "Unknown";
                    return;
                }

                // Validate timestamp is within reasonable range
                const year = new Date(timestamp).getFullYear();
                if (year < 2020 || year > 2050) {
                    newCountdowns[contract.address] = "Invalid date";
                } else {
                    // Check if time has passed
                    const maturityDate = new Date(timestamp);
                    const currentTime = new Date();
                    if (currentTime > maturityDate) {
                        newCountdowns[contract.address] = "Ended";
                    } else {
                        try {
                            newCountdowns[contract.address] = formatDistanceToNow(maturityDate, { addSuffix: true });
                        } catch (formatError) {
                            console.warn(`Error formatting countdown: ${formatError}`);
                            newCountdowns[contract.address] = "Unknown";
                        }
                    }
                }
            } catch (error) {
                console.warn(`Error setting countdown for contract ${contract.address}:`, error);
                newCountdowns[contract.address] = "Unknown";
            }
        });

        setCountdowns(newCountdowns);

        // Set interval to update countdowns every second
        const intervalId = setInterval(() => {
            const updatedCountdowns: { [key: string]: string } = {};

            contracts.forEach(contract => {
                try {
                    let timestamp = Number(contract.maturityTime);
                    if (isNaN(timestamp)) {
                        updatedCountdowns[contract.address] = "Unknown";
                        return;
                    }

                    // Convert to milliseconds if needed
                    if (timestamp > 1e15) { // Likely nanoseconds
                        timestamp = Math.floor(timestamp / 1e6); // Convert nanoseconds to milliseconds
                    } else if (timestamp > 1e12) { // Likely microseconds
                        timestamp = Math.floor(timestamp / 1e3); // Convert microseconds to milliseconds
                    } else if (timestamp < 1e10) { // Likely seconds
                        timestamp = timestamp * 1000; // Convert seconds to milliseconds
                    }

                    if (timestamp <= 0) {
                        updatedCountdowns[contract.address] = "Unknown";
                        return;
                    }

                    // Validate timestamp is within reasonable range
                    const year = new Date(timestamp).getFullYear();
                    if (year < 2020 || year > 2050) {
                        updatedCountdowns[contract.address] = "Invalid date";
                    } else {
                        // Check if time has passed
                        const maturityDate = new Date(timestamp);
                        const currentTime = new Date();
                        if (currentTime > maturityDate) {
                            updatedCountdowns[contract.address] = "Ended";
                        } else {
                            try {
                                updatedCountdowns[contract.address] = formatDistanceToNow(maturityDate, { addSuffix: true });
                            } catch (formatError) {
                                console.warn(`Error formatting countdown: ${formatError}`);
                                updatedCountdowns[contract.address] = "Unknown";
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`Error updating countdown for contract ${contract.address}:`, error);
                    updatedCountdowns[contract.address] = "Unknown";
                }
            });

            setCountdowns(updatedCountdowns);
        }, 1000);

        return () => clearInterval(intervalId);
    };

    // Navigate to contract details
    const handleContractClick = (contractAddress: string) => {
        router.push(`/customer/${contractAddress}`);
    };

    // Handle pagination
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            // Get the current route (either 'markets' or 'listaddress')
            const currentRoute = router.pathname.includes('/markets') ? 'markets' : 'listaddress';
            router.push(`/${currentRoute}/${newPage}`);
        }
    };

    // Get trading pair icon
    const getTradingPairIcon = (tradingPair: string) => {
        if (tradingPair.includes('BTC')) return SiBitcoinsv;
        if (tradingPair.includes('ETH')) return FaEthereum;
        return GoInfinity; // Default for ICP and others
    };

    // Add search functionality
    const filterContractsByQuery = (query: string) => {
        const lowerCaseQuery = query.toLowerCase();
        return contracts.filter(contract => {
            const title = getMarketTitle(contract).toLowerCase();
            return title.includes(lowerCaseQuery);
        });
    };

    return (
        <Box bg="#0A0B0E" minH="100vh">
            {/* Application header with search and wallet info */}
            <Flex
                as="header"
                justify="space-between"
                align="center"
                px={6}
                py={4}
                height="80px"
                bg="#0A0B0E"
                borderBottom="1px"
                borderColor="gray.700"
                position="sticky"
                top="0"
                zIndex="sticky"
                boxShadow="sm"
            >
                {/* Left group: Logo */}
                <HStack spacing={6}>
                    <Box display="flex" alignItems="center">
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
                    </Box>
                </HStack>

                {/* Center: Search */}
                <Box position="relative" maxW="600px" w="100%" height="50px" display="flex" alignItems="center">
                    <Box position="relative" w="500px" height="50px">
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
                            paddingRight="40px"
                            boxShadow="0 4px 10px rgba(0, 0, 0, 0.2)"
                            _placeholder={{ color: 'gray.400' }}
                            _focus={{ borderColor: 'yellow.400', boxShadow: '0 0 0 2px rgba(254, 223, 86, 0.6)' }}
                            _hover={{ borderColor: 'yellow.300' }}
                            height="50px"
                            width="100%"
                        />
                        <Box
                            position="absolute"
                            right="16px"
                            top="50%"
                            transform="translateY(-50%)"
                            pointerEvents="none"
                        >
                            <Icon as={FaSearch} color="gray.400" />
                        </Box>
                    </Box>

                    {/* Search results */}
                    {searchResults.length > 0 && (
                        <Box
                            position="absolute"
                            top="60px"
                            left="0"
                            width="100%"
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
                                const imageIndex = contractImageIndices?.[address] || 1;
                                const imagePath = `/images/${baseToken}/${baseToken}${imageIndex.toString()}.png`;

                                return (
                                    <Box
                                        key={address}
                                        display="flex"
                                        alignItems="center"
                                        px={4}
                                        py={3}
                                        _hover={{ bg: "gray.700", cursor: "pointer" }}
                                        onClick={() => {
                                            handleContractClick(contract.address);
                                            setSearchQuery('');
                                            setSearchResults([]);
                                        }}
                                    >
                                        <Image
                                            src={imagePath}
                                            alt="token"
                                            boxSize="32px"
                                            borderRadius="full"
                                            mr={4}
                                            fallbackSrc="/images/default-token.png"
                                        />
                                        <Text fontSize="sm" fontWeight="medium" color="white">
                                            {cleanupMarketTitle(getMarketTitle(contract))}
                                        </Text>
                                    </Box>
                                );
                            })}
                        </Box>
                    )}
                </Box>

                {/* Right group: Deploy Markets + Wallet info */}
                <HStack spacing={6}>
                    <Box
                        mr="10px"
                        borderRadius="md"
                        overflow="hidden"
                    >
                        <Button
                            variant="solid"
                            color="white"
                            bgGradient="linear(to-r, #3182CE, #63B3ED)"
                            borderRadius="md"
                            onClick={() => router.push('/factory')}
                            _hover={{
                                bgGradient: "linear(to-r, #2B6CB0, #4299E1)",
                                transform: 'scale(1.05)',
                            }}
                            _active={{
                                transform: 'scale(0.95)',
                            }}
                            boxShadow="0 4px 8px rgba(0, 0, 0, 0.2)"
                            transition="all 0.2s"
                            px={5}
                            py={2}
                            h="40px"
                        >
                            Deploy Markets
                        </Button>
                    </Box>
                    <HStack
                        p={2}
                        bg="#1A1C21"
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor="gray.700"
                    >
                        <Icon as={GoInfinity} color="#63B3ED" />
                        <Text color="#63B3ED" fontWeight="medium">
                            {parseFloat(balance).toFixed(4)} ICP
                        </Text>
                    </HStack>
                    <Button
                        leftIcon={<FaWallet />}
                        colorScheme="blue"
                        variant="outline"
                        size="md"
                    >
                        {shortenAddress(identityPrincipal)}
                    </Button>
                </HStack>
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
                                backgroundColor: 'rgba(100,149,237,0.2)',
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
                                                                <GoInfinity />
                                    }
                                    color={currentTab === tab ? "white" : "gray.300"}
                                    bgImage={currentTab === tab ? "linear-gradient(135deg, #3182CE, #63B3ED)" : "none"}
                                    backgroundColor={currentTab === tab ? "transparent" : "transparent"}
                                    _hover={{
                                        bgImage: currentTab === tab ? "linear-gradient(135deg, #3182CE, #63B3ED)" : "none",
                                        backgroundColor: currentTab === tab ? "transparent" : "rgba(99,179,237,0.1)",
                                        color: currentTab === tab ? "white" : "gray.300"
                                    }}
                                    borderRadius="md"
                                    boxShadow={currentTab === tab ? "md" : "none"}
                                    transition="all 0.2s"
                                >
                                    {tab}
                                </Button>
                            ))}
                        </HStack>
                    </Flex>
                </Box>

                {isLoading ? (
                    <Flex justify="center" align="center" h="300px">
                        <Spinner size="xl" color="#FEDF56" />
                    </Flex>
                ) : error ? (
                    <Box textAlign="center" p={8} borderWidth={1} borderRadius="lg" borderColor="gray.700" bg="gray.900">
                        <Text color="red.400">{error}</Text>
                        <Button mt={4} onClick={fetchContracts} colorScheme="yellow">Retry</Button>
                    </Box>
                ) : contracts.length > 0 ? (
                    <SimpleGrid
                        columns={{ base: 1, md: 2, lg: 3, xl: 4 }}
                        spacing={4}
                        width="100%"
                    >
                        {contracts.map((contract, index) => (
                            <Box
                                key={contract.address}
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
                                    onClick={() => handleContractClick(contract.address)}
                                >
                                    {/* Image section */}
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
                                            src={`/images/${contract.tradingPair.split('/')[0].toLowerCase()}/${contract.tradingPair.split('/')[0].toLowerCase()}${contractImageIndices[contract.address] || 1}.png`}
                                            alt={contract.tradingPair}
                                            w="100%"
                                            h="100%"
                                            objectFit="cover"
                                            position="relative"
                                            fallback={
                                                <Box
                                                    h="100%"
                                                    w="100%"
                                                    bg="#1A202C"
                                                    display="flex"
                                                    alignItems="center"
                                                    justifyContent="center"
                                                >
                                                    <Icon
                                                        as={getTradingPairIcon(contract.tradingPair)}
                                                        boxSize="50px"
                                                        color="blue.300"
                                                    />
                                                </Box>
                                            }
                                        />
                                        <Box
                                            display="inline-block"
                                            bg={getPhaseColor(contract.phase)}
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
                                            {getPhaseName(contract.phase)}
                                        </Box>
                                    </Box>

                                    {/* Info section */}
                                    <Box p={3}>
                                        {/* Market title */}
                                        <Text fontWeight="bold" mb={3} color="white" fontSize="xl">
                                            {cleanupMarketTitle(getMarketTitle(contract))}
                                        </Text>

                                        {/* LONG/SHORT ratio or Result display */}
                                        {(contract.phase === Phase.Maturity || contract.phase === Phase.Expiry) ? (
                                            <Box
                                                w="100%"
                                                py={2}
                                                alignItems="center"
                                                borderRadius="md"
                                                bg={determineMarketResult(parseFloat(contract.longAmount), parseFloat(contract.shortAmount)) === 'LONG' ? "#1B3B3F" : "#3D243A"}
                                                border="1px solid"
                                                borderColor="gray.600"
                                                textAlign="center"
                                                mb={4}
                                            >
                                                <Text
                                                    fontSize="md"
                                                    fontWeight="bold"
                                                    color={determineMarketResult(parseFloat(contract.longAmount), parseFloat(contract.shortAmount)) === 'LONG' ? "#20BCBB" : "#FF6492"}
                                                >
                                                    {determineMarketResult(parseFloat(contract.longAmount), parseFloat(contract.shortAmount))}
                                                </Text>
                                            </Box>
                                        ) : (
                                            <Flex
                                                align="center"
                                                w="100%"
                                                h="25px"
                                                borderRadius="full"
                                                overflow="hidden"
                                                border="1px solid"
                                                borderColor="gray.600"
                                                bg="gray.800"
                                                boxShadow="inset 0 1px 3px rgba(0,0,0,0.6)"
                                                mb={4}
                                            >
                                                {/* LONG Section */}
                                                <Box
                                                    h="100%"
                                                    w={`${contractPercentages[contract.address]?.long}%`}
                                                    bgGradient="linear(to-r, #00ea00, #56ff56, #efef8b)"
                                                    transition="width 0.6s ease"
                                                    display="flex"
                                                    alignItems="center"
                                                    justifyContent="flex-end"
                                                    pr={3}
                                                    position="relative"
                                                    zIndex={1}
                                                >
                                                    {contractPercentages[contract.address]?.long > 8 && (
                                                        <Text
                                                            fontSize="sm"
                                                            fontWeight="bold"
                                                            color="blackAlpha.800"
                                                        >
                                                            {contractPercentages[contract.address]?.long.toFixed(0)}%
                                                        </Text>
                                                    )}
                                                </Box>

                                                {/* SHORT Section */}
                                                <Box
                                                    h="100%"
                                                    w={`${contractPercentages[contract.address]?.short}%`}
                                                    bgGradient="linear(to-r, #FF6B81, #D5006D)"
                                                    transition="width 0.6s ease"
                                                    display="flex"
                                                    alignItems="center"
                                                    justifyContent="flex-start"
                                                    pl={3}
                                                    zIndex={0}
                                                >
                                                    {contractPercentages[contract.address]?.short > 8 && (
                                                        <Text
                                                            fontSize="sm"
                                                            fontWeight="bold"
                                                            color="whiteAlpha.800"
                                                        >
                                                            {contractPercentages[contract.address]?.short.toFixed(0)}%
                                                        </Text>
                                                    )}
                                                </Box>
                                            </Flex>
                                        )}

                                        {/* LONG/SHORT buttons */}
                                        <Flex justify="space-between" align="center" mb={2}>
                                            <Box>
                                                <Button fontSize="sm"
                                                    color="#1E4146"
                                                    textAlign="right"
                                                    w="120px"
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
                                                >
                                                    LONG
                                                </Button>
                                            </Box>
                                            <Box>
                                                <Button fontSize="sm"
                                                    color="#3D243A"
                                                    textAlign="right"
                                                    w="120px"
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
                                                >
                                                    SHORT
                                                </Button>
                                            </Box>
                                        </Flex>

                                        <Divider my={4} borderColor="gray.600" />

                                        <Flex justify="space-between" align="center">
                                            <HStack spacing={2}>
                                                <Icon
                                                    as={getTradingPairIcon(contract.tradingPair)}
                                                    color="blue.300"
                                                    boxSize={6}
                                                />
                                                <Text fontWeight="bold" fontSize="lg" color="white">
                                                    {contract.currentPrice
                                                        ? `$${contract.currentPrice.toLocaleString(undefined, {
                                                            maximumFractionDigits: 2,
                                                        })}`
                                                        : `$${parseFloat(contract.strikePrice).toLocaleString(undefined, {
                                                            maximumFractionDigits: 2,
                                                        })}`}
                                                </Text>
                                            </HStack>
                                            <HStack>
                                                <Icon as={FaRegClock} color="gray.400" />
                                                <Text fontSize="sm" color="gray.400" textAlign="right">
                                                    {countdowns[contract.address] || formatTimeRemaining(contract.maturityTime)}
                                                </Text>
                                            </HStack>
                                        </Flex>
                                    </Box>
                                </Box>
                            </Box>
                        ))}
                    </SimpleGrid>
                ) : (
                    <Box textAlign="center" p={8} borderWidth={1} borderRadius="lg" borderColor="gray.700" bg="gray.900">
                        <Text color="gray.400">No markets found</Text>
                    </Box>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <Flex justifyContent="center" mt={6}>
                        <HStack>
                            <Button
                                isDisabled={page <= 1}
                                onClick={() => handlePageChange(page - 1)}
                                colorScheme="yellow"
                                variant="outline"
                            >
                                Previous
                            </Button>
                            <Text color="white">Page {page} of {totalPages}</Text>
                            <Button
                                isDisabled={page >= totalPages}
                                onClick={() => handlePageChange(page + 1)}
                                colorScheme="yellow"
                                variant="outline"
                            >
                                Next
                            </Button>
                        </HStack>
                    </Flex>
                )}
            </Box>
        </Box>
    );
}

export default ListAddressOwner; 