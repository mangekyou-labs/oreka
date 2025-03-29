import React, { useState, useEffect, useRef } from 'react';
import { useCallback } from 'react'; // Thêm import useCallback
import {
    Flex, Box, Text, Button, VStack, useToast, Input,
    Select, HStack, Icon, ScaleFade, Table, Thead, Tbody, Tr, Th, Td
} from '@chakra-ui/react';
import { FaEthereum, FaWallet, FaTrophy } from 'react-icons/fa';

import { motion, useAnimation } from 'framer-motion';
import { useRouter } from 'next/router';
import { BinaryOptionMarketService, IBinaryOptionMarketService } from '../service/binary-option-market-service';
import { Principal } from '@dfinity/principal';
import { current } from '@reduxjs/toolkit';
import { AuthClient } from '@dfinity/auth-client';
import { setActorIdentity, setIcpLedgerIdentity } from '../service/actor-locator';
import { IIcpLedgerService, IcpLedgerService } from '../service/icp-ledger-service';

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

    const [authenticated, setAuthenticated] = useState(false);

    const [endTimestamp, setEndTimestamp] = useState<number | null>(null);

    const [availableCoins] = useState<Coin[]>([
        { value: "0x5fbdb2315678afecb367f032d93f642f64180aa3", label: "ICP/USD" },
        { value: "0x6fbdb2315678afecb367f032d93f642f64180aa3", label: "ETH/USD" },
        { value: "0x7fbdb2315678afecb367f032d93f642f64180aa3", label: "BTC/USD" }
    ]);

    const toast = useToast();
    const priceControls = useAnimation();
    const router = useRouter(); // Initialize the router
    const [marketService, setMarketService] = useState<BinaryOptionMarketService | null>(null);
    const [ledgerService, setLedgerService] = useState<IcpLedgerService | null>(null);
    const [shouldCheckRewardClaimability, setShouldCheckRewardClaimability] = useState(false);
    const [identityPrincipal, setIdentityPrincipal] = useState("");
    const [marketId, setMarketId] = useState<string | null>(null);

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
                }
            }
        }
    }, [marketId]);

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

    useEffect(() => {
        const initService = async () => {
            const authClient = await AuthClient.create();
            const identity = authClient.getIdentity();

            setIcpLedgerIdentity(identity)
            const icpLedgerService = IcpLedgerService.getInstance();
            await icpLedgerService.initialize();
            setLedgerService(icpLedgerService);

            await setActorIdentity(identity)
            const service = BinaryOptionMarketService.getInstance();
            // Initialize with the market ID from the URL if available
            if (marketId) {
                console.log("Initializing market service with canister ID:", marketId);
                await service.initialize(marketId);
            } else {
                await service.initialize();
            }
            setMarketService(service);
        };

        if (authenticated && (!marketService || !ledgerService)) {
            initService();
        }
    }, [authenticated, marketId]);

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

                const userPosition = await marketService.getUserPosition(Principal.fromText(identityPrincipal));

                if (userPosition) {
                    setPositions({ long: Number(userPosition.long) / 10e7, short: Number(userPosition.short) / 10e7 });
                } else {
                    console.error("User position is null. Setting default positions.");
                    setPositions({ long: 0, short: 0 });
                }

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
            if (!marketService || !ledgerService) throw new Error("Service not initialized");

            const phase = await marketService.getCurrentPhase();
            if (!('Bidding' in phase)) {
                throw new Error("Market is not in trading phase");
            }


            const approveResult = await ledgerService.approve({
                spender: {
                    owner: Principal.fromText(process.env.NEXT_PUBLIC_BINARY_OPTION_MARKET_CANISTER_ID ?? ""),
                    subaccount: []
                },
                amount: BigInt((amount * 10e7) + 10e7)
            })

            console.log(approveResult)

            const bidResult = await marketService.bid(
                side === Side.Long ? { Long: null } : { Short: null },
                amount * 10e7
            );

            // @TODO: add a way to handle this
            if (('ok' in bidResult)) {

                setSelectedSide(side)
                toast({
                    title: "Bid successfully!",
                    description: `You've successfully bidded your side.`,
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
            }

            if (('err' in bidResult)) {
                toast({
                    title: "Bid failed!",
                    description: `You broke something`,
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            }

            console.log(bidResult)
        } catch (error) {
            console.error("Error placing bid:", error);
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
        setPositions({ long: 0, short: 0 });
        setTotalDeposited(0);
        setStrikePrice(0); // Đặt lại giá strikePrice mặc định hoặc giá khởi tạo
        setFinalPrice(0);
        setCurrentPhase(Phase.Bidding);
        priceControls.set({ opacity: 1, color: "#FEDF56" });
    };


    const abbreviateAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <Flex direction="column" alignItems="center" justifyContent="flex-start" p={6} bg="black" minH="100vh" position="relative">
            <VStack
                width={{ base: '90%', md: '700px' }}
                spacing={8}
                align="stretch"
                color="#FEDF56"
                fontFamily="Arial, sans-serif"
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
                                >
                                    Claim {reward.toFixed(4)} ICP
                                </Button>
                            )}
                        </HStack>
                    </HStack>
                )}

                {authenticated ? (
                    <>
                        <Select
                            placeholder="Select Coin"
                            onChange={handleCoinSelect}
                            value={selectedCoin?.value || ''}
                            color="black"
                            bg="#FEDF56"
                            size="lg"
                        >
                            {availableCoins.map((coin) => (
                                <option key={coin.value} value={coin.value}>
                                    {coin.label}
                                </option>
                            ))}
                        </Select>
                        {selectedCoin && (
                            <VStack spacing={8} alignItems="center">
                                <Box
                                    border="2px solid #FEDF56"
                                    borderRadius="full"
                                    padding="20px"
                                    width="100%"
                                    textAlign="center"
                                >
                                    <motion.div animate={priceControls}>
                                        <Text fontSize="4xl" fontWeight="bold">
                                            {countdown !== null ? "" : ((currentPhase === Phase.Maturity || currentPhase === Phase.Expiry) ? finalPrice : strikePrice)}
                                        </Text>
                                    </motion.div>
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
                                            isDisabled={!bidAmount || Number(bidAmount) <= 0 || !selectedCoin || currentPhase !== Phase.Bidding}
                                            bg="#FEDF56"
                                            color="black"
                                            _hover={{ bg: "#D5D5D5", color: "green", transform: "scale(1.2)" }}
                                            width="120px"
                                            height="50px"
                                            fontSize="xl"
                                            transition="all 0.2s"
                                        >
                                            Up
                                        </Button>
                                        <Button
                                            onClick={() => handleBid(Side.Short, Number(bidAmount))}
                                            isDisabled={!bidAmount || Number(bidAmount) <= 0 || !selectedCoin || currentPhase !== Phase.Bidding}
                                            bg="#FEDF56"
                                            color="black"
                                            _hover={{ bg: "#D5D5D5", color: "red", transform: "scale(1.2)" }}
                                            width="120px"
                                            height="50px"
                                            fontSize="xl"
                                            transition="all 0.2s"
                                        >
                                            Down
                                        </Button>
                                    </Flex>

                                    <Table variant="simple" colorScheme="yellow">
                                        <Thead>
                                            <Tr>
                                                <Th color="#FEDF56">Position</Th>
                                                <Th color="#FEDF56" isNumeric>Your Bid</Th>
                                                <Th color="#FEDF56" isNumeric>Total Market</Th>
                                            </Tr>
                                        </Thead>
                                        <Tbody>
                                            <Tr>
                                                <Td>Long</Td>
                                                <Td isNumeric>{positions.long.toFixed(4)} ICP</Td>
                                                <Td isNumeric>{positions.long.toFixed(4)} ICP</Td>
                                            </Tr>
                                            <Tr>
                                                <Td>Short</Td>
                                                <Td isNumeric>{positions.short.toFixed(4)} ICP</Td>
                                                <Td isNumeric>{positions.short.toFixed(4)} ICP</Td>
                                            </Tr>
                                        </Tbody>
                                    </Table>
                                </VStack>
                            </VStack>
                        )}
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

            {countdown !== null && (
                <Box
                    position="fixed"
                    top="50%"
                    left="50%"
                    transform="translate(-50%, -50%)"
                    bg="rgba(0, 0, 0, 0.8)"
                    color="#FEDF56"
                    fontSize="6xl"
                    fontWeight="bold"
                    p={8}
                    borderRadius="xl"
                    zIndex={1000}
                >
                    {countdown}
                </Box>
            )}
            <ScaleFade initialScale={0.9} in={showResult}>
                <Box
                    position="fixed"
                    top="50%"
                    left="50%"
                    transform="translate(-50%, -50%)"
                    bg={resultMessage === "YOU WIN" ? "green.500" : "red.500"}
                    color="white"
                    fontSize="5xl"
                    fontWeight="bold"
                    p={8}
                    borderRadius="xl"
                    zIndex={1000}
                >
                    {resultMessage}
                </Box>
            </ScaleFade>
        </Flex>
    );
}

export default Customer;
