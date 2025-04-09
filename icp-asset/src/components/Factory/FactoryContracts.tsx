import React, { useState, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { FactoryApiService } from '../../service/FactoryService';
import {
    Box,
    Heading,
    Text,
    Button,
    List,
    ListItem,
    Spinner,
    Divider,
    Stack,
    Flex,
    VStack,
    Badge,
    HStack,
    SimpleGrid
} from "@chakra-ui/react";
import { Contract, DeployEvent } from '../../declarations/factory/factory';

interface ContractItemProps {
    contract: Contract;
    onSelect: (canisterId: string) => void;
}

const ContractItem: React.FC<ContractItemProps> = ({ contract, onSelect }) => {
    const contractId = contract.canisterId.toString();
    const contractType = 'BinaryOptionMarket' in contract.contractType
        ? 'Binary Option Market'
        : 'Other: ' + ('Other' in contract.contractType ? contract.contractType.Other : '');

    const createdDate = new Date(Number(contract.createdAt)).toLocaleString();

    return (
        <Box
            p={6}
            borderRadius="lg"
            bgGradient="linear(to-b, rgba(9, 21, 42, 0.8), rgba(10, 25, 50, 0.8))"
            boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"
            borderWidth="1px"
            borderColor="rgba(255, 255, 255, 0.05)"
            cursor="pointer"
            _hover={{
                transform: "translateY(-4px)",
                boxShadow: "0 8px 16px rgba(0, 0, 0, 0.3)",
                borderColor: "rgba(66, 153, 225, 0.3)"
            }}
            transition="all 0.3s"
            onClick={() => onSelect(contractId)}
        >
            <VStack spacing={3} align="stretch">
                <Flex justify="space-between" wrap="wrap">
                    <Heading size="md" color="white">{contract.name}</Heading>
                    <Badge
                        colorScheme="blue"
                        px={3}
                        py={1}
                        borderRadius="md"
                        textTransform="none"
                        bg="rgba(0, 71, 184, 0.3)"
                        color="blue.200"
                    >
                        {contractType}
                    </Badge>
                </Flex>
                <Text color="blue.200" fontSize="sm">ID: {contractId.substring(0, 8)}...{contractId.substring(contractId.length - 5)}</Text>
                <Text color="gray.400" fontSize="sm">Created: {createdDate}</Text>
                <Text color="gray.400" fontSize="sm">Owner: {contract.owner.toString().substring(0, 8)}...{contract.owner.toString().substring(contract.owner.toString().length - 5)}</Text>

                <Box pt={2}>
                    <Button
                        size="sm"
                        colorScheme="blue"
                        width="full"
                        bgGradient="linear(to-r, blue.600, blue.500)"
                        _hover={{
                            bgGradient: "linear(to-r, blue.500, blue.400)",
                        }}
                    >
                        View Details
                    </Button>
                </Box>
            </VStack>
        </Box>
    );
};

interface FactoryContractsProps {
    userPrincipal?: string;
}

const FactoryContracts: React.FC<FactoryContractsProps> = ({ userPrincipal }) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [userContracts, setUserContracts] = useState<Contract[]>([]);
    const [recentEvents, setRecentEvents] = useState<DeployEvent[]>([]);
    const factoryService = new FactoryApiService();

    useEffect(() => {
        async function loadData() {
            setLoading(true);

            try {
                // Get all contracts first
                const allContractsResult = await factoryService.getAllContracts();
                if (allContractsResult.ok) {
                    console.log("Retrieved all contracts:", allContractsResult.ok);

                    // If user principal is available, filter for user's contracts
                    if (userPrincipal) {
                        const userPrincipalObj = Principal.fromText(userPrincipal);
                        const filtered = allContractsResult.ok.filter(
                            contract => userPrincipalObj.toString() === contract.owner.toString()
                        );
                        setUserContracts(filtered);
                        console.log("Filtered user contracts:", filtered);
                    }
                }

                // Get recent events
                const eventsResult = await factoryService.getRecentEvents();
                if (eventsResult.ok) {
                    setRecentEvents(eventsResult.ok);
                    console.log("Retrieved events:", eventsResult.ok);
                }
            } catch (error) {
                console.error('Error loading factory data:', error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [userPrincipal]);

    const handleSelectContract = (canisterId: string) => {
        console.log('Selected contract:', canisterId);
        // Navigate to contract details or perform other actions
    };

    if (loading) {
        return (
            <Flex
                justify="center"
                align="center"
                p={8}
                h="300px"
                bg="rgba(13, 25, 48, 0.7)"
                borderRadius="xl"
            >
                <VStack>
                    <Spinner size="xl" thickness="4px" color="blue.300" speed="0.65s" />
                    <Text mt={6} color="blue.100" fontSize="lg">Loading contracts...</Text>
                </VStack>
            </Flex>
        );
    }

    return (
        <Box
            p={8}
            bg="rgba(13, 25, 48, 0.7)"
            borderRadius="xl"
            backdropFilter="blur(10px)"
        >
            {userPrincipal && (
                <>
                    <Heading size="lg" mb={6} color="white" fontWeight="semibold">Your Contracts</Heading>

                    {userContracts.length === 0 ? (
                        <Box
                            p={6}
                            mb={8}
                            bg="rgba(9, 21, 42, 0.6)"
                            borderRadius="md"
                            border="1px solid rgba(255, 255, 255, 0.05)"
                        >
                            <Text color="blue.100">You don't have any contracts yet.</Text>
                        </Box>
                    ) : (
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={8}>
                            {userContracts.map((contract, index) => (
                                <ContractItem
                                    key={index}
                                    contract={contract}
                                    onSelect={handleSelectContract}
                                />
                            ))}
                        </SimpleGrid>
                    )}

                    <Divider my={8} borderColor="rgba(255, 255, 255, 0.1)" />
                </>
            )}

            <Heading size="lg" mb={6} color="white" fontWeight="semibold">Recent Deployments</Heading>

            {recentEvents.length === 0 ? (
                <Box
                    p={6}
                    bg="rgba(9, 21, 42, 0.6)"
                    borderRadius="md"
                    border="1px solid rgba(255, 255, 255, 0.05)"
                >
                    <Text color="blue.100">No recent deployments.</Text>
                </Box>
            ) : (
                <List spacing={4}>
                    {recentEvents.map((event, index) => (
                        <ListItem
                            key={index}
                            p={4}
                            borderWidth="1px"
                            borderRadius="md"
                            bg="rgba(9, 21, 42, 0.6)"
                            borderColor="rgba(255, 255, 255, 0.05)"
                            boxShadow="0 2px 8px rgba(0, 0, 0, 0.1)"
                            _hover={{
                                bg: "rgba(9, 21, 42, 0.8)",
                                borderColor: "rgba(66, 153, 225, 0.2)"
                            }}
                            transition="all 0.2s"
                        >
                            <VStack align="start" spacing={1}>
                                <Text fontWeight="bold" color="white">
                                    Contract: {event.contractAddress.toString().substring(0, 8)}...{event.contractAddress.toString().substring(event.contractAddress.toString().length - 5)}
                                </Text>
                                <Text fontSize="sm" color="blue.200">
                                    Deployed by: {event.owner.toString().substring(0, 8)}...{event.owner.toString().substring(event.owner.toString().length - 5)}
                                </Text>
                                <Text fontSize="sm" color="gray.400">
                                    {new Date(Number(event.timestamp)).toLocaleString()}
                                </Text>
                            </VStack>
                        </ListItem>
                    ))}
                </List>
            )}
        </Box>
    );
};

export default FactoryContracts; 