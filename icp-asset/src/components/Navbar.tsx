import React, { useEffect, useState } from 'react';
import { Box, Flex, Link, Spacer, Text, useColorModeValue, Image, HStack, Button } from '@chakra-ui/react';
import { useRouter } from 'next/router';

const Navbar = () => {
    const router = useRouter();
    const [marketId, setMarketId] = useState<string | null>(null);

    useEffect(() => {
        // Get market ID from URL if available
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const id = params.get('marketId');
            setMarketId(id);
        }
    }, [router.asPath]);

    return (
        <Box bg="#0f172a" px={4} py={3} width="100%" borderBottom="1px solid" borderColor="#1e293b" boxShadow="0 2px 10px rgba(0, 0, 0, 0.3)">
            <Flex alignItems="center" maxW="1200px" mx="auto">
                <Flex alignItems="center">
                    <Image src="/images/oreka-logo.png" alt="Oreka Logo" height="35px" mr={2} fallback={
                        <Text fontSize="xl" fontWeight="bold" color="white" bgGradient="linear(to-r, #3182CE, #63B3ED)" bgClip="text">OREKA</Text>
                    } />
                    <Text fontSize="xl" fontWeight="bold" color="white" bgGradient="linear(to-r, #3182CE, #63B3ED)" bgClip="text">
                        Binary Options
                    </Text>
                </Flex>

                <Spacer />

                <HStack spacing={4}>
                    <Button
                        variant="ghost"
                        color="white"
                        fontWeight="medium"
                        _hover={{
                            bgGradient: "linear(to-r, #3182CE, #63B3ED)",
                            color: "white"
                        }}
                        onClick={() => router.push('/')}
                        size="md"
                        borderRadius="md"
                    >
                        Markets
                    </Button>

                    {marketId && (
                        <Button
                            variant="ghost"
                            color="gray.300"
                            fontWeight="medium"
                            _hover={{
                                bgGradient: "linear(to-r, #3182CE, #63B3ED)",
                                color: "white"
                            }}
                            onClick={() => router.push(`/admin?marketId=${marketId}`)}
                            size="md"
                            borderRadius="md"
                        >
                            Admin
                        </Button>
                    )}
                </HStack>
            </Flex>
        </Box>
    );
};

export default Navbar; 