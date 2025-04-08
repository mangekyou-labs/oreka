import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Container,
    Heading,
    Text,
    VStack,
    HStack,
    useToast,
    Spinner,
    Badge,
    Divider,
} from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { AuthClient } from '@dfinity/auth-client';
import { BinaryOptionMarketService } from '../service/binary-option-market-service';
import { setActorIdentity } from '../service/actor-locator';
import Navbar from '../components/Navbar';

// Simple admin page for market management
const Admin = () => {
    const [loading, setLoading] = useState(true);
    const [marketId, setMarketId] = useState('');
    const [marketPhase, setMarketPhase] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState({ success: false, message: '' });
    const [showResult, setShowResult] = useState(false);

    const router = useRouter();
    const toast = useToast();
    const marketService = BinaryOptionMarketService.getInstance();

    // Initialize on page load
    useEffect(() => {
        async function init() {
            try {
                // Check for authentication
                const authClient = await AuthClient.create();
                if (!(await authClient.isAuthenticated())) {
                    router.push('/');
                    return;
                }

                // Set identity
                const identity = authClient.getIdentity();
                await setActorIdentity(identity);

                // Get market ID from URL
                const params = new URLSearchParams(window.location.search);
                const id = params.get('marketId');

                if (!id) {
                    toast({
                        title: "No market selected",
                        description: "Please select a market first",
                        status: "warning",
                        duration: 5000,
                        isClosable: true
                    });
                    router.push('/');
                    return;
                }

                setMarketId(id);

                // Initialize market service
                await marketService.initialize(id);

                // Get current phase
                const phase = await marketService.getCurrentPhase();

                // Set phase string
                if ('Trading' in phase) setMarketPhase('Trading');
                else if ('Bidding' in phase) setMarketPhase('Bidding');
                else if ('Maturity' in phase) setMarketPhase('Maturity');
                else if ('Expiry' in phase) setMarketPhase('Expiry');
                else setMarketPhase('Unknown');
            } catch (error) {
                console.error("Error initializing:", error);
                toast({
                    title: "Error",
                    description: "Failed to initialize page",
                    status: "error",
                    duration: 5000,
                    isClosable: true
                });
            } finally {
                setLoading(false);
            }
        }

        init();
    }, [router, toast]);

    // Start trading action
    const startTrading = async () => {
        setIsProcessing(true);
        setShowResult(false);

        try {
            await marketService.startTrading();
            setMarketPhase('Trading');
            setResult({
                success: true,
                message: "Trading started successfully"
            });

            toast({
                title: "Success",
                description: "Trading phase started",
                status: "success",
                duration: 3000,
                isClosable: true
            });
        } catch (error) {
            console.error("Error starting trading:", error);
            setResult({
                success: false,
                message: "Failed to start trading: " + (error instanceof Error ? error.message : String(error))
            });

            toast({
                title: "Error",
                description: "Failed to start trading",
                status: "error",
                duration: 5000,
                isClosable: true
            });
        } finally {
            setIsProcessing(false);
            setShowResult(true);
        }
    };

    // Resolve market action
    const resolveMarket = async () => {
        setIsProcessing(true);
        setShowResult(false);

        try {
            await marketService.resolveMarket();
            setMarketPhase('Maturity');
            setResult({
                success: true,
                message: "Market resolved successfully"
            });

            toast({
                title: "Success",
                description: "Market resolved",
                status: "success",
                duration: 3000,
                isClosable: true
            });
        } catch (error) {
            console.error("Error resolving market:", error);
            setResult({
                success: false,
                message: "Failed to resolve market: " + (error instanceof Error ? error.message : String(error))
            });

            toast({
                title: "Error",
                description: "Failed to resolve market",
                status: "error",
                duration: 5000,
                isClosable: true
            });
        } finally {
            setIsProcessing(false);
            setShowResult(true);
        }
    };

    // Expire market action
    const expireMarket = async () => {
        setIsProcessing(true);
        setShowResult(false);

        try {
            await marketService.expireMarket();
            setMarketPhase('Expiry');
            setResult({
                success: true,
                message: "Market expired successfully"
            });

            toast({
                title: "Success",
                description: "Market expired",
                status: "success",
                duration: 3000,
                isClosable: true
            });
        } catch (error) {
            console.error("Error expiring market:", error);
            setResult({
                success: false,
                message: "Failed to expire market: " + (error instanceof Error ? error.message : String(error))
            });

            toast({
                title: "Error",
                description: "Failed to expire market",
                status: "error",
                duration: 5000,
                isClosable: true
            });
        } finally {
            setIsProcessing(false);
            setShowResult(true);
        }
    };

    // Helper for phase badge color
    const getPhaseColor = (phase: string): string => {
        switch (phase) {
            case 'Trading': return 'green';
            case 'Bidding': return 'blue';
            case 'Maturity': return 'orange';
            case 'Expiry': return 'red';
            default: return 'gray';
        }
    };

    if (loading) {
        return (
            <Container maxW="container.lg" py={4}>
                <Navbar />
                <Box textAlign="center" pt={10}>
                    <Spinner size="xl" />
                    <Text mt={4}>Loading market information...</Text>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxW="container.lg" py={4}>
            <Navbar />

            <Heading as="h1" size="lg" mb={6}>Market Admin</Heading>

            <Box p={5} borderWidth="1px" borderRadius="md" mb={6}>
                <Heading as="h2" size="md" mb={4}>Market Information</Heading>

                <VStack align="start" spacing={3}>
                    <HStack width="100%" justify="space-between">
                        <Text fontWeight="bold">Current Phase:</Text>
                        <Badge colorScheme={getPhaseColor(marketPhase)} fontSize="md" px={2} py={1}>
                            {marketPhase}
                        </Badge>
                    </HStack>

                    <HStack width="100%" justify="space-between">
                        <Text fontWeight="bold">Market ID:</Text>
                        <Text fontSize="sm" fontFamily="monospace" maxW="60%" isTruncated>
                            {marketId}
                        </Text>
                    </HStack>
                </VStack>
            </Box>

            <Box p={5} borderWidth="1px" borderRadius="md">
                <Heading as="h2" size="md" mb={4}>Admin Actions</Heading>

                <VStack spacing={4}>
                    <Button
                        colorScheme="green"
                        width="full"
                        onClick={startTrading}
                        isLoading={isProcessing}
                        loadingText="Processing..."
                        isDisabled={marketPhase !== 'Trading' || isProcessing}
                    >
                        Start Trading
                    </Button>

                    <Button
                        colorScheme="blue"
                        width="full"
                        onClick={resolveMarket}
                        isLoading={isProcessing}
                        loadingText="Processing..."
                        isDisabled={marketPhase !== 'Trading' || isProcessing}
                    >
                        Resolve Market
                    </Button>

                    <Button
                        colorScheme="red"
                        width="full"
                        onClick={expireMarket}
                        isLoading={isProcessing}
                        loadingText="Processing..."
                        isDisabled={marketPhase !== 'Maturity' || isProcessing}
                    >
                        Expire Market
                    </Button>
                </VStack>

                {showResult && (
                    <>
                        <Divider my={4} />

                        <Box
                            p={3}
                            borderRadius="md"
                            bg={result.success ? "green.50" : "red.50"}
                            color={result.success ? "green.700" : "red.700"}
                        >
                            {result.message}
                        </Box>
                    </>
                )}
            </Box>
        </Container>
    );
};

export default Admin; 