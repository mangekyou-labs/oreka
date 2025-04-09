import React, { useState } from 'react';
import { FactoryApiService } from '../../service/FactoryService';
import {
    Box,
    Input,
    Button,
    Heading,
    Text,
    FormControl,
    FormLabel,
    Select,
    VStack,
    Alert,
    AlertIcon,
    AlertTitle,
    useToast,
    InputGroup,
    Flex
} from '@chakra-ui/react';

interface DeployContractProps {
    userPrincipal?: string;
    onSuccess?: () => void;
}

const DeployContract: React.FC<DeployContractProps> = ({ userPrincipal, onSuccess }) => {
    const [contractId, setContractId] = useState<string>('');
    const [contractName, setContractName] = useState<string>('');
    const [contractType, setContractType] = useState<'BinaryOptionMarket' | string>('BinaryOptionMarket');
    const [otherType, setOtherType] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const toast = useToast();
    const factoryService = new FactoryApiService();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userPrincipal) {
            toast({
                title: "Authentication required",
                description: "You must be logged in to register a contract",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
            return;
        }

        if (!contractId || !contractName) {
            toast({
                title: "Missing information",
                description: "Please fill in all required fields",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
            return;
        }

        setLoading(true);

        try {
            // Since there's no registerContract function, we can use deployMarket to create a new contract
            // Or disable this component if it's not needed
            toast({
                title: "Feature not available",
                description: "Contract registration is not available in this version. Please use the Deploy Market function instead.",
                status: "info",
                duration: 5000,
                isClosable: true,
            });

            // Reset form
            setContractId('');
            setContractName('');
            setContractType('BinaryOptionMarket');
            setOtherType('');

        } catch (error) {
            console.error('Error registering contract:', error);
            toast({
                title: "Error",
                description: `An unexpected error occurred: ${error}`,
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            p={8}
            bg="rgba(13, 25, 48, 0.7)"
            borderRadius="xl"
            backdropFilter="blur(10px)"
        >
            <Heading size="lg" mb={4} color="white" fontWeight="semibold">Register a New Contract</Heading>
            <Text mb={8} color="blue.100" fontSize="md">
                Register an existing deployed canister with the Factory
            </Text>

            <form onSubmit={handleSubmit}>
                <VStack spacing={6} align="stretch">
                    <FormControl isRequired>
                        <FormLabel color="blue.100" fontWeight="medium">Contract Canister ID</FormLabel>
                        <InputGroup>
                            <Input
                                value={contractId}
                                onChange={(e) => setContractId(e.target.value)}
                                placeholder="e.g. be2us-64aaa-aaaaa-qaabq-cai"
                                size="lg"
                                bg="rgba(9, 21, 42, 0.8)"
                                border="1px solid rgba(255, 255, 255, 0.1)"
                                borderRadius="md"
                                color="white"
                                _placeholder={{ color: "gray.400" }}
                                _hover={{ borderColor: "blue.300" }}
                                _focus={{
                                    borderColor: "blue.300",
                                    boxShadow: "0 0 0 1px rgba(66, 153, 225, 0.6)"
                                }}
                            />
                        </InputGroup>
                        <Text fontSize="sm" color="blue.200" mt={2} fontStyle="italic">
                            The principal ID of the deployed canister
                        </Text>
                    </FormControl>

                    <FormControl isRequired>
                        <FormLabel color="blue.100" fontWeight="medium">Contract Name</FormLabel>
                        <Input
                            value={contractName}
                            onChange={(e) => setContractName(e.target.value)}
                            placeholder="e.g. My Binary Option Market"
                            size="lg"
                            bg="rgba(9, 21, 42, 0.8)"
                            border="1px solid rgba(255, 255, 255, 0.1)"
                            borderRadius="md"
                            color="white"
                            _placeholder={{ color: "gray.400" }}
                            _hover={{ borderColor: "blue.300" }}
                            _focus={{
                                borderColor: "blue.300",
                                boxShadow: "0 0 0 1px rgba(66, 153, 225, 0.6)"
                            }}
                        />
                        <Text fontSize="sm" color="blue.200" mt={2} fontStyle="italic">
                            A descriptive name for the contract
                        </Text>
                    </FormControl>

                    <FormControl>
                        <FormLabel color="blue.100" fontWeight="medium">Contract Type</FormLabel>
                        <Select
                            value={contractType}
                            onChange={(e) => setContractType(e.target.value)}
                            size="lg"
                            bg="rgba(9, 21, 42, 0.8)"
                            border="1px solid rgba(255, 255, 255, 0.1)"
                            borderRadius="md"
                            color="white"
                            _hover={{ borderColor: "blue.300" }}
                            _focus={{
                                borderColor: "blue.300",
                                boxShadow: "0 0 0 1px rgba(66, 153, 225, 0.6)"
                            }}
                        >
                            <option value="BinaryOptionMarket">Binary Option Market</option>
                            <option value="Other">Other</option>
                        </Select>
                    </FormControl>

                    {contractType === 'Other' && (
                        <FormControl isRequired>
                            <FormLabel color="blue.100" fontWeight="medium">Other Contract Type</FormLabel>
                            <Input
                                value={otherType}
                                onChange={(e) => setOtherType(e.target.value)}
                                placeholder="e.g. Custom Market"
                                size="lg"
                                bg="rgba(9, 21, 42, 0.8)"
                                border="1px solid rgba(255, 255, 255, 0.1)"
                                borderRadius="md"
                                color="white"
                                _placeholder={{ color: "gray.400" }}
                                _hover={{ borderColor: "blue.300" }}
                                _focus={{
                                    borderColor: "blue.300",
                                    boxShadow: "0 0 0 1px rgba(66, 153, 225, 0.6)"
                                }}
                            />
                            <Text fontSize="sm" color="blue.200" mt={2} fontStyle="italic">
                                Specify the type of contract
                            </Text>
                        </FormControl>
                    )}

                    <Flex justify="center" mt={4}>
                        <Button
                            type="submit"
                            colorScheme="blue"
                            isLoading={loading}
                            loadingText="Registering..."
                            isDisabled={loading || !userPrincipal}
                            size="lg"
                            minW="200px"
                            py={6}
                            mt={4}
                            bgGradient="linear(to-r, blue.600, blue.500)"
                            _hover={{
                                bgGradient: "linear(to-r, blue.500, blue.400)",
                                transform: "translateY(-2px)",
                                boxShadow: "lg"
                            }}
                            _active={{
                                transform: "translateY(0)",
                            }}
                            transition="all 0.2s"
                        >
                            Register Contract
                        </Button>
                    </Flex>

                    {!userPrincipal && (
                        <Alert
                            status="warning"
                            mt={4}
                            borderRadius="md"
                            bg="rgba(250, 173, 20, 0.2)"
                            border="1px solid rgba(250, 173, 20, 0.3)"
                        >
                            <AlertIcon color="yellow.300" />
                            <AlertTitle color="yellow.100">You must be logged in to register a contract</AlertTitle>
                        </Alert>
                    )}
                </VStack>
            </form>
        </Box>
    );
};

export default DeployContract; 