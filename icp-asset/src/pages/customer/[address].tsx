import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Customer from '../../components/Customer';
import { Box, Center, Spinner, Text } from '@chakra-ui/react';

const CustomerPage = () => {
    const router = useRouter();
    const { address } = router.query;

    useEffect(() => {
        if (address) {
            console.log("Customer page received address:", address);
        } else {
            console.log("No address received in customer page yet");
        }
    }, [address]);

    if (!address) {
        return (
            <Center h="60vh">
                <Spinner size="xl" />
                <Text mt={4} color="gray.500">Loading market data...</Text>
            </Center>
        );
    }

    return (
        <Box pt={4} pb={10} px={0}>
            <Customer contractAddress={address as string} />
        </Box>
    );
};

export default CustomerPage; 