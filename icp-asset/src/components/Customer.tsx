import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Flex, Box, Text, Button, VStack, useToast, Input,
    Select, HStack, Icon, ScaleFade, Table, Thead, Tbody, Tr, Th, Td, TableContainer,
    Tabs, TabList, TabPanels, Tab, TabPanel, Heading, Divider, Circle, Spacer, FormControl, FormLabel, UnorderedList, ListItem
} from '@chakra-ui/react';
import { ChevronUpIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { FaEthereum, FaWallet, FaTrophy, FaRegClock, FaArrowUp, FaArrowLeft, FaArrowDown, FaCoins, FaChartLine } from 'react-icons/fa';
import { GoInfinity } from "react-icons/go";
import { PiChartLineUpLight } from "react-icons/pi";
import { SiBitcoinsv } from "react-icons/si";
import { useRouter } from 'next/router';
import { BinaryOptionMarketService, IBinaryOptionMarketService, Phase } from '../service/binary-option-market-service';
import { Principal } from '@dfinity/principal';
import { current } from '@reduxjs/toolkit';
import { AuthClient } from '@dfinity/auth-client';
import { setActorIdentity, setIcpLedgerIdentity } from '../service/actor-locator';
import { IIcpLedgerService, IcpLedgerService } from '../service/icp-ledger-service';
import { format } from 'date-fns';
import { PriceService, PriceData } from '../service/price-service';
import MarketCharts from './charts/MarketCharts';
import { CheckIcon } from '@chakra-ui/icons';
import { II_CONFIG, getInternetIdentityUrl } from '../configs/internet-identity.config';

// Add typings import for ICRC1 Account
import type { Account as ICRC1Account } from '../service/icp-ledger-service';

// Add import for FactoryService
import { FactoryService, MarketInfo } from '../service/factory-service';

enum Side { Long, Short }

interface Coin {
    value: string;
    label: string;
}

interface CustomerProps {
    contractAddress: string;
}

function Customer({ contractAddress }: CustomerProps) {
    console.log("Customer component rendering with contractAddress:", contractAddress);

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [selectedSide, setSelectedSide] = useState<Side | null>(null);
    const [walletAddress, setWalletAddress] = useState<string>("");
    const [balance, setBalance] = useState("0");
    const [contractBalance, setContractBalance] = useState(0);
    const [accumulatedWinnings, setAccumulatedWinnings] = useState(0);
    const [bidAmount, setBidAmount] = useState("");
    const [currentPhase, setCurrentPhase] = useState<Phase>(Phase.Trading);
    const [totalDeposited, setTotalDeposited] = useState(0);
    const [strikePrice, setStrikePrice] = useState<number>(0);
    const [finalPrice, setFinalPrice] = useState<number>(0);
    const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
    const [showClaimButton, setShowClaimButton] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [resultMessage, setResultMessage] = useState("");
    const [countdown, setCountdown] = useState<number | null>(null);
    const [reward, setReward] = useState(0); // Số phần thưởng khi người chơi thắng
    const [positions, setPositions] = useState<{ long: number; short: number }>({ long: 0, short: 0 });
    const [totalMarketPositions, setTotalMarketPositions] = useState<{ long: number; short: number }>({ long: 0, short: 0 });
    const [authenticated, setAuthenticated] = useState(false);
    const [endTimestamp, setEndTimestamp] = useState<number | null>(null);

    // New chart-related state variables
    const [chartData, setChartData] = useState<any[]>([]);
    const [positionHistory, setPositionHistory] = useState<any[]>([]);
    const [chartSymbol, setChartSymbol] = useState<string>('ETH-USD');
    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [longPercentage, setLongPercentage] = useState<number>(50);
    const [shortPercentage, setShortPercentage] = useState<number>(50);
    const [priceTimeRange, setPriceTimeRange] = useState<string>('1d');
    const [positionTimeRange, setPositionTimeRange] = useState<string>('1d');
    const [biddingStartTime, setBiddingStartTime] = useState<number>(0);
    const [tradingPair, setTradingPair] = useState<string>('ETH/USD');
    const [showRules, setShowRules] = useState<boolean>(true);
    const [marketResult, setMarketResult] = useState<string>('Pending');

    const [availableCoins] = useState<Coin[]>([
        { value: "0x5fbdb2315678afecb367f032d93f642f64180aa3", label: "ICP/USD" },
        { value: "0x6fbdb2315678afecb367f032d93f642f64180aa3", label: "ETH/USD" },
        { value: "0x7fbdb2315678afecb367f032d93f642f64180aa3", label: "BTC/USD" }
    ]);

    const toast = useToast();
    const router = useRouter();
    const [marketService, setMarketService] = useState<BinaryOptionMarketService | null>(null);
    const [ledgerService, setLedgerService] = useState<IcpLedgerService | null>(null);
    const [shouldCheckRewardClaimability, setShouldCheckRewardClaimability] = useState(false);
    const [identityPrincipal, setIdentityPrincipal] = useState("");
    const [marketId, setMarketId] = useState<string | null>(null);
    // Add state to track if user is admin
    const [isAdmin, setIsAdmin] = useState(false);
    const [isOwner, setIsOwner] = useState(false); // Add state for owner check

    // Add a state to track if we need to show the market selection view
    const [showMarketSelection, setShowMarketSelection] = useState(false);
    const [factoryService, setFactoryService] = useState<FactoryService | null>(null);
    const [availableMarkets, setAvailableMarkets] = useState<MarketInfo[]>([]);

    // Modify to properly handle market ID from props
    useEffect(() => {
        if (contractAddress && !marketId) {
            console.log("Setting market ID from contract address:", contractAddress);
            setMarketId(contractAddress);

            // Reset other state when market ID changes
            setPositions({ long: 0, short: 0 });
            setTotalMarketPositions({ long: 0, short: 0 });
            setBiddingStartTime(0);
            setEndTimestamp(null);
        }
    }, [contractAddress, marketId]);

    const formatTimeRemaining = (timestampSec: number): string => {
        const now = Math.floor(Date.now() / 1000); // Convert current time to seconds
        const diff = timestampSec - now;

        if (diff <= 0) return "Expired";

        const days = Math.floor(diff / (60 * 60 * 24));
        const hours = Math.floor((diff % (60 * 60 * 24)) / (60 * 60));
        const minutes = Math.floor((diff % (60 * 60)) / 60);
        const seconds = diff % 60;

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    };

    // useEffect(() => {
    //     setBalance(balanceEth);
    //     setIsLoggedIn(true);
    // }, [isLoggedIn]);

    // This effect will handle market service reinitialization when marketId changes
    useEffect(() => {
        if (marketId && marketService) {
            console.log("Reinitializing market service with ID:", marketId);
            marketService.initialize(marketId)
                .then(() => {
                    // After reinitialization, refresh market details
                    if (typeof fetchMarketDetails === 'function') {
                        fetchMarketDetails();
                    }
                })
                .catch(error => {
                    console.error("Error reinitializing market service:", error);
                });
        }
    }, [marketId, marketService]);

    // Add function to fetch markets from factory
    const fetchAvailableMarkets = useCallback(async () => {
        if (!factoryService) return;

        try {
            const markets = await factoryService.getMarkets();
            setAvailableMarkets(markets);
        } catch (error) {
            console.error("Error fetching markets:", error);
            // Fallback to at least show the default market if available
            const defaultId = process.env.NEXT_PUBLIC_BINARY_OPTION_MARKET_CANISTER_ID || "";
            if (defaultId) {
                setAvailableMarkets([{
                    id: defaultId,
                    name: "Default Market",
                    createdAt: BigInt(0) // Use zero timestamp for fallback 
                }]);
            }
        }
    }, [factoryService]);

    // Initialize factory service along with other services
    useEffect(() => {
        const initServices = async () => {
            try {
                console.log("INIT SERVICES: Starting service initialization");
                const authClient = await AuthClient.create();
                const identity = authClient.getIdentity();
                console.log("INIT SERVICES: Got identity", identity.getPrincipal().toText());

                // Initialize factory service first
                const factory = FactoryService.getInstance();
                await factory.initialize();
                setFactoryService(factory);
                console.log("INIT SERVICES: Factory service initialized");

                // Initialize other services as before
                await setIcpLedgerIdentity(identity);
                const icpLedgerService = IcpLedgerService.getInstance();
                await icpLedgerService.initialize();
                setLedgerService(icpLedgerService);
                console.log("INIT SERVICES: Ledger service initialized");

                await setActorIdentity(identity);
                const service = BinaryOptionMarketService.getInstance();

                // Only initialize market service if we have a market ID
                if (marketId) {
                    console.log("INIT SERVICES: Initializing market service with canister ID:", marketId);
                    await service.initialize(marketId);
                    setShowMarketSelection(false);
                } else {
                    // If no market ID, fetch available markets and show selection
                    console.log("INIT SERVICES: No market ID, showing selection");
                    setShowMarketSelection(true);
                    try {
                        const markets = await factory.getMarkets();
                        console.log("INIT SERVICES: Got markets:", markets);
                        setAvailableMarkets(markets);
                    } catch (error) {
                        console.error("INIT SERVICES: Error fetching markets:", error);
                    }
                }

                setMarketService(service);
                console.log("INIT SERVICES: Market service set, initialization complete");

                // Try to get balance right after initializing ledger service
                try {
                    const userBalance = await icpLedgerService.getBalance({
                        owner: identity.getPrincipal(),
                        subaccount: []
                    });

                    // Convert to human-readable format
                    const balanceNumber = Number(userBalance) / 10e7;
                    console.log("IDENTITY: Initial balance:", balanceNumber.toFixed(4));
                    setBalance(balanceNumber.toFixed(4));
                } catch (balanceError) {
                    console.error("IDENTITY: Error fetching initial balance:", balanceError);
                }
            } catch (error) {
                console.error("INIT SERVICES: Error during initialization:", error);
            }
        };

        if (authenticated && (!factoryService || !marketService || !ledgerService)) {
            console.log("INIT SERVICES: Triggering initialization - authenticated:", authenticated);
            initServices();
        }
    }, [authenticated, marketId]);

    // Fetch markets when showing selection view
    useEffect(() => {
        if (showMarketSelection && factoryService) {
            fetchAvailableMarkets();
        }
    }, [showMarketSelection, factoryService, fetchAvailableMarkets]);

    // More detailed fetch market details with better logging
    const fetchMarketDetails = useCallback(async () => {
        if (!marketService || !marketId) {
            console.log("Cannot fetch market details - missing service or marketId");
            return;
        }

        try {
            console.log(`Fetching market details for ${marketId}`);
            const details = await marketService.getMarketDetails(marketId);
            console.log("Market details retrieved:", details);

            if (details) {
                // Extract market details
                const strikeValue = details.oracleDetails.strikePrice;
                const finalValue = details.oracleDetails.finalPrice;
                console.log(`Strike price: ${strikeValue}, Final price: ${finalValue}`);
                setStrikePrice(strikeValue);
                setFinalPrice(finalValue);

                if (details.positions) {
                    const longPos = Number(details.positions.long) / 1e8;
                    const shortPos = Number(details.positions.short) / 1e8;
                    console.log(`Market positions - Long: ${longPos}, Short: ${shortPos}`);
                    setTotalMarketPositions({
                        long: longPos,
                        short: shortPos
                    });
                }

                // Get phase directly using getCurrentPhase instead of from market details
                try {
                    console.log("Getting current phase directly via getCurrentPhase()");
                    const phaseResult = await marketService.getCurrentPhase();
                    console.log("Phase result:", phaseResult);

                    // Convert the variant object to Phase enum
                    let phase = Phase.Trading;
                    if ('Bidding' in phaseResult) {
                        phase = Phase.Bidding;
                        console.log("Setting phase to BIDDING");
                    } else if ('Trading' in phaseResult) {
                        phase = Phase.Trading;
                        console.log("Setting phase to TRADING");
                    } else if ('Maturity' in phaseResult) {
                        phase = Phase.Maturity;
                        console.log("Setting phase to MATURITY");
                    } else if ('Expiry' in phaseResult) {
                        phase = Phase.Expiry;
                        console.log("Setting phase to EXPIRY");
                    }

                    console.log(`Current phase: ${Phase[phase]}`);
                    setCurrentPhase(phase);
                } catch (phaseError) {
                    console.error("Error getting current phase:", phaseError);
                }

                if (details.tradingPair) {
                    console.log(`Trading pair: ${details.tradingPair}`);
                    setTradingPair(details.tradingPair);
                    // Format trading pair for chart use
                    const formattedPair = details.tradingPair.replace('/', '-');
                    setChartSymbol(formattedPair);
                }

                if (details.endTimestamp) {
                    const timestamp = Number(details.endTimestamp);
                    console.log(`End timestamp: ${timestamp} (${new Date(timestamp * 1000).toString()})`);
                    setEndTimestamp(timestamp);
                }

                // Set bidding start time from createTimestamp
                if (details.createTimestamp) {
                    const timestamp = Number(details.createTimestamp);
                    console.log(`Bidding start time: ${timestamp} (${new Date(timestamp * 1000).toString()})`);
                    setBiddingStartTime(timestamp);
                }
            }
        } catch (error) {
            console.error("Error fetching market details:", error);
        }
    }, [marketId, marketService]);

    const setInitialIdentity = async () => {
        try {
            console.log("IDENTITY: Starting identity initialization");
            const authClient = await AuthClient.create();
            const identity = authClient.getIdentity();
            const isAuthenticated = await authClient.isAuthenticated();

            if (isAuthenticated) {
                console.log("IDENTITY: User is authenticated with principal:", identity.getPrincipal().toText());
                setIdentityPrincipal(identity.getPrincipal().toText());

                console.log("IDENTITY: Setting actor identity");
                await setActorIdentity(identity);

                console.log("IDENTITY: Setting ICP ledger identity");
                await setIcpLedgerIdentity(identity);

                console.log("IDENTITY: Initializing services");
                const icpLedgerService = IcpLedgerService.getInstance();
                await icpLedgerService.initialize();
                setLedgerService(icpLedgerService);

                const service = BinaryOptionMarketService.getInstance();

                // Initialize with market ID if available
                if (marketId) {
                    console.log("IDENTITY: Initializing market service with ID:", marketId);
                    await service.initialize(marketId);
                } else {
                    console.log("IDENTITY: Initializing market service without specific ID");
                    await service.initialize();
                }

                setMarketService(service);
                console.log("IDENTITY: Services initialized successfully");
            } else {
                console.log("IDENTITY: User is not authenticated");
            }

            setAuthenticated(isAuthenticated);
        } catch (error) {
            console.error("IDENTITY: Error during identity initialization:", error);
        }
    };

    useEffect(() => {
        // prevent server-side rendering
        if (typeof window !== 'undefined') {
            setInitialIdentity();
        }
    }, []);

    const signIn = async () => {
        try {
            console.log("Starting sign-in process");

            // Create auth client with explicit options for handling II in production
            const authClient = await AuthClient.create(II_CONFIG.AUTH_CLIENT_OPTIONS);
            console.log("Auth client created successfully");

            // Configure Internet Identity URL with proper fallback
            const isProduction = process.env.NODE_ENV === "production";
            const internetIdentityUrl = getInternetIdentityUrl();

            console.log(`Using Internet Identity URL: ${internetIdentityUrl} (production: ${isProduction})`);

            // When in production, ensure delegation verification works correctly
            if (isProduction) {
                console.log("Setting up production-specific configurations for II");
                // Ensure the agent used by auth-client will work with II delegations
                // by using the main IC host for II interactions
                (authClient as any)._agent._host = II_CONFIG.PRODUCTION_SETTINGS.HOST;
            }

            // Create a promise to handle the login flow with timeout
            const loginPromise = new Promise<void>((resolve, reject) => {
                // Add a timeout to prevent hanging indefinitely
                const timeout = setTimeout(() => {
                    reject(new Error("Login process timed out after 2 minutes"));
                }, 120000); // 2 minutes timeout

                authClient.login({
                    identityProvider: internetIdentityUrl,
                    onSuccess: () => {
                        console.log("Login successful");
                        clearTimeout(timeout);
                        resolve();
                    },
                    onError: (error) => {
                        console.error("Login error:", error);
                        clearTimeout(timeout);
                        reject(error);
                    },
                    // Add maxTimeToLive to limit delegation time for better security
                    maxTimeToLive: II_CONFIG.PRODUCTION_SETTINGS.MAX_DELEGATION_TIME,
                });
            });

            await loginPromise;

            // Get the identity and update app state
            const identity = authClient.getIdentity();
            console.log("Setting actor identity");
            setActorIdentity(identity);

            const isAuthenticated = await authClient.isAuthenticated();
            console.log("Authentication status:", isAuthenticated);

            setIdentityPrincipal(identity.getPrincipal().toText());
            setAuthenticated(isAuthenticated);

            // Force refresh market details after authentication
            if (marketService) {
                console.log("Refreshing market details after authentication");
                await fetchMarketDetails();
            }
        } catch (error) {
            console.error("Sign-in process failed:", error);
            toast({
                title: "Authentication Failed",
                description: "Unable to authenticate with Internet Identity. Please try again.",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    };

    useEffect(() => {
        if (currentPhase === Phase.Maturity) {
            setCountdown(5);
            const countdownInterval = setInterval(() => {
                setCountdown(prev => {
                    if (prev !== null && prev > 0) {
                        return prev - 1;
                    } else {
                        clearInterval(countdownInterval);
                        setCountdown(null);

                        setCurrentPhase(Phase.Expiry);
                        return null;
                    }
                });
            }, 1000);

            setTimeout(async () => {
                handleAfterCountdown();
            }, 5000);

            const handleAfterCountdown = async () => {
                clearInterval(countdownInterval);
                setCountdown(null);

                if (marketService) {
                    const marketDetails = await marketService.getMarketDetails()

                    const finalPrice = marketDetails.oracleDetails.finalPrice;
                    const strikePrice = marketDetails.oracleDetails.strikePrice;

                    console.log("Final Price:", finalPrice);
                    console.log("Strike Price:", strikePrice);
                    console.log("Selected Side:", selectedSide);

                    if (finalPrice >= strikePrice) {
                        console.log("long win")
                    } else {
                        console.log("short win")
                    }

                    setFinalPrice(finalPrice);
                    setStrikePrice(strikePrice);
                    // Logic so sánh
                    if (selectedSide === Side.Long && finalPrice >= strikePrice) {
                        setResultMessage("YOU WIN");
                    } else if (selectedSide === Side.Short && finalPrice <= strikePrice) {
                        setResultMessage("YOU WIN");
                    } else {
                        setResultMessage("YOU LOSE");
                    }
                    setShowResult(true);
                    setTimeout(() => {
                        setShowResult(false);
                    }, 2000);
                }
            }
        }
    }, [currentPhase]);

    const handleCoinSelect = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = event.target.value;
        setSelectedCoin(availableCoins.find(coin => coin.value === selectedValue) || null);
    };

    // Hàm đặt cược
    const handleBid = async (side: Side, amount: number) => {
        try {
            if (!marketService || !ledgerService) {
                throw new Error("Services not initialized");
            }

            const amountInE8s = BigInt(Math.floor(amount * 10e7));
            console.log("Amount in e8s:", amountInE8s.toString());

            // First approve the market canister to spend your tokens
            const approveArgs = {
                spender: {
                    owner: Principal.fromText(marketId || ""),
                    subaccount: []
                },
                amount: amountInE8s,

            };

            const approveResult = await ledgerService.approve(approveArgs);
            console.log("Approve result:", approveResult);

            // Now place the bid
            const result = await marketService.bid(
                side === Side.Long ? { Long: null } : { Short: null },
                amountInE8s
            );

            console.log("Bid result:", result);
            if ('ok' in result) {
                toast({
                    description: "Bid placed successfully!",
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
                // Refresh data after successful bid
                await fetchMarketDetails();
            } else {
                toast({
                    description: "Failed to place bid: " + result.err,
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            }
        } catch (err) {
            console.error('Error placing bid:', err);
            toast({
                description: err instanceof Error ? err.message : "An unexpected error occurred",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    };

    useEffect(() => {
        console.log("current phase is:", currentPhase);
        const interval = setInterval(() => {
            if (marketService && ledgerService) {
                fetchMarketDetails();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [marketService, ledgerService, currentPhase]);

    // Hàm claimReward khi phase là Expiry
    const claimReward = async () => {
        if (marketService && currentPhase === Phase.Expiry) {
            // const provider = new ethers.providers.Web3Provider(window.ethereum); // Define provider here
            try {
                const tx = await marketService.claimReward();

                // @TODO: implement get dfinity balance here
                // const newBalanceWei = await provider.getBalance(walletAddress);
                // const newBalanceEth = parseFloat(ethers.utils.formatEther(newBalanceWei));

                // const fee = (reward * 0.10); // 10% phí
                // const finalReward = reward - fee;

                // setBalance(newBalanceEth);  // Cập nhật lại số dư
                // setReward(finalReward);  // Reset lại reward sau khi claim
                // setShowClaimButton(false);  // Ẩn nt claim sau khi đã nhận


                setTotalDeposited(0);
                // Cập nhật lại bảng Long/Short
                await fetchMarketDetails(); // Gọi lại hàm để cập nhật thông tin


                toast({
                    title: "Reward claimed!",
                    description: `You've successfully claimed your reward.`,
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
            } catch (error) {
                toast({
                    title: "Error claiming reward",
                    description: "An error occurred. Please try again.",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            }
        }
    };


    const canClaimReward = async () => {
        if (marketService && currentPhase === Phase.Expiry) {
            console.log("Checking claim eligibility..."); // Log để kiểm tra
            try {
                // const hasClaimed = await contract.hasClaimed(walletAddress);
                console.log('start checking claim reward')

                let winningSide = finalPrice >= strikePrice ? Side.Long : Side.Short;

                let userSide = positions.long > 0 ? Side.Long : Side.Short;

                console.log(positions);

                let userDeposit = 0;
                if (winningSide === userSide) {
                    // Nếu người chơi chọn đúng bên thắng, kiểm tra khoản cược
                    userDeposit = (userSide === Side.Long)
                        ? positions.long
                        : positions.short;
                }

                console.log("Winning side:", winningSide); // Log bên thắng
                console.log("User deposit:", userDeposit); // Log số tiền cược của người dùng



                // generated fake data. @TODO: change this soon after it works
                const hasClaimed = await marketService?.hasUserClaimed(Principal.fromText(identityPrincipal));

                console.log("Has claimed:", hasClaimed); // Log giá trị hasClaimed

                // Đảm bảo tính toán phần thưởng và cập nhật biến `reward`
                if (!hasClaimed && userDeposit > 0) {
                    const totalWinningDeposits = winningSide === Side.Long ? positions.long : positions.short;
                    const calculatedReward = ((userDeposit * totalDeposited) / totalWinningDeposits) * 0.90;

                    // const formattedReward = parseFloat(ethers.utils.formatEther(calculatedReward.toString()));
                    setReward(calculatedReward);  // Cập nhật phần thưởng
                    setShowClaimButton(true);
                } else {
                    setShowClaimButton(false);
                }
            } catch (error) {
                console.error("Error checking claim eligibility:", error);
                setShowClaimButton(false);
            }
        }
    };


    useEffect(() => {
        console.log("check reward claimability:");

        const checkClaimReward = async () => {
            canClaimReward();
        }

        checkClaimReward();
    }, [shouldCheckRewardClaimability]);

    // Reset lại thị trường
    const resetMarket = () => {
        setStrikePrice(0);
        setFinalPrice(0);
        setCurrentPhase(Phase.Bidding);
    };


    const abbreviateAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const isPhase = (phase: Phase, phaseName: string): boolean => {
        return Object.keys(phase)[0] === phaseName;
    };

    const getDisplayPrice = () => {
        if (countdown !== null) {
            return countdown;
        }
        return strikePrice.toString();
    };

    // Add a function to select a market
    const selectMarket = (marketId: string) => {
        router.push(`/customer/${marketId}`);
        setMarketId(marketId);
        setShowMarketSelection(false);
    };

    // Add/update the renderMarketSelection function to show market selection UI
    const renderMarketSelection = () => {
        return (
            <Box p={6} maxW="800px" mx="auto" bg="gray.800" borderRadius="md" mt={8}>
                <Text fontSize="2xl" fontWeight="bold" mb={6} textAlign="center" color="white">
                    Select a Market
                </Text>
                {availableMarkets.length === 0 ? (
                    <Text color="gray.400" textAlign="center">Loading available markets...</Text>
                ) : (
                    <VStack spacing={4} align="stretch">
                        {availableMarkets.map((market) => (
                            <Button
                                key={market.id}
                                onClick={() => {
                                    router.push(`/customer/${market.id}`);
                                    setMarketId(market.id);
                                    setShowMarketSelection(false);
                                }}
                                colorScheme="yellow"
                                bg="#FEDF56"
                                color="black"
                                size="lg"
                                _hover={{ bg: "#FFE980" }}
                                justifyContent="space-between"
                                p={6}
                            >
                                <Text fontWeight="bold">{market.name || market.id}</Text>
                                <Text fontSize="sm" opacity={0.8}>Created: {new Date(Number(market.createdAt) / 1000000).toLocaleString()}</Text>
                            </Button>
                        ))}
                    </VStack>
                )}
            </Box>
        );
    };

    useEffect(() => {
        // Update position percentages based on total positions
        if (totalMarketPositions.long + totalMarketPositions.short > 0) {
            const total = totalMarketPositions.long + totalMarketPositions.short;
            setLongPercentage((totalMarketPositions.long / total) * 100);
            setShortPercentage((totalMarketPositions.short / total) * 100);
        } else {
            // Default to 50/50 if no positions
            setLongPercentage(50);
            setShortPercentage(50);
        }
    }, [totalMarketPositions]);

    // Handle price updates and chart data
    useEffect(() => {
        if (!authenticated || !marketId) return;

        const priceService = PriceService.getInstance();
        let tradingPairForChart = 'ETH-USD'; // Default

        const loadTradingPair = async () => {
            try {
                if (marketService) {
                    // Get trading pair directly from the canister using the dedicated method
                    let tradingPair = await marketService.getTradingPair();
                    console.log("DEBUG: Raw trading pair from canister:", tradingPair);

                    // Handle the formatting between SOL-USD and SOL/USD
                    if (typeof tradingPair === 'string') {
                        // Format for display (SOL-USD -> SOL/USD)
                        if (tradingPair.includes('-')) {
                            tradingPair = tradingPair.replace('-', '/');
                        } else if (!tradingPair.includes('/') && !tradingPair.includes('-')) {
                            tradingPair = `${tradingPair}/USD`;
                        }
                    } else {
                        tradingPair = "ICP/USD"; // Fallback
                    }

                    console.log("DEBUG: Formatted trading pair for display:", tradingPair);
                    setTradingPair(tradingPair);

                    // Format for chart (convert back to hyphen format for API compatibility)
                    const formattedPair = tradingPair.replace('/', '-');
                    console.log("DEBUG: Formatted trading pair for charts:", formattedPair);
                    setChartSymbol(formattedPair);
                    tradingPairForChart = formattedPair; // Update the variable used for chart data
                }
            } catch (error) {
                console.error("Error loading trading pair and strike price:", error);
            }
        };

        // Load the trading pair information first
        loadTradingPair().then(() => {
            // Subscribe to price updates after trading pair is loaded
            const unsubscribe = priceService.subscribeToPriceUpdates((data: PriceData) => {
                setCurrentPrice(data.price);
            }, tradingPairForChart);

            // Load historical price data
            const loadChartData = async () => {
                try {
                    const data = await priceService.fetchKlines(tradingPairForChart);
                    setChartData(data);
                } catch (error) {
                    console.error("Error loading chart data:", error);
                }
            };

            loadChartData();

            return () => {
                unsubscribe();
            };
        });
    }, [authenticated, marketId, marketService]);

    // Function to handle time range changes for charts
    const handleTimeRangeChange = (range: string, chartType: 'price' | 'position') => {
        if (chartType === 'price') {
            setPriceTimeRange(range);
        } else {
            setPositionTimeRange(range);
        }
    };

    // Format timestamp as readable date
    const formatMaturityTime = (timestamp: number): string => {
        try {
            const date = new Date(timestamp * 1000);
            return format(date, 'MMM d, yyyy HH:mm');
        } catch (error) {
            return "Unknown";
        }
    };

    // Modify the checkIsAdmin function to include more debug info
    const checkIsAdmin = async () => {
        if (!marketService) {
            console.log("DEBUG: checkIsAdmin - marketService not available");
            return;
        }

        try {
            // Check if the user is an admin of the market
            const isAdmin = await marketService.isAdmin();
            console.log("DEBUG: checkIsAdmin - isAdmin result:", isAdmin);
            setIsAdmin(isAdmin);

            // Check if the user is the owner of the market
            const owner = await marketService.getOwner();
            const currentPrincipal = identityPrincipal;

            console.log("DEBUG: Owner check details:", {
                owner,
                currentPrincipal,
                isMatch: owner === currentPrincipal
            });

            // Log comparison in different formats to debug
            console.log(`DEBUG: Owner (${owner.length} chars): ${owner}`);
            console.log(`DEBUG: Current Principal (${currentPrincipal?.length} chars): ${currentPrincipal}`);

            setIsOwner(owner === currentPrincipal);
            console.log("DEBUG: Setting isOwner to:", owner === currentPrincipal);
        } catch (error) {
            console.error("Error checking admin status:", error);
        }
    };

    // Add a function call to check admin status when marketId changes
    useEffect(() => {
        if (authenticated && marketId && marketService) {
            checkIsAdmin();
        }
    }, [authenticated, marketId, marketService, identityPrincipal]);

    // Add a new useEffect to call fetchMarketDetails after initialization
    useEffect(() => {
        if (authenticated && marketService && identityPrincipal) {
            console.log("Component is authenticated and marketService is ready - fetching details");
            fetchMarketDetails();
        }
    }, [authenticated, marketService, identityPrincipal, fetchMarketDetails]);

    // Replace the existing createPositionHistoryPoints function with actual position history fetching
    useEffect(() => {
        if (!marketService || !marketId) return;

        const fetchPositionHistory = async () => {
            try {
                console.log("Fetching position history for market:", marketId);

                // Get position history from canister
                const historyPoints = await marketService.getPositionHistory();
                console.log("Fetched position history from canister:", historyPoints);

                if (historyPoints && historyPoints.length > 0) {
                    console.log("Using real position history with", historyPoints.length, "points");
                    setPositionHistory(historyPoints);
                } else {
                    // Fallback to default if no history points available
                    console.log("No position history found, using fallback");
                    const defaultPoints = createPositionHistoryPoints();
                    console.log("Created fallback points:", defaultPoints);
                    setPositionHistory(defaultPoints);
                }
            } catch (error) {
                console.error("Error fetching position history:", error);
                // Log more details about the error
                if (error instanceof Error) {
                    console.error("Error name:", error.name);
                    console.error("Error message:", error.message);
                    console.error("Error stack:", error.stack);
                }

                // Fallback to default if error
                console.log("Using fallback due to error");
                const defaultPoints = createPositionHistoryPoints();
                console.log("Created fallback points:", defaultPoints);
                setPositionHistory(defaultPoints);
            }
        };

        fetchPositionHistory();

        // Set up interval to refresh the history
        const interval = setInterval(fetchPositionHistory, 10000); // Every 10 seconds

        return () => clearInterval(interval);
    }, [marketService, marketId, biddingStartTime, endTimestamp, totalMarketPositions]);

    // Keep the createPositionHistoryPoints as a fallback
    const createPositionHistoryPoints = useCallback(() => {
        if (!biddingStartTime || !endTimestamp) return [];

        const now = Math.floor(Date.now() / 1000);
        const result = [];

        // Start with 50/50 at beginning
        result.push({
            timestamp: biddingStartTime,
            longPercentage: 50,
            shortPercentage: 50
        });

        // If we have position data
        if (totalMarketPositions.long > 0 || totalMarketPositions.short > 0) {
            const total = totalMarketPositions.long + totalMarketPositions.short;
            const longPercentage = total > 0 ? Math.round((totalMarketPositions.long / total) * 100) : 50;
            const shortPercentage = total > 0 ? Math.round((totalMarketPositions.short / total) * 100) : 50;

            // Add current position point
            result.push({
                timestamp: now,
                longPercentage: longPercentage,
                shortPercentage: shortPercentage
            });

            // Add end position point (for projection)
            if (now < endTimestamp) {
                result.push({
                    timestamp: endTimestamp,
                    longPercentage: longPercentage,
                    shortPercentage: shortPercentage
                });
            }
        }

        return result;
    }, [biddingStartTime, endTimestamp, totalMarketPositions]);

    // Add additional effect to update market positions
    useEffect(() => {
        if (!marketService || !marketId) return;

        const updateMarketPositions = async () => {
            try {
                const marketDetails = await marketService.getMarketDetails(marketId);
                if (marketDetails && marketDetails.positions) {
                    // Convert bigint positions to numbers
                    const longPosition = typeof marketDetails.positions.long === 'bigint'
                        ? Number(marketDetails.positions.long) / 1e8
                        : 0;
                    const shortPosition = typeof marketDetails.positions.short === 'bigint'
                        ? Number(marketDetails.positions.short) / 1e8
                        : 0;

                    setTotalMarketPositions({
                        long: longPosition,
                        short: shortPosition
                    });

                    console.log("Market positions updated:", { long: longPosition, short: shortPosition });
                }
            } catch (error) {
                console.error("Error updating market positions:", error);
            }
        };

        updateMarketPositions();
        const interval = setInterval(updateMarketPositions, 10000);
        return () => clearInterval(interval);
    }, [marketService, marketId]);

    // Add effect to update user's personal positions
    useEffect(() => {
        if (!marketService || !marketId || !authenticated) return;

        const fetchUserPositions = async () => {
            try {
                console.log("Fetching user positions for market:", marketId);

                // Get the current user's principal
                const authClient = await AuthClient.create();
                const identity = authClient.getIdentity();
                const principal = identity.getPrincipal();

                // Fetch the user's position
                const userPosition = await marketService.getUserPosition(principal);
                console.log("Raw user position:", userPosition);

                if (userPosition) {
                    // Convert bigint positions to numbers with correct ICP formatting (divide by 1e8)
                    const longPosition = typeof userPosition.long === 'bigint'
                        ? Number(userPosition.long) / 1e8
                        : 0;
                    const shortPosition = typeof userPosition.short === 'bigint'
                        ? Number(userPosition.short) / 1e8
                        : 0;

                    setPositions({
                        long: longPosition,
                        short: shortPosition
                    });

                    console.log("User positions updated:", { long: longPosition, short: shortPosition });
                } else {
                    // Reset positions if none found
                    setPositions({ long: 0, short: 0 });
                    console.log("No user positions found");
                }
            } catch (error) {
                console.error("Error fetching user positions:", error);
            }
        };

        fetchUserPositions();
        const interval = setInterval(fetchUserPositions, 10000); // Refresh every 10 seconds

        return () => clearInterval(interval);
    }, [marketService, marketId, authenticated]);

    // Add a function to fetch user balance
    const fetchUserBalance = async () => {
        if (!ledgerService || !authenticated) {
            console.log("Cannot fetch balance - missing ledger service or not authenticated");
            return;
        }

        try {
            console.log("Fetching user balance...");
            const identity = await AuthClient.create().then(client => client.getIdentity());
            const principal = identity.getPrincipal();

            // Get balance from ledger
            const userBalance = await ledgerService.getBalance({
                owner: principal,
                subaccount: [] // Main account
            });

            console.log("Raw balance from ledger:", userBalance.toString());

            // Convert to human-readable format (divide by 10^8)
            const balanceNumber = Number(userBalance) / 10e7;
            console.log("Formatted balance:", balanceNumber.toFixed(4));

            setBalance(balanceNumber.toFixed(4));
        } catch (error) {
            console.error("Error fetching user balance:", error);
        }
    };

    // Call the balance fetch function after authentication and ledger service initialization
    useEffect(() => {
        if (authenticated && ledgerService) {
            fetchUserBalance();
        }
    }, [authenticated, ledgerService]);

    return (
        <Flex direction="column" alignItems="center" justifyContent="flex-start" p={6} bg="black" minH="100vh" position="relative">
            {showMarketSelection ? (
                renderMarketSelection()
            ) : (
                <>
                    {/* Header Bar */}
                    <Flex
                        width="100%"
                        justifyContent="space-between"
                        alignItems="center"
                        py={3}
                        px={6}
                        borderBottom="1px solid"
                        borderColor="gray.800"
                        mb={4}
                    >
                        <Button
                            leftIcon={<FaArrowLeft color="white" />}
                            borderColor="#FEDF56"
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push('/listaddress/1')}
                            color="gray.400"
                            _hover={{
                                color: "white",
                            }}
                        >
                            Markets
                        </Button>

                        <HStack spacing={4} ml="auto">
                            {/* Balance Box */}
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
                                        {balance} ICP
                                    </Text>
                                </HStack>

                                <style jsx>{`
                                    @keyframes gradient-border {
                                        0% { background-position: 0% 50%; }
                                        50% { background-position: 100% 50%; }
                                        100% { background-position: 0% 50%; }
                                    }
                                `}</style>
                            </Box>

                            {/* Wallet Address Box */}
                            <Box
                                p="2px"
                                borderRadius="lg"
                                sx={{
                                    backgroundImage: "linear-gradient(270deg, #eaea72, #f49a24, #e25375, #f2f2bf, #f2f2cd)",
                                    backgroundSize: "400% 400%",
                                    animation: "gradient-border 6s ease infinite",
                                    display: "inline-block",
                                    backgroundColor: "transparent"
                                }}
                            >
                                <Box
                                    display="flex"
                                    alignItems="center"
                                    bg="gray.800"
                                    borderRadius="lg"
                                    px={4}
                                    py={2}
                                    boxShadow="md"
                                    transition="all 0.2s"
                                    _hover={{ bg: "gray.700" }}
                                >
                                    <Text color="white" fontWeight="semibold" fontSize="md">
                                        {abbreviateAddress(identityPrincipal || '')}
                                    </Text>
                                </Box>

                                <style jsx>{`
                                    @keyframes gradient-border {
                                        0% { background-position: 0% 50%; }
                                        50% { background-position: 100% 50%; }
                                        100% { background-position: 0% 50%; }
                                    }
                                `}</style>
                            </Box>
                        </HStack>
                    </Flex>

                    {/* Market Title and Info */}
                    <Flex width="100%" justifyContent="center" mb={6}>
                        <Box width="100%" maxW="1200px">
                            <Box>
                                <Heading size="md" fontSize="30px">
                                    <HStack>
                                        <Text color="#FEDF56" fontSize="30px">
                                            {tradingPair}
                                        </Text>
                                        <Text color="white" fontSize="25px">
                                            will reach <Text as="span" color={finalPrice >= strikePrice ? "green.400" : "red.400"}>${strikePrice}</Text> by {formatMaturityTime(endTimestamp || 0)}
                                        </Text>
                                    </HStack>
                                </Heading>
                                <HStack spacing={2} mt={1}>
                                    <HStack color="rgba(255, 255, 255, 0.7)">
                                        <PiChartLineUpLight />
                                        <Text color="rgba(255, 255, 255, 0.7)" fontSize="sm">
                                            {totalDeposited.toFixed(2)} ICP |
                                        </Text>
                                    </HStack>
                                    <HStack color="rgba(255, 255, 255, 0.7)">
                                        <FaRegClock />
                                        <Text color="rgba(255, 255, 255, 0.7)" fontSize="sm">
                                            {endTimestamp ? formatMaturityTime(endTimestamp) : "Unknown"} |
                                        </Text>
                                    </HStack>
                                    <HStack color="rgba(255, 255, 255, 0.7)">
                                        <Icon as={FaRegClock} />
                                        <Text color="rgba(255, 255, 255, 0.7)" fontSize="sm">
                                            Phase: {Phase[currentPhase]}
                                        </Text>
                                    </HStack>
                                </HStack>
                            </Box>
                            {(currentPhase === Phase.Maturity || currentPhase === Phase.Expiry) && (
                                <Box
                                    border="1px solid #FEDF56"
                                    borderRadius="md"
                                    p={3}
                                    mb={4}
                                    textAlign="center"
                                    ml="100px"
                                    textColor="white"
                                >
                                    <Text fontWeight="bold">Result: {finalPrice >= strikePrice ? "LONG WINS" : "SHORT WINS"}</Text>
                                </Box>
                            )}
                        </Box>
                    </Flex>

                    {/* Main Content */}
                    <Flex direction={{ base: 'column', md: 'row' }} gap={8} align="flex-start" px={2}>
                        {/* Left Side - Charts and Rules */}
                        <Box width={{ base: '100%', md: '75%' }} pr={{ base: 0, md: 6 }} ml={0}>
                            <Tabs variant="line" colorScheme="yellow" border="1px solid" borderColor="gray.700" borderRadius="xl" pb={2} mb={6} height="460px">
                                <Box pb={1}>
                                    <TabList
                                        borderBottom="2px solid"
                                        borderColor="gray.600"
                                        px={6}
                                        py={3}
                                        display="grid"
                                        gridTemplateColumns="1fr 1fr"
                                        alignItems="center"
                                    >
                                        <Flex justify="center">
                                            <Tab
                                                fontWeight="bold"
                                                fontSize="sm"
                                                _selected={{
                                                    bg: "blue.600",
                                                    color: "white",
                                                    borderRadius: "md",
                                                    boxShadow: "md",
                                                }}
                                                _hover={{
                                                    bg: "gray.700",
                                                    color: "white",
                                                }}
                                                px={6}
                                                py={2}
                                                transition="all 0.2s"
                                            >
                                                Price Chart
                                            </Tab>
                                        </Flex>

                                        <Flex justify="center">
                                            <Tab
                                                fontWeight="bold"
                                                fontSize="sm"
                                                _selected={{
                                                    bg: "green.500",
                                                    color: "white",
                                                    borderRadius: "md",
                                                    boxShadow: "md",
                                                }}
                                                _hover={{
                                                    bg: "gray.700",
                                                    color: "white",
                                                }}
                                                px={6}
                                                py={2}
                                                transition="all 0.2s"
                                            >
                                                Position Chart
                                            </Tab>
                                        </Flex>
                                    </TabList>
                                </Box>

                                <TabPanels>
                                    <TabPanel p={0} pt={4}>
                                        <Box position="relative" width="100%" height="380px">
                                            <MarketCharts
                                                chartData={chartData}
                                                positionHistory={positionHistory}
                                                positions={{ long: totalMarketPositions.long, short: totalMarketPositions.short }}
                                                strikePrice={strikePrice}
                                                timeRange={priceTimeRange}
                                                chartType="price"
                                                onTimeRangeChange={handleTimeRangeChange}
                                                chartSymbol={chartSymbol}
                                                biddingStartTime={biddingStartTime}
                                                maturityTime={endTimestamp || (Math.floor(Date.now() / 1000) + 86400)}
                                            />
                                        </Box>
                                    </TabPanel>

                                    <TabPanel p={0} pt={4}>
                                        <Box position="relative" width="100%" height="380px">
                                            <MarketCharts
                                                chartData={[]}
                                                positionHistory={positionHistory}
                                                positions={{ long: totalMarketPositions.long, short: totalMarketPositions.short }}
                                                strikePrice={strikePrice}
                                                timeRange={positionTimeRange}
                                                chartType="position"
                                                onTimeRangeChange={handleTimeRangeChange}
                                                chartSymbol={chartSymbol}
                                                biddingStartTime={biddingStartTime}
                                                maturityTime={endTimestamp || (Math.floor(Date.now() / 1000) + 86400)}
                                            />
                                        </Box>
                                    </TabPanel>
                                </TabPanels>
                            </Tabs>

                            {/* Rules Section */}
                            <Box mt={6} border="1px solid #2D3748" borderRadius="xl" p={4} mb={6}>
                                <Flex justify="space-between" align="center" onClick={() => setShowRules(!showRules)} cursor="pointer">
                                    <Heading size="md" color="#F0F8FF" fontSize="25px">Rules</Heading>
                                    <Icon as={showRules ? ChevronUpIcon : ChevronDownIcon} color="gray.400" boxSize="30px" />
                                </Flex>
                                {showRules && (
                                    <Box mt={4}>
                                        <Text color="gray.400" mb={3}>
                                            This is a binary option market where users can place bids on whether the price will be above (LONG) or below (SHORT) the strike price: {strikePrice} USD at maturity.
                                        </Text>

                                        <Text fontWeight="semibold" color="gray.300" mt={4} mb={2}>Market Phases:</Text>
                                        <UnorderedList color="gray.400" spacing={2} pl={5} mb={4}>
                                            <ListItem><strong>Trading Phase:</strong> The market is visible but not yet open for bidding.</ListItem>
                                            <ListItem><strong>Bidding Phase:</strong> Users can place LONG/SHORT bids with ICP.</ListItem>
                                            <ListItem><strong>Maturity Phase:</strong> The final price is determined and the market outcome is resolved.</ListItem>
                                            <ListItem><strong>Expiry Phase:</strong> Winners can claim rewards proportional to their bid amount.</ListItem>
                                        </UnorderedList>

                                        <Text fontWeight="semibold" color="gray.300" mt={4} mb={2}>Yes/No Criteria:</Text>
                                        <UnorderedList color="gray.400" spacing={2} pl={5} mb={4}>
                                            <ListItem>Resolves to <strong>"Yes"</strong> (LONG wins) if the final price is strictly above {strikePrice} USD at maturity time.</ListItem>
                                            <ListItem>Resolves to <strong>"No"</strong> (SHORT wins) if the final price is {strikePrice} USD or below at maturity time.</ListItem>
                                        </UnorderedList>

                                        <Text fontWeight="semibold" color="gray.300" mt={4} mb={2}>Resolution:</Text>
                                        <UnorderedList color="gray.400" spacing={2} pl={5} mb={4}>
                                            <ListItem>We will use the oracle price feed at the exact maturity time: {new Date((endTimestamp || 0) * 1000).toLocaleString()}.</ListItem>
                                            <ListItem>Specifically, we will look at the closing USD value of {tradingPair} at that exact minute.</ListItem>
                                        </UnorderedList>
                                    </Box>
                                )}
                            </Box>
                        </Box>

                        {/* Right Side - Bid Panel and Market Info */}
                        <Box width={{ base: "100%", md: "25%" }} mt={{ base: 4, md: 0 }} mr={0}>
                            {/* Strike Price */}
                            <Box
                                bg="gray.800"
                                p={4}
                                borderRadius="xl"
                                mb={4}
                                borderWidth={1}
                                borderColor="gray.700"
                            >
                                <Flex justify="space-between" align="center" textAlign="center" fontSize="20px" color="#FEDF56">
                                    <HStack justify="center" align="center">
                                        <Text color="gray.400">Strike Price: </Text>
                                        <Text fontWeight="bold">{strikePrice} USD</Text>
                                    </HStack>
                                </Flex>

                                {/* Show Final Price in Maturity and Expiry phases */}
                                {(currentPhase === Phase.Maturity || currentPhase === Phase.Expiry) && (
                                    <Flex justify="space-between" align="center" mt={2} textAlign="center" fontSize="20px" color="#FEDF56">
                                        <Text color="gray.400">Final Price: </Text>
                                        <Text fontWeight="bold" color="white">{finalPrice} USD</Text>
                                    </Flex>
                                )}

                                {reward > 0 && currentPhase === Phase.Expiry && (
                                    <Button
                                        onClick={claimReward}
                                        colorScheme="yellow"
                                        bg="#FEDF56"
                                        color="black"
                                        _hover={{ bg: "#FFE56B" }}
                                        isDisabled={reward === 0}
                                        width="100%"
                                        mt={4}
                                    >
                                        Claim {reward.toFixed(4)} ICP
                                    </Button>
                                )}
                            </Box>

                            <Box
                                bg="gray.800"
                                p={4}
                                borderRadius="xl"
                                mb={6}
                                borderWidth={1}
                                borderColor="gray.700"
                            >
                                {/* LONG/SHORT Ratio */}
                                <Flex
                                    align="center"
                                    w="100%"
                                    h="25px"
                                    borderRadius="full"
                                    bg="gray.800"
                                    border="5px solid"
                                    borderColor="gray.400"
                                    position="relative"
                                    overflow="hidden"
                                    boxShadow="inset 0 1px 3px rgba(0,0,0,0.6)"
                                    mb={4}
                                    p={0}
                                >
                                    {/* LONG Section */}
                                    <Box
                                        width={`${longPercentage}%`}
                                        bgGradient="linear(to-r, #00ea00, #56ff56, #efef8b)"
                                        transition="width 0.6s ease"
                                        h="full"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="flex-end"
                                        pr={3}
                                        position="relative"
                                        zIndex={1}
                                    >
                                        {longPercentage > 8 && (
                                            <Text
                                                fontSize="sm"
                                                fontWeight="bold"
                                                color="whiteAlpha.800"
                                            >
                                                {longPercentage.toFixed(0)}%
                                            </Text>
                                        )}
                                    </Box>

                                    {/* SHORT Section */}
                                    <Box
                                        position="absolute"
                                        right="0"
                                        top="0"
                                        h="100%"
                                        width={`${shortPercentage}%`}
                                        bgGradient="linear(to-r, #FF6B81, #D5006D)"
                                        transition="width 0.6s ease"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="flex-start"
                                        pl={3}
                                        zIndex={0}
                                    >
                                        {shortPercentage > 8 && (
                                            <Text
                                                fontSize="sm"
                                                fontWeight="bold"
                                                color="whiteAlpha.800"
                                            >
                                                {shortPercentage.toFixed(0)}%
                                            </Text>
                                        )}
                                    </Box>
                                </Flex>

                                <Text textAlign="center" fontSize="md" mb={4} color="gray.400">You're betting</Text>

                                <HStack spacing={4} mb={3} ml={2} mr={2}>
                                    <Button
                                        border="1px solid"
                                        borderColor="gray.300"
                                        borderRadius="20px"
                                        colorScheme="gray"
                                        bg="gray.800"
                                        width="50%"
                                        onClick={() => setSelectedSide(Side.Long)}
                                        leftIcon={<FaArrowUp />}
                                        textColor="#28a745"
                                        textShadow="1px 1px 12px rgba(40, 167, 69, 0.7)"
                                        isDisabled={currentPhase !== Phase.Bidding}
                                        _hover={{
                                            bg: "gray.700",
                                            boxShadow: "0 4px 8px rgba(40, 167, 69, 0.2)",
                                        }}
                                        _active={{
                                            bg: "#cececc",
                                        }}
                                        isActive={selectedSide === Side.Long}
                                    >
                                        UP
                                    </Button>
                                    <Button
                                        border="1px solid"
                                        borderColor="gray.300"
                                        borderRadius="20px"
                                        colorScheme="gray"
                                        bg="gray.800"
                                        width="50%"
                                        onClick={() => setSelectedSide(Side.Short)}
                                        leftIcon={<FaArrowDown />}
                                        textColor="#dc3545"
                                        textShadow="1px 1px 12px rgba(220, 53, 69, 0.7)"
                                        isDisabled={currentPhase !== Phase.Bidding}
                                        _hover={{
                                            bg: "gray.700",
                                            boxShadow: "0 4px 8px rgba(220, 53, 69, 0.2)",
                                        }}
                                        _active={{
                                            bg: "#cececc",
                                        }}
                                        isActive={selectedSide === Side.Short}
                                    >
                                        DOWN
                                    </Button>
                                </HStack>

                                <FormControl mb={2} mt={6} color="white">
                                    <FormLabel>You're betting</FormLabel>
                                    <Input
                                        placeholder="Enter amount in ICP"
                                        bg="gray.800"
                                        color="white"
                                        borderColor="blue.400"
                                        borderWidth="1px"
                                        borderRadius="full"
                                        height="50px"
                                        fontSize="md"
                                        width="100%"
                                        px={4}
                                        mb={3}
                                        _hover={{
                                            borderColor: "#63B3ED",
                                        }}
                                        _focus={{
                                            borderColor: "#FEDF56",
                                            boxShadow: "0 0 0 1px #FEDF56",
                                        }}
                                        value={bidAmount}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (/^\d*\.?\d*$/.test(value)) setBidAmount(value);
                                        }}
                                    />
                                </FormControl>

                                <HStack spacing={2} mt={1} mb={2} ml={2} mr={2} alignItems="center" justifyContent="center">
                                    <Button
                                        colorScheme="#0040C1"
                                        bg="#0040C1"
                                        color="white"
                                        _hover={{ bg: "#0040C1" }}
                                        width="100%"
                                        py={6}
                                        mb={3}
                                        ml={2}
                                        mr={2}
                                        onClick={() => handleBid(selectedSide || Side.Long, Number(bidAmount))}
                                        isDisabled={!bidAmount || Number(bidAmount) <= 0 || selectedSide === null || currentPhase !== Phase.Bidding}
                                    >
                                        Betting to rich
                                    </Button>
                                </HStack>

                                <Divider my={4} />

                                <Text fontSize="sm" color="gray.400" mb={1}>Pot. profit: {totalDeposited > 0 ? "0.0000 -> 0.0000 ICP" : "N/A"}</Text>
                                <Text fontSize="sm" color="gray.400" mb={4}>Fee: 6.8%</Text>

                                {/* Your Position */}
                                <Box
                                    bg="#0A0B0E"
                                    p={4}
                                    borderRadius="xl"
                                    borderWidth={1}
                                    borderColor="rgba(255, 255, 255, 0.05)"
                                    mb={6}
                                >
                                    <Text fontSize="md" fontWeight="bold" color="#FEDF56" mb={2}>Your Position</Text>
                                    <HStack justify="space-between" mb={1}>
                                        <Text color="#56ff56">LONG:</Text>
                                        <Text color="white">{positions.long.toFixed(4)} ICP</Text>
                                    </HStack>
                                    <HStack justify="space-between">
                                        <Text color="#FF6B81">SHORT:</Text>
                                        <Text color="white">{positions.short.toFixed(4)} ICP</Text>
                                    </HStack>
                                </Box>
                            </Box>

                            {/* Market Timeline */}
                            <Box
                                bg="#222530"
                                p={4}
                                borderWidth={1}
                                borderColor="rgba(255, 255, 255, 0.05)"
                                borderRadius="30px"
                                position="relative"
                                height="320px"
                            >
                                <Text fontSize="2xl" fontWeight="bold" mb={4} mt={2} color="white" textAlign="center">
                                    Market is Live
                                </Text>

                                <Box
                                    bg="#0B0E16"
                                    p={4}
                                    borderRadius="30px"
                                    borderWidth={1}
                                    borderColor="rgba(255, 255, 255, 0.05)"
                                    position="absolute"
                                    top="70px"
                                    left="0"
                                    right="0"
                                    zIndex={1}
                                >
                                    <VStack align="stretch" spacing={3} position="relative">
                                        {/* Vertical Line */}
                                        <Box
                                            position="absolute"
                                            left="16px"
                                            top="30px"
                                            bottom="20px"
                                            width="2px"
                                            bg="rgba(255, 255, 255, 0.1)"
                                            zIndex={0}
                                        />

                                        {/* Trading Phase */}
                                        <HStack spacing={4}>
                                            <Circle size="35px" bg={currentPhase >= Phase.Bidding ? "#4A63C8" : "rgba(255, 255, 255, 0.1)"} color="white" zIndex={1} fontWeight="bold">
                                                {currentPhase >= Phase.Bidding ? <CheckIcon boxSize={4} /> : '1'}
                                            </Circle>
                                            <VStack align="start" spacing={0} fontWeight="bold">
                                                <Text fontSize="lg" color={currentPhase === Phase.Trading ? "#56ff56" : "rgba(255, 255, 255, 0.5)"}>
                                                    Trading
                                                </Text>
                                                <Text fontSize="xs" color="rgba(255, 255, 255, 0.5)">
                                                    {endTimestamp ? new Date((Number(endTimestamp) - 86400) * 1000).toLocaleString() : 'Pending'}
                                                </Text>
                                            </VStack>
                                            <Spacer />
                                            {currentPhase === Phase.Trading && (
                                                <Button
                                                    colorScheme="green"
                                                    size="md"
                                                    leftIcon={<FaChartLine />}
                                                    onClick={() => {
                                                        if (marketService) {
                                                            marketService.startTrading()
                                                                .then(() => {
                                                                    toast({
                                                                        title: "Market moved to Bidding phase",
                                                                        status: "success",
                                                                        duration: 5000,
                                                                    });
                                                                    // Refresh data after state change
                                                                    fetchMarketDetails();

                                                                    // Update UI immediately to show phase transition
                                                                    setCurrentPhase(Phase.Bidding);
                                                                    console.log("Phase changed to Bidding");
                                                                })
                                                                .catch(error => {
                                                                    toast({
                                                                        title: "Error",
                                                                        description: error.toString(),
                                                                        status: "error",
                                                                        duration: 5000,
                                                                    });
                                                                });
                                                        }
                                                    }}
                                                >
                                                    Start Trading
                                                </Button>
                                            )}
                                        </HStack>

                                        {/* Bidding Phase */}
                                        <HStack spacing={4}>
                                            <Circle size="35px" bg={currentPhase >= Phase.Maturity ? "#4A63C8" : "rgba(255, 255, 255, 0.1)"} color="white" zIndex={1} fontWeight="bold">
                                                {currentPhase >= Phase.Maturity ? <CheckIcon boxSize={4} /> : '2'}
                                            </Circle>
                                            <VStack align="start" spacing={0} fontWeight="bold">
                                                <Text fontSize="lg" color={currentPhase === Phase.Bidding ? "#4A63C8" : "rgba(255, 255, 255, 0.5)"}>
                                                    Bidding
                                                </Text>
                                                <Text fontSize="xs" color="rgba(255, 255, 255, 0.5)">
                                                    {endTimestamp ? new Date((Number(endTimestamp) - 43200) * 1000).toLocaleString() : 'Waiting'}
                                                </Text>
                                            </VStack>
                                            <Spacer />
                                            {currentPhase === Phase.Bidding && (
                                                <Button
                                                    onClick={async () => {
                                                        try {
                                                            if (marketService) {
                                                                await marketService.resolveMarket();
                                                                await fetchMarketDetails();
                                                            }
                                                        } catch (error) {
                                                            console.error("Error resolving market:", error);
                                                        }
                                                    }}
                                                    size="sm"
                                                    colorScheme="yellow"
                                                    bg="#FEDF56"
                                                    color="black"
                                                    _hover={{ bg: "#FFE56B" }}
                                                    width="35%"
                                                >
                                                    Resolve
                                                </Button>
                                            )}
                                        </HStack>

                                        {/* Maturity Phase */}
                                        <HStack spacing={4} justify="space-between">
                                            <HStack spacing={4}>
                                                <Circle size="35px" bg={currentPhase >= Phase.Expiry ? "#4A63C8" : "rgba(255, 255, 255, 0.1)"} color="white" zIndex={1} fontWeight="bold">
                                                    {currentPhase >= Phase.Expiry ? <CheckIcon boxSize={4} /> : '3'}
                                                </Circle>
                                                <VStack align="start" spacing={0} fontWeight="bold">
                                                    <Text fontSize="lg" color={currentPhase === Phase.Maturity ? "#FEDF56" : "rgba(255, 255, 255, 0.5)"}>
                                                        Maturity
                                                    </Text>
                                                    <Text fontSize="xs" color="rgba(255, 255, 255, 0.5)">
                                                        {endTimestamp ? new Date(Number(endTimestamp) * 1000).toLocaleString() : 'Pending'}
                                                    </Text>
                                                </VStack>
                                            </HStack>
                                            <Spacer />
                                            {currentPhase === Phase.Maturity && finalPrice && (
                                                <Button
                                                    onClick={async () => {
                                                        try {
                                                            if (marketService) {
                                                                await marketService.expireMarket();
                                                                await fetchMarketDetails();
                                                            }
                                                        } catch (error) {
                                                            console.error("Error expiring market:", error);
                                                        }
                                                    }}
                                                    size="sm"
                                                    colorScheme="yellow"
                                                    bg="#FEDF56"
                                                    color="black"
                                                    _hover={{ bg: "#FFE56B" }}
                                                    width="35%"
                                                >
                                                    Expire
                                                </Button>
                                            )}
                                        </HStack>

                                        {/* Expiry Phase */}
                                        <HStack spacing={4}>
                                            <Circle size="35px" bg="blue.400" color="black" zIndex={1} fontWeight="bold">4</Circle>
                                            <VStack align="start" spacing={0} fontWeight="bold">
                                                <Text fontSize="lg" color={currentPhase === Phase.Expiry ? "red.400" : "gray.500"}>
                                                    Expiry
                                                </Text>
                                                <Text fontSize="xs" color="gray.500">
                                                    {endTimestamp ? new Date((Number(endTimestamp) + 3600) * 1000).toLocaleString() : 'Pending'}
                                                </Text>
                                            </VStack>
                                        </HStack>
                                    </VStack>
                                </Box>
                            </Box>
                        </Box>
                    </Flex>
                </>
            )}
            {showResult && (
                <Box
                    position="fixed"
                    bottom={4}
                    left="50%"
                    transform="translateX(-50%)"
                    bg={resultMessage === "YOU WIN" ? "green.500" : "red.500"}
                    color="white"
                    px={6}
                    py={3}
                    borderRadius="md"
                    boxShadow="lg"
                >
                    {resultMessage}
                </Box>
            )}
        </Flex>
    );
}

export default Customer;
