import { useRouter } from 'next/router';
import ListAddressOwner from '../../components/ListAddressOwner';
import { useEffect, useState } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { Box, Center, Spinner, Text, Button, VStack, HStack, useToast, IconButton } from '@chakra-ui/react';
import { CopyIcon } from '@chakra-ui/icons';

const ListAddressPage = () => {
    const router = useRouter();
    const { page } = router.query;
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [principal, setPrincipal] = useState("");
    const toast = useToast();

    // Copy principal to clipboard
    const copyPrincipalToClipboard = () => {
        if (principal) {
            navigator.clipboard.writeText(principal)
                .then(() => {
                    toast({
                        title: "Principal copied to clipboard",
                        status: "success",
                        duration: 2000,
                        isClosable: true,
                    });
                    console.log("Principal copied to clipboard:", principal);
                })
                .catch(err => {
                    console.error("Failed to copy principal:", err);
                    toast({
                        title: "Failed to copy principal",
                        status: "error",
                        duration: 2000,
                        isClosable: true,
                    });
                });
        }
    };

    // Handle login click
    const handleLogin = async () => {
        try {
            const authClient = await AuthClient.create();

            // Determine if we're in development environment and use local II canister
            const isProduction = process.env.NODE_ENV === 'production';
            const iiUrl = isProduction
                ? process.env.NEXT_PUBLIC_II_URL || "https://identity.ic0.app"
                : `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943`;

            console.log("Using II URL:", iiUrl);

            // Start the login flow
            await authClient.login({
                identityProvider: iiUrl,
                onSuccess: () => {
                    // Log principal after login before page reload
                    const identity = authClient.getIdentity();
                    const principalId = identity.getPrincipal().toText();
                    console.log("PRINCIPAL ID AFTER LOGIN:", principalId);
                    console.dir({ principalId });

                    // Refresh the page after successful login
                    window.location.reload();
                }
            });
        } catch (error) {
            console.error("Login failed:", error);
        }
    };

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const authClient = await AuthClient.create();
                const authenticated = await authClient.isAuthenticated();
                setIsAuthenticated(authenticated);

                if (authenticated) {
                    const identity = authClient.getIdentity();
                    const principalId = identity.getPrincipal().toText();
                    setPrincipal(principalId);

                    // Log principal to console - this will be visible in both development and production
                    console.log("CURRENT USER PRINCIPAL ID:", principalId);
                    console.dir({ principalId });

                    // Log principal again with different format to ensure visibility
                    console.log("=== PRINCIPAL ID ===");
                    console.log(principalId);
                    console.log("===================");
                }

                setIsLoading(false);
            } catch (error) {
                console.error("Authentication check failed:", error);
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    if (isLoading) {
        return (
            <Center h="60vh">
                <Spinner size="xl" />
            </Center>
        );
    }

    if (!isAuthenticated) {
        return (
            <Center h="60vh">
                <VStack spacing={4}>
                    <Text fontSize="xl">Please log in to view markets</Text>
                    <Button
                        colorScheme="blue"
                        size="lg"
                        onClick={handleLogin}
                        bgGradient="linear(to-r, #2575fc, #6a11cb)"
                    >
                        Login with Internet Identity
                    </Button>
                </VStack>
            </Center>
        );
    }

    if (!page) {
        return (
            <Center h="60vh">
                <Spinner size="md" />
            </Center>
        );
    }

    const pageNumber = parseInt(page as string, 10);
    const finalPage = isNaN(pageNumber) ? 1 : pageNumber;

    return (
        <Box pt={4} pb={10}>
            {/* Principal display and copy button */}
            <Box bg="#4a63c8" p={4} mb={4} borderRadius="md">
                <HStack spacing={4} justify="space-between">
                    <Text color="white" fontWeight="bold">
                        Your Principal ID:
                    </Text>
                    <HStack>
                        <Text color="white" fontFamily="monospace">
                            {principal}
                        </Text>
                        <Button
                            leftIcon={<CopyIcon />}
                            onClick={copyPrincipalToClipboard}
                            colorScheme="whiteAlpha"
                            size="sm"
                        >
                            Copy
                        </Button>
                    </HStack>
                </HStack>
            </Box>

            <ListAddressOwner ownerAddress={principal} page={finalPage} />
        </Box>
    );
};

export default ListAddressPage; 