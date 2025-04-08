import React, { useEffect, useState } from 'react';
import { Box, Flex, Link, Spacer, Text, useColorModeValue } from '@chakra-ui/react';
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
        <Box bg="black" px={4} py={3} width="100%">
            <Flex alignItems="center" maxW="1200px" mx="auto">
                <Text fontSize="xl" fontWeight="bold" color="#FEDF56">Oreka Binary Options</Text>

                <Spacer />

                <Flex>
                    <Link
                        px={4}
                        py={2}
                        mr={3}
                        fontWeight="medium"
                        color="#FEDF56"
                        _hover={{ textDecoration: 'none', color: "#FEDF56" }}
                        onClick={() => router.push('/')}
                    >
                        Market
                    </Link>

                    {marketId && (
                        <Link
                            px={4}
                            py={2}
                            fontWeight="medium"
                            color="gray.400"
                            _hover={{ textDecoration: 'none', color: "#FEDF56" }}
                            onClick={() => router.push(`/admin?marketId=${marketId}`)}
                        >
                            Admin
                        </Link>
                    )}
                </Flex>
            </Flex>
        </Box>
    );
};

export default Navbar; 