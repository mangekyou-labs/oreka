import React from 'react';
import Head from 'next/head';
import { Box, Heading, Text, Button } from '@chakra-ui/react';
import { useRouter } from 'next/router';

export default function Custom404() {
    const router = useRouter();

    return (
        <>
            <Head>
                <title>404 - Page Not Found | Oreka</title>
            </Head>
            <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                minHeight="70vh"
                textAlign="center"
                px={4}
            >
                <Heading as="h1" size="2xl" mb={4}>
                    404 - Page Not Found
                </Heading>
                <Text fontSize="xl" mb={6}>
                    The page you're looking for doesn't exist or has been moved.
                </Text>
                <Button
                    colorScheme="blue"
                    size="lg"
                    onClick={() => router.push('/')}
                >
                    Go to Home
                </Button>
            </Box>
        </>
    );
} 