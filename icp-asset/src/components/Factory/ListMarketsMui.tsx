import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Typography,
    Grid,
    Paper,
    Chip,
    CircularProgress,
    Stack,
    Alert,
    AlertTitle,
    Card,
    CardContent,
    CardActions,
    Divider,
    Tabs,
    Tab
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { FaSync, FaCoins, FaChartLine } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { FactoryApiService } from '../../service/FactoryService';

// Material UI styled components
const GradientPaper = styled(Paper)(({ theme }) => ({
    background: 'linear-gradient(to right, rgba(15, 23, 42, 0.9), rgba(26, 32, 44, 0.9))',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    boxShadow: theme.shadows[10],
}));

const ContractCard = styled(Card)(({ theme }) => ({
    background: 'rgba(35, 43, 61, 0.8)',
    borderRadius: theme.shape.borderRadius * 2,
    boxShadow: theme.shadows[5],
    transition: 'all 0.3s',
    border: '1px solid rgba(74, 99, 200, 0.3)',
    '&:hover': {
        transform: 'translateY(-5px)',
        boxShadow: theme.shadows[15],
    },
}));

const StyledButton = styled(Button)(({ theme }) => ({
    background: 'linear-gradient(90deg, #4A63C8 0%, #6A83E8 100%)',
    color: 'white',
    '&:hover': {
        background: 'linear-gradient(90deg, #3A53B8 0%, #5A73D8 100%)',
    },
    borderRadius: 20,
    padding: theme.spacing(0.75, 3),
}));

const CodeDisplay = styled(Paper)(({ theme }) => ({
    background: 'rgba(0, 0, 0, 0.3)',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    overflow: 'auto',
    maxHeight: '300px',
    '& pre': {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        color: theme.palette.grey[300],
        margin: 0,
        fontFamily: 'monospace',
    },
}));

// Common contract interface
interface Contract {
    title: string;
    address: any; // Principal
    type: any; // ContractType
    created: bigint;
    owner: any; // Principal
}

// Transformed contracts for display
interface DisplayContract {
    name: string;
    contract_type: string;
    canister_id: string;
    status?: string;
    created?: string;
    owner?: string;
    // Market-specific fields
    strikePrice?: string;
    maturityDate?: string;
    // Token-specific fields
    symbol?: string;
    decimals?: number;
    totalSupply?: string;
}

// Props interface for ListMarkets component
interface ListMarketsProps {
    userPrincipal?: string;
    page?: number;
}

