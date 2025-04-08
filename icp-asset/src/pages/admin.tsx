import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Container,
    Flex,
    Heading,
    Text,
    VStack,
    HStack,
    useToast,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Divider,
    Spinner,
    Badge,
    Checkbox
} from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { AuthClient } from '@dfinity/auth-client';
import { Principal } from '@dfinity/principal';
import { BinaryOptionMarketService } from '../service/binary-option-market-service';
import { FactoryApiService } from '../service/FactoryService';
import Navbar from '../components/Navbar';
import { setActorIdentity } from '../service/actor-locator';

enum Phase {
    Bidding,
    Trading,
    Maturity,
    Expiry
}

const Admin = () => {
    const [authenticated, setAuthenticated] = useState(false);
    const [marketId, setMarketId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPhase, setCurrentPhase] = useState<Phase | null>(null);
    const [principalId, setPrincipalId] = useState<string>('');
    const [marketService, setMarketService] = useState<BinaryOptionMarketService | null>(null);
    const [factoryService, setFactoryService] = useState<FactoryApiService | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [useFactory, setUseFactory] = useState(true);

    const router = useRouter();
    const toast = useToast();

    // Check authentication and initialize services
    useEffect(() => {
        const init = async () => {
            try {
                const authClient = await AuthClient.create();
                const isAuthenticated = await authClient.isAuthenticated();

                if (isAuthenticated) {
                    const identity = authClient.getIdentity();
                    const principalText = identity.getPrincipal().toText();
                    setPrincipalId(principalText);

                    // Apply the authenticated identity
                    await setActorIdentity(identity);
                    console.log("Authenticated with principal:", principalText);

                    setAuthenticated(true);

                    // Get market ID from URL
                    const params = new URLSearchParams(window.location.search);
                    const marketIdFromUrl = params.get('marketId');

                    if (marketIdFromUrl) {
                        setMarketId(marketIdFromUrl);

                        // Initialize market service
                        const market = BinaryOptionMarketService.getInstance();
                        await market.initialize(marketIdFromUrl);
                        setMarketService(market);

                        // Initialize factory service
                        const factory = new FactoryApiService();
                        setFactoryService(factory);

                        // Get current phase
                        const phase = await market.getCurrentPhase();
                        if ('Trading' in phase) {
                            setCurrentPhase(Phase.Trading);
                        } else if ('Bidding' in phase) {
                            setCurrentPhase(Phase.Bidding);
                        } else if ('Maturity' in phase) {
                            setCurrentPhase(Phase.Maturity);
                        } else if ('Expiry' in phase) {
                            setCurrentPhase(Phase.Expiry);
                        }
                    } else {
                        toast({
                            title: "No market ID",
                            description: "Please select a market first",
                            status: "warning",
                            duration: 5000,
                            isClosable: true,
                        });
                        router.push('/');
                    }
                } else {
                    router.push('/');
                }
            } catch (error) {
                console.error("Initialization error:", error);
                toast({
                    title: "Error",
                    description: "Failed to initialize page",
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [router, toast]);

    const handleStartTrading = async () => {
        if (!marketId) return;

        setActionLoading(true);
        try {
            if (useFactory && factoryService) {
                // Use factory service to call startTrading on behalf of the owner
                console.log("Using factory to call startTrading for market:", marketId);
                const result = await factoryService.startTrading(marketId);

                if (result.ok) {
                    setCurrentPhase(Phase.Bidding);
                    toast({
                        title: "Success",
                        description: "Trading phase started via factory",
                        status: "success",
                        duration: 3000,
                        isClosable: true,
                    });
                } else {
                    throw new Error(result.err || "Unknown error using factory");
                }
            } else if (marketService) {
                // Use direct method call (original approach)
                console.log("Calling startTrading directly on market canister");
                await marketService.startTrading();
                setCurrentPhase(Phase.Bidding);
                toast({
                    title: "Success",
                    description: "Trading phase started",
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
            } else {
                throw new Error("No service available");
            }
        } catch (error) {
            console.error("Start trading error:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            toast({
                title: "Error",
                description: `Failed to start trading: ${errorMessage}`,
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleResolveMarket = async () => {
        if (!marketService) return;

        setActionLoading(true);
        try {
            await marketService.resolveMarket();
            setCurrentPhase(Phase.Maturity);
            toast({
                title: "Success",
                description: "Market resolved successfully",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        } catch (error) {
            console.error("Resolve market error:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            toast({
                title: "Error",
                description: `Failed to resolve market: ${errorMessage}`,
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleExpireMarket = async () => {
        if (!marketService) return;

        setActionLoading(true);
        try {
            await marketService.expireMarket();
            setCurrentPhase(Phase.Expiry);
            toast({
                title: "Success",
                description: "Market expired successfully",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        } catch (error) {
            console.error("Expire market error:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            toast({
                title: "Error",
                description: `Failed to expire market: ${errorMessage}`,
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setActionLoading(false);
        }
    };

    const getPhaseDisplay = () => {
        switch (currentPhase) {
            case Phase.Trading:
                return <Badge colorScheme="blue">Trading</Badge>;
            case Phase.Bidding:
                return <Badge colorScheme="green">Bidding</Badge>;
            case Phase.Maturity:
                return <Badge colorScheme="orange">Maturity</Badge>;
            case Phase.Expiry:
                return <Badge colorScheme="gray">Expiry</Badge>;
            default:
                return <Badge colorScheme="red">Unknown</Badge>;
        }
    };

    if (loading) {
        return (
            <>
                <Navbar />
                <Flex justify="center" align="center" minHeight="calc(100vh - 70px)">
                    <Spinner size="xl" color="#FEDF56" />
                </Flex>
            </>
        );
    }

    if (!authenticated) {
        return (
            <>
                <Navbar />
                <Container maxW="container.md" py={10}>
                    <Alert status="warning" borderRadius="md">
                        <AlertIcon />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            You must be authenticated to access the admin panel.
                        </AlertDescription>
                    </Alert>
                </Container>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <Container maxW="container.md" py={10}>
                <VStack spacing={8} align="stretch">
                    <Box>
                        <Heading size="lg" mb={2}>Market Admin Panel</Heading>
                        <Text color="gray.500">Market ID: {marketId}</Text>
                        <Text color="gray.500">Your Principal ID: {principalId}</Text>
                        <HStack mt={2}>
                            <Text>Current Phase:</Text>
                            {getPhaseDisplay()}
                        </HStack>
                        <Checkbox
                            mt={2}
                            isChecked={useFactory}
                            onChange={(e) => setUseFactory(e.target.checked)}
                            colorScheme="yellow"
                        >
                            Use Factory proxy to call startTrading (recommended)
                        </Checkbox>
                    </Box>

                    <Divider />

                    <Box>
                        <Heading size="md" mb={4}>Market Control</Heading>
                        <VStack spacing={4} align="stretch">
                            <Button
                                colorScheme="blue"
                                onClick={handleStartTrading}
                                isLoading={actionLoading}
                                isDisabled={currentPhase !== Phase.Trading}
                            >
                                Start Trading Phase {useFactory ? "(via Factory)" : "(direct)"}
                            </Button>

                            <Button
                                colorScheme="orange"
                                onClick={handleResolveMarket}
                                isLoading={actionLoading}
                                isDisabled={currentPhase !== Phase.Bidding}
                            >
                                Resolve Market
                            </Button>

                            <Button
                                colorScheme="gray"
                                onClick={handleExpireMarket}
                                isLoading={actionLoading}
                                isDisabled={currentPhase !== Phase.Maturity}
                            >
                                Expire Market
                            </Button>
                        </VStack>
                    </Box>

                    <Divider />

                    <Box>
                        <Alert status="info" borderRadius="md">
                            <AlertIcon />
                            <Box>
                                <AlertTitle>Market Lifecycle</AlertTitle>
                                <AlertDescription>
                                    Trading → Bidding → Maturity → Expiry
                                </AlertDescription>
                            </Box>
                        </Alert>
                        <Alert status="warning" mt={4} borderRadius="md">
                            <AlertIcon />
                            <Box>
                                <AlertTitle>Note</AlertTitle>
                                <AlertDescription>
                                    Using the Factory proxy method is recommended as it will properly authenticate your request as the market owner.
                                </AlertDescription>
                            </Box>
                        </Alert>
                    </Box>
                </VStack>
            </Container>
        </>
    );
};

export default Admin; 