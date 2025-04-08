import React, { useState, useEffect, useRef } from 'react';
import { useCallback } from 'react'; // Thêm import useCallback
import {
    Flex, Box, Text, Button, VStack, useToast, Input,
    Select, HStack, Icon, ScaleFade, Table, Thead, Tbody, Tr, Th, Td, TableContainer
} from '@chakra-ui/react';
import { FaEthereum, FaWallet, FaTrophy } from 'react-icons/fa';

import { useRouter } from 'next/router';
import { BinaryOptionMarketService, IBinaryOptionMarketService } from '../service/binary-option-market-service';
import { Principal } from '@dfinity/principal';
import { current } from '@reduxjs/toolkit';
import { AuthClient } from '@dfinity/auth-client';
import { setActorIdentity, setIcpLedgerIdentity } from '../service/actor-locator';
import { IIcpLedgerService, IcpLedgerService } from '../service/icp-ledger-service';

// Add typings import for ICRC1 Account
import type { Account as ICRC1Account } from '../service/icp-ledger-service';

// Add import for FactoryService
import { FactoryService, MarketInfo } from '../service/factory-service';

enum Side { Long, Short }
enum Phase { Bidding, Trading, Maturity, Expiry }

interface Coin {
    value: string;
    label: string;
}

function Customer() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [selectedSide, setSelectedSide] = useState<Side | null>(null);
    const [walletAddress, setWalletAddress] = useState<string>("");
    const [balance, setBalance] = useState("0");
    const [contractBalance, setContractBalance] = useState(0);
    const [accumulatedWinnings, setAccumulatedWinnings] = useState(0);
    const [bidAmount, setBidAmount] = useState("");
    const [currentPhase, setCurrentPhase] = useState<Phase>(Phase.Trading);
    //const [positions, setPositions] = useState({ long: 0, short: 0 });
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

    const [availableCoins] = useState<Coin[]>([
        { value: "0x5fbdb2315678afecb367f032d93f642f64180aa3", label: "ICP/USD" },
        { value: "0x6fbdb2315678afecb367f032d93f642f64180aa3", label: "ETH/USD" },
        { value: "0x7fbdb2315678afecb367f032d93f642f64180aa3", label: "BTC/USD" }
    ]);

    const toast = useToast();
    const router = useRouter(); // Initialize the router
    const [marketService, setMarketService] = useState<BinaryOptionMarketService | null>(null);
    const [ledgerService, setLedgerService] = useState<IcpLedgerService | null>(null);
    const [shouldCheckRewardClaimability, setShouldCheckRewardClaimability] = useState(false);
    const [identityPrincipal, setIdentityPrincipal] = useState("");
    const [marketId, setMarketId] = useState<string | null>(null);

    // Add a state to track if we need to show the market selection view
    const [showMarketSelection, setShowMarketSelection] = useState(false);
    const [factoryService, setFactoryService] = useState<FactoryService | null>(null);
    const [availableMarkets, setAvailableMarkets] = useState<MarketInfo[]>([]);

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

    useEffect(() => {
        // Check for marketId in the URL query parameters
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const marketIdFromUrl = params.get('marketId');

            if (marketIdFromUrl) {
                console.log("Market ID from URL:", marketIdFromUrl);
                // Only set if changed to avoid unnecessary reloads
                if (marketId !== marketIdFromUrl) {
                    setMarketId(marketIdFromUrl);
                    setShowMarketSelection(false);
                }
            } else {
                // No market ID in URL, always show market selection first
                console.log("No market ID available, showing market selection");
                setShowMarketSelection(true);
                setMarketId(null);
            }
        }
    }, [marketId, router]);

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
            const authClient = await AuthClient.create();
            const identity = authClient.getIdentity();

            // Initialize factory service first
            const factory = FactoryService.getInstance();
            await factory.initialize();
            setFactoryService(factory);

            // Initialize other services as before
            setIcpLedgerIdentity(identity)
            const icpLedgerService = IcpLedgerService.getInstance();
            await icpLedgerService.initialize();
            setLedgerService(icpLedgerService);

            await setActorIdentity(identity)
            const service = BinaryOptionMarketService.getInstance();

            // Only initialize market service if we have a market ID
            if (marketId) {
                console.log("Initializing market service with canister ID:", marketId);
                await service.initialize(marketId);
                setShowMarketSelection(false);
            } else {
                // If no market ID, fetch available markets and show selection
                console.log("No market ID, showing selection");
                setShowMarketSelection(true);
                const markets = await factory.getMarkets();
                setAvailableMarkets(markets);
            }

            setMarketService(service);
        };

        if (authenticated && (!factoryService || !marketService || !ledgerService)) {
            initServices();
        }
    }, [authenticated, marketId]);

    // Fetch markets when showing selection view
    useEffect(() => {
        if (showMarketSelection && factoryService) {
            fetchAvailableMarkets();
        }
    }, [showMarketSelection, factoryService, fetchAvailableMarkets]);

    const fetchMarketDetails = useCallback(async () => {
        if (marketService) {
            try {

                const phaseState = await marketService.getCurrentPhase();
                //@TODO: Make this a function
                if (('Trading' in phaseState)) {
                    setCurrentPhase(Phase.Trading);
                } else if (('Bidding' in phaseState)) {
                    setCurrentPhase(Phase.Bidding);
                } else if (('Maturity' in phaseState)) {
                    setCurrentPhase(Phase.Maturity);
                } else if (('Expiry' in phaseState)) {
                    setCurrentPhase(Phase.Expiry);
                }


                const marketDetails = await marketService.getMarketDetails()


                const strikePrice = marketDetails.oracleDetails.strikePrice;
                const finalPrice = marketDetails.oracleDetails.finalPrice;


                setStrikePrice(strikePrice); // Giả định 8 số thập phân
                setFinalPrice(finalPrice);   // Giả định 8 số thập phân

                // Get user position
                const userPosition = await marketService.getUserPosition(Principal.fromText(identityPrincipal));
                if (userPosition) {
                    setPositions({ long: Number(userPosition.long) / 10e7, short: Number(userPosition.short) / 10e7 });
                } else {
                    console.error("User position is null. Setting default positions.");
                    setPositions({ long: 0, short: 0 });
                }

                // Get total market positions
                setTotalMarketPositions({
                    long: Number(marketDetails.positions.long) / 10e7,
                    short: Number(marketDetails.positions.short) / 10e7
                });

                const totalDeposit = await marketService.getTotalDeposit()
                setTotalDeposited(Number(totalDeposit) / 10e7)

                if (currentPhase === Phase.Expiry) {
                    setShouldCheckRewardClaimability(true);
                }

                const timestamp = await marketService.getEndTimestamp();
                if (timestamp) {
                    console.log("timestamp in seconds:", timestamp);
                    setEndTimestamp(Number(timestamp));  // No need for conversion since it's already in seconds
                }
            } catch (error: any) {
                console.error("Error fetching market details:", error);
            }
        }

        if (ledgerService) {
            const userBalance = await ledgerService.getBalance({ owner: Principal.fromText(identityPrincipal), subaccount: [] })
            console.log(userBalance);
            setBalance((Number(userBalance) / 10e7).toFixed(4).toString())
        }
    }, [marketService, currentPhase, ledgerService]);

    const setInitialIdentity = async () => {
        try {
            const authClient = await AuthClient.create();
            const identity = authClient.getIdentity();
            const isAuthenticated = await authClient.isAuthenticated()

            if (isAuthenticated) {
                console.log(identity.getPrincipal().toText())
                setIdentityPrincipal(identity.getPrincipal().toText())
                await setActorIdentity(identity)
                await setIcpLedgerIdentity(identity)

                const icpLedgerService = IcpLedgerService.getInstance();
                await icpLedgerService.initialize();
                setLedgerService(icpLedgerService);

                const service = BinaryOptionMarketService.getInstance();
                await service.initialize();
                setMarketService(service);
            }

            setAuthenticated(isAuthenticated);
        } catch (error) {
            console.error(error);
        }
    }

    useEffect(() => {
        // prevent server-side rendering
        if (typeof window !== 'undefined') {
            setInitialIdentity();
        }
    }, []);

    const signIn = async () => {
        const authClient = await AuthClient.create();

        const internetIdentityUrl = (process.env.NODE_ENV == "production")
            ? `https://identity.ic0.app` :
            `http://${process.env.NEXT_PUBLIC_INTERNET_IDENTITY_CANISTER_ID}.localhost:4943`;

        await new Promise((resolve) => {
            authClient.login({
                identityProvider: internetIdentityUrl,
                onSuccess: () => resolve(undefined),
            });
        });

        const identity = authClient.getIdentity();
        setActorIdentity(identity);
        const isAuthenticated = await authClient.isAuthenticated();
        console.log(isAuthenticated);
        setIdentityPrincipal(identity.getPrincipal().toText())
        setAuthenticated(isAuthenticated);
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
        router.push(`?marketId=${marketId}`);
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
                                    router.push(`?marketId=${market.id}`);
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

    return (
        <Flex direction="column" alignItems="center" justifyContent="flex-start" p={6} bg="black" minH="100vh" position="relative">
            {showMarketSelection ? (
                renderMarketSelection()
            ) : (
                <VStack
                    width={{ base: '90%', md: '700px' }}
                    spacing={8}
                    align="stretch"
                >
                    {authenticated && (
                        <HStack spacing={4} justify="space-between" width="100%">
                            <HStack>
                                <Icon as={FaWallet} />
                                <Text>{abbreviateAddress(identityPrincipal)}</Text>
                            </HStack>
                            <HStack>
                                <Icon as={FaEthereum} />
                                <Text>{balance} ICP</Text>
                            </HStack>
                            <HStack>
                                {/* <Icon as={FaTrophy} />
              <Text>{accumulatedWinnings.toFixed(4)} ETH</Text> */}
                                {reward > 0 && showClaimButton && (
                                    <Button onClick={claimReward} size="sm" colorScheme="yellow" variant="outline"
                                        isDisabled={reward === 0}
                                        borderRadius="full"
                                    >
                                        Claim {reward.toFixed(4)} ICP
                                    </Button>
                                )}
                            </HStack>
                        </HStack>
                    )}

                    {authenticated ? (
                        <>
                            <VStack spacing={8} alignItems="center">
                                <Box
                                    border="2px solid #FEDF56"
                                    borderRadius="full"
                                    padding="20px"
                                    width="100%"
                                    textAlign="center"
                                >
                                    <Box textAlign="center">
                                        <Text fontSize="4xl" fontWeight="bold">
                                            {getDisplayPrice()}
                                        </Text>
                                    </Box>
                                </Box>
                                <VStack spacing={2}>
                                    <Text fontSize="lg">Current Phase: {Phase[currentPhase]}</Text>
                                    <Text fontSize="lg">Total Deposited: {totalDeposited.toFixed(4)} ICP</Text>
                                    {endTimestamp && (
                                        <Text
                                            fontSize="lg"
                                            color={formatTimeRemaining(endTimestamp) === "Expired" ? "red.500" : "#FEDF56"}
                                        >
                                            {formatTimeRemaining(endTimestamp) === "Expired"
                                                ? "Market Expired"
                                                : `Expires in: ${formatTimeRemaining(endTimestamp)}`
                                            }
                                        </Text>
                                    )}
                                </VStack>

                                <VStack spacing={8} width="100%">
                                    <Input
                                        placeholder="Enter bid amount in ICP"
                                        value={bidAmount}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (/^\d*\.?\d*$/.test(value)) setBidAmount(value);
                                        }}
                                        color="#FEDF56"
                                        bg="transparent"
                                        border="none"
                                        textAlign="center"
                                        _placeholder={{ color: "#FEDF56" }}
                                        size="lg"
                                        fontSize="xl"
                                    />

                                    <Flex justify="center" gap="100px">
                                        <Button
                                            onClick={() => handleBid(Side.Long, Number(bidAmount))}
                                            isDisabled={!bidAmount || Number(bidAmount) <= 0 || currentPhase !== Phase.Bidding}
                                            bg="#FEDF56"
                                            color="black"
                                            _hover={{ bg: "#D5D5D5", color: "green", transform: "scale(1.2)" }}
                                            width="120px"
                                            height="50px"
                                            fontSize="xl"
                                            transition="all 0.2s"
                                            borderRadius="full"
                                        >
                                            Up
                                        </Button>
                                        <Button
                                            onClick={() => handleBid(Side.Short, Number(bidAmount))}
                                            isDisabled={!bidAmount || Number(bidAmount) <= 0 || currentPhase !== Phase.Bidding}
                                            bg="#FEDF56"
                                            color="black"
                                            _hover={{ bg: "#D5D5D5", color: "red", transform: "scale(1.2)" }}
                                            width="120px"
                                            height="50px"
                                            fontSize="xl"
                                            transition="all 0.2s"
                                            borderRadius="full"
                                        >
                                            Down
                                        </Button>
                                    </Flex>

                                    <Box marginTop="20px" width="100%">
                                        <TableContainer
                                            borderRadius="xl"
                                            overflow="hidden"
                                            border="1px solid rgba(254, 223, 86, 0.3)"
                                            bg="rgba(0, 0, 0, 0.5)"
                                            width="100%"
                                        >
                                            <Table variant="unstyled" width="100%">
                                                <Thead bg="rgba(17, 22, 11, 0.7)">
                                                    <Tr>
                                                        <Th
                                                            color="#FEDF56"
                                                            width="33%"
                                                            textAlign="left"
                                                            borderBottom="none"
                                                            py={4}
                                                            px={6}
                                                            fontWeight="semibold"
                                                        >
                                                            Position
                                                        </Th>
                                                        <Th
                                                            color="#FEDF56"
                                                            width="33%"
                                                            textAlign="center"
                                                            borderBottom="none"
                                                            py={4}
                                                            fontWeight="semibold"
                                                        >
                                                            Your Bid
                                                        </Th>
                                                        <Th
                                                            color="#FEDF56"
                                                            width="33%"
                                                            textAlign="center"
                                                            borderBottom="none"
                                                            py={4}
                                                            pr={6}
                                                            fontWeight="semibold"
                                                        >
                                                            Total Market
                                                        </Th>
                                                    </Tr>
                                                </Thead>
                                                <Tbody>
                                                    <Tr>
                                                        <Td
                                                            color="#FEDF56"
                                                            fontWeight="medium"
                                                            py={4}
                                                            px={6}
                                                            borderTop="1px solid rgba(0, 0, 0, 0.3)"
                                                        >
                                                            Long
                                                        </Td>
                                                        <Td
                                                            color="#FEDF56"
                                                            textAlign="center"
                                                            py={4}
                                                            borderTop="1px solid rgba(0, 0, 0, 0.3)"
                                                        >
                                                            {positions.long.toFixed(4)} ICP
                                                        </Td>
                                                        <Td
                                                            color="#FEDF56"
                                                            textAlign="center"
                                                            py={4}
                                                            pr={6}
                                                            borderTop="1px solid rgba(0, 0, 0, 0.3)"
                                                        >
                                                            {totalMarketPositions.long.toFixed(4)} ICP
                                                        </Td>
                                                    </Tr>
                                                    <Tr>
                                                        <Td
                                                            color="#FEDF56"
                                                            fontWeight="medium"
                                                            py={4}
                                                            px={6}
                                                            borderTop="1px solid rgba(0, 0, 0, 0.3)"
                                                        >
                                                            Short
                                                        </Td>
                                                        <Td
                                                            color="#FEDF56"
                                                            textAlign="center"
                                                            py={4}
                                                            borderTop="1px solid rgba(0, 0, 0, 0.3)"
                                                        >
                                                            {positions.short.toFixed(4)} ICP
                                                        </Td>
                                                        <Td
                                                            color="#FEDF56"
                                                            textAlign="center"
                                                            py={4}
                                                            pr={6}
                                                            borderTop="1px solid rgba(0, 0, 0, 0.3)"
                                                        >
                                                            {totalMarketPositions.short.toFixed(4)} ICP
                                                        </Td>
                                                    </Tr>
                                                </Tbody>
                                            </Table>
                                        </TableContainer>
                                    </Box>
                                </VStack>
                            </VStack>
                        </>
                    ) : (
                        <Button
                            onClick={() => signIn()}
                            backgroundColor="#FEDF56"
                            color="#5D3A1A"
                            _hover={{ backgroundColor: "#D5D5D5" }}
                            padding="25px"
                            borderRadius="full"
                            fontWeight="bold"
                            fontSize="xl"
                            w="full"
                        >
                            Login
                        </Button>
                    )}
                </VStack>
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