const ListMarketsMui: React.FC<ListMarketsProps> = ({ userPrincipal, page = 1 }) => {
    const [contracts, setContracts] = useState<DisplayContract[]>([]);
    const [markets, setMarkets] = useState<DisplayContract[]>([]);
    const [tokens, setTokens] = useState<DisplayContract[]>([]);
    const [rawData, setRawData] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState(0); // 0 = All, 1 = Markets, 2 = Tokens
    const router = useRouter();
    const factoryService = new FactoryApiService();

    useEffect(() => {
        console.log("ListMarkets component mounted");
        fetchContracts();
    }, []);

    const fetchContracts = async () => {
        console.log("Starting to fetch contracts...");
        setIsLoading(true);
        setError(null);
        try {
            console.log("Calling factoryService.getAllContracts()");
            const result = await factoryService.getAllContracts();
            console.log("Contracts API response:", result);
            setRawData(JSON.stringify(result, null, 2));

            if (result.ok) {
                console.log("Successfully fetched contracts:", result.ok);
                if (result.ok.length === 0) {
                    console.log("No contracts found in the response");
                }

                // Transform the contracts for display
                const allContracts: DisplayContract[] = result.ok.map((contract: Contract) => {
                    console.log("Processing contract:", contract);

                    // Determine contract type
                    let contractType = 'Unknown';
                    if (contract.type && typeof contract.type === 'object') {
                        if ('BinaryOptionMarket' in contract.type) {
                            contractType = 'BinaryOptionMarket';
                        } else if ('ICRC1Token' in contract.type) {
                            contractType = 'ICRC1Token';
                        } else if ('Other' in contract.type) {
                            contractType = 'Other';
                        }
                    }

                    // Base contract info
                    const displayContract: DisplayContract = {
                        name: contract.title || 'Unnamed Contract',
                        contract_type: contractType,
                        canister_id: contract.address.toString(),
                        created: new Date(Number(contract.created) / 1000000).toLocaleString(),
                        owner: contract.owner.toString(),
                        status: Math.random() > 0.5 ? 'active' : Math.random() > 0.5 ? 'pending' : 'completed'
                    };

                    // Add type-specific mock data
                    if (contractType === 'BinaryOptionMarket') {
                        displayContract.strikePrice = `$${(Math.random() * 1000).toFixed(2)}`;
                        displayContract.maturityDate = new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString();
                    } else if (contractType === 'ICRC1Token') {
                        displayContract.symbol = contract.title.split(' ')[0].substring(0, 4).toUpperCase();
                        displayContract.decimals = 8;
                        displayContract.totalSupply = (Math.random() * 1000000).toFixed(0);
                    }

                    return displayContract;
                });

                console.log("Processed contracts:", allContracts);

                // Filter contracts by type
                const marketContracts = allContracts.filter(c => c.contract_type === 'BinaryOptionMarket');
                const tokenContracts = allContracts.filter(c => c.contract_type === 'ICRC1Token');

                setContracts(allContracts);
                setMarkets(marketContracts);
                setTokens(tokenContracts);
            } else {
                console.error("Error from API:", result.err);
                setError('Failed to fetch contracts: ' + (result.err || 'Unknown error'));
            }
        } catch (err) {
            console.error("Exception occurred:", err);
            setError('An unexpected error occurred');
        } finally {
            setIsLoading(false);
            console.log("Finished fetching contracts");
        }
    };

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    // Helper to format date strings
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Date unavailable';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Date unavailable';
        }
    };

    const navigateToContract = (contractId: string, contractType: string) => {
        console.log(`Navigating to ${contractType}:`, contractId);
        try {
            if (typeof window !== 'undefined') {
                if (contractType === 'BinaryOptionMarket') {
                    window.location.href = `/?marketId=${contractId}`;
                } else if (contractType === 'ICRC1Token') {
                    window.location.href = `/?tokenId=${contractId}`;
                } else {
                    window.location.href = `/?canisterId=${contractId}`;
                }
            }
        } catch (error) {
            console.error("Navigation error:", error);
        }
    };

    // Determine badge color based on status
    const getBadgeColor = (status: string) => {
        const statusLower = status?.toLowerCase() || '';
        if (statusLower === 'active') return 'success';
        if (statusLower === 'pending') return 'warning';
        if (statusLower === 'completed') return 'primary';
        return 'default';
    };

    // Get the active contracts list based on tab
    const getActiveContracts = () => {
        switch (activeTab) {
            case 0: return contracts;
            case 1: return markets;
            case 2: return tokens;
            default: return contracts;
        }
    };

    return (
        <Box sx={{ width: '100%', py: 4 }}>
            <GradientPaper>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" component="h2" color="white">
                        Contract Explorer
                    </Typography>
                    <StyledButton
                        startIcon={<FaSync />}
                        onClick={fetchContracts}
                        disabled={isLoading}
                    >
                        Refresh
                    </StyledButton>
                </Box>

                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    indicatorColor="primary"
                    textColor="primary"
                    sx={{ mb: 3 }}
                >
                    <Tab label="All Contracts" />
                    <Tab label="Markets" icon={<FaChartLine />} iconPosition="start" />
                    <Tab label="Tokens" icon={<FaCoins />} iconPosition="start" />
                </Tabs>

                {isLoading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5 }}>
                        <CircularProgress sx={{ mb: 2, color: '#6A83E8' }} />
                        <Typography color="grey.300">Loading contracts...</Typography>
                    </Box>
                ) : error ? (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        <AlertTitle>Error</AlertTitle>
                        {error}
                    </Alert>
                ) : getActiveContracts().length === 0 ? (
                    <Alert severity="info" sx={{ mb: 3 }}>
                        <AlertTitle>No Contracts Found</AlertTitle>
                        {activeTab === 0 && "No contracts have been deployed yet."}
                        {activeTab === 1 && "No markets have been deployed yet."}
                        {activeTab === 2 && "No tokens have been deployed yet."}
                    </Alert>
                ) : (
                    <Grid container spacing={3}>
                        {getActiveContracts().map((contract) => (
                            <Grid item xs={12} md={6} lg={4} key={contract.canister_id}>
                                <ContractCard>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="h6" color="white" noWrap sx={{ maxWidth: '70%' }}>
                                                {contract.name}
                                            </Typography>
                                            <Chip
                                                label={contract.status}
                                                color={getBadgeColor(contract.status || '')}
                                                size="small"
                                            />
                                        </Box>

                                        <Divider sx={{ my: 1, bgcolor: 'rgba(255,255,255,0.1)' }} />

                                        <Stack spacing={1} sx={{ mt: 2 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="body2" color="text.secondary">Type</Typography>
                                                <Typography variant="body2" color="white">
                                                    {contract.contract_type === 'BinaryOptionMarket' ? 'Binary Market' :
                                                        contract.contract_type === 'ICRC1Token' ? 'ICRC-1 Token' :
                                                            contract.contract_type}
                                                </Typography>
                                            </Box>

                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="body2" color="text.secondary">Created</Typography>
                                                <Typography variant="body2" color="white">{contract.created}</Typography>
                                            </Box>

                                            {contract.contract_type === 'BinaryOptionMarket' && (
                                                <>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">Strike Price</Typography>
                                                        <Typography variant="body2" color="white">{contract.strikePrice}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">Maturity</Typography>
                                                        <Typography variant="body2" color="white">{contract.maturityDate}</Typography>
                                                    </Box>
                                                </>
                                            )}

                                            {contract.contract_type === 'ICRC1Token' && (
                                                <>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">Symbol</Typography>
                                                        <Typography variant="body2" color="white">{contract.symbol}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">Decimals</Typography>
                                                        <Typography variant="body2" color="white">{contract.decimals}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">Supply</Typography>
                                                        <Typography variant="body2" color="white">{contract.totalSupply}</Typography>
                                                    </Box>
                                                </>
                                            )}

                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="body2" color="text.secondary">ID</Typography>
                                                <Typography variant="body2" color="white" sx={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    maxWidth: '70%'
                                                }}>
                                                    {contract.canister_id}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </CardContent>
                                    <CardActions sx={{ p: 2, pt: 0 }}>
                                        <StyledButton
                                            size="small"
                                            fullWidth
                                            onClick={() => navigateToContract(contract.canister_id, contract.contract_type)}
                                        >
                                            {contract.contract_type === 'BinaryOptionMarket' ? 'Trade Market' :
                                                contract.contract_type === 'ICRC1Token' ? 'View Token' :
                                                    'View Details'}
                                        </StyledButton>
                                    </CardActions>
                                </ContractCard>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </GradientPaper>
        </Box>
    );
};

export default ListMarketsMui; 