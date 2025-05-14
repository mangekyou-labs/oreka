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
import { AuthClient } from '@dfinity/auth-client';

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
    metadata?: {
        strikePrice?: string;
        maturityDate?: string;
        symbol?: string;
        decimals?: number;
        totalSupply?: string;
    };
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
    tradingPair?: string;
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

    // Add this to track when the page needs refreshing
    const [lastRefreshed, setLastRefreshed] = useState<number>(Date.now());

    useEffect(() => {
        console.log("ListMarkets component mounted or refreshed");
        fetchContracts();

        // Set up a refresh interval to check for new markets
        const refreshInterval = setInterval(() => {
            console.log("Auto-refreshing markets list");
            fetchContracts();
        }, 15000); // Refresh every 15 seconds

        return () => {
            clearInterval(refreshInterval);
        };
    }, [lastRefreshed]); // Depend on lastRefreshed to trigger refresh

    // Function to manually refresh the list
    const refreshMarketsList = () => {
        console.log("Manual refresh requested");
        setIsLoading(true);
        setLastRefreshed(Date.now());
    };

    const fetchContracts = async () => {
        console.log("Starting to fetch contracts...");
        setIsLoading(true);
        setError(null);

        // Add more detailed debugging
        console.log("------------------- MARKET LIST REFRESH -------------------");
        console.log(`Refresh started at ${new Date().toISOString()}`);

        try {
            // Force a fresh identity to avoid caching issues
            const authClient = await AuthClient.create();
            let identity;
            try {
                if (await authClient.isAuthenticated()) {
                    identity = authClient.getIdentity();
                    const principal = identity.getPrincipal().toString();
                    console.log(`Using authenticated identity: ${principal}`);

                    // Update the factory service with the identity
                    factoryService.updateIdentity(identity);
                } else {
                    console.warn("No authenticated identity found, using anonymous");
                }
            } catch (e) {
                console.warn("Error getting identity:", e);
            }

            // First approach: Try getAllMarketDetails
            console.log("APPROACH 1: Calling factoryService.getAllMarketDetails()");
            try {
                const marketDetailsResult = await factoryService.getAllMarketDetails();
                console.log("Market details API response:", marketDetailsResult);

                if (marketDetailsResult.ok && marketDetailsResult.ok.length > 0) {
                    console.log(`Found ${marketDetailsResult.ok.length} markets via getAllMarketDetails`);
                    console.log("Market list:", marketDetailsResult.ok);

                    // Transform the market details for display
                    const allMarketDetails = marketDetailsResult.ok.map((market: any) => {
                        console.log(`Processing market: ${market.name} (${market.canisterId.toString()})`);
                        console.log(`Market data: Strike price=${market.strikePrice}, Trading pair=${market.tradingPair}`);

                        let formattedStrikePrice = 'N/A';
                        if (market.strikePrice !== null && market.strikePrice !== undefined) {
                            if (typeof market.strikePrice === 'number') {
                                formattedStrikePrice = `$${market.strikePrice.toFixed(2)}`;
                            } else {
                                formattedStrikePrice = `$${String(market.strikePrice)}`;
                            }
                        }

                        // Base contract info
                        const displayContract: DisplayContract = {
                            name: market.name || 'Unnamed Market',
                            contract_type: 'BinaryOptionMarket',
                            canister_id: market.canisterId.toString(),
                            status: 'active', // Default to active status
                            strikePrice: formattedStrikePrice,
                            tradingPair: market.tradingPair || 'Unknown'
                        };

                        return displayContract;
                    });

                    console.log("Processed market details:", allMarketDetails);
                    setContracts(allMarketDetails);
                    setMarkets(allMarketDetails);
                    setIsLoading(false);
                    console.log("Successfully updated market list with getAllMarketDetails data");
                    return;
                } else {
                    console.warn("No market details found or API returned error");
                }
            } catch (detailsError) {
                console.error("Error using getAllMarketDetails:", detailsError);
            }

            // Second approach: Try getAllMarkets for basic info
            console.log("APPROACH 2: Trying factoryService.getAllMarkets()");
            try {
                const allMarketsResult = await factoryService.getAllMarkets();
                console.log("getAllMarkets response:", allMarketsResult);

                if (allMarketsResult.ok && allMarketsResult.ok.length > 0) {
                    console.log(`Found ${allMarketsResult.ok.length} markets via getAllMarkets`);

                    // Transform markets for display
                    const allMarketDetails = allMarketsResult.ok.map((market: any) => {
                        console.log(`Processing market from getAllMarkets: ${market.name || 'Unknown'}`);

                        let strikePrice = 'N/A';
                        let tradingPair = 'Unknown';

                        // Handle optional values in Candid format
                        if (market.strikePrice && Array.isArray(market.strikePrice) && market.strikePrice.length > 0) {
                            const price = market.strikePrice[0];
                            if (typeof price === 'number') {
                                strikePrice = `$${price.toFixed(2)}`;
                            }
                        }

                        if (market.tradingPair && Array.isArray(market.tradingPair) && market.tradingPair.length > 0) {
                            tradingPair = market.tradingPair[0];
                        }

                        return {
                            name: market.name || 'Unnamed Market',
                            contract_type: 'BinaryOptionMarket',
                            canister_id: market.canisterId.toString(),
                            status: 'active',
                            strikePrice: strikePrice,
                            tradingPair: tradingPair
                        };
                    });

                    console.log("Processed getAllMarkets data:", allMarketDetails);
                    setContracts(allMarketDetails);
                    setMarkets(allMarketDetails);
                    setIsLoading(false);
                    console.log("Successfully updated market list with getAllMarkets data");
                    return;
                } else {
                    console.warn("No markets found with getAllMarkets or API returned error");
                }
            } catch (marketsError) {
                console.error("Error using getAllMarkets:", marketsError);
            }

            // Third approach (fallback): Use the original getAllContracts method
            console.log("APPROACH 3: Falling back to getAllContracts");
            const result = await factoryService.getAllContracts();
            console.log("getAllContracts API response:", result);

            if (result.ok && result.ok.length > 0) {
                console.log(`Found ${result.ok.length} contracts via getAllContracts`);

                // Get strike prices to enrich the data
                let strikePricesMap = new Map<string, number>();
                try {
                    const strikePricesResult = await factoryService.getMarketStrikePrices();
                    if (strikePricesResult.ok) {
                        strikePricesMap = strikePricesResult.ok;
                        console.log("Strike prices map:", Object.fromEntries(strikePricesMap));
                    }
                } catch (error) {
                    console.error("Error fetching strike prices:", error);
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
                        status: 'active'
                    };

                    // Add strike price from the strike prices map
                    if (contractType === 'BinaryOptionMarket') {
                        const canisterId = contract.address.toString();
                        const strikePrice = strikePricesMap.get(canisterId);
                        if (strikePrice !== undefined) {
                            displayContract.strikePrice = `$${strikePrice.toFixed(2)}`;
                            console.log(`Set strike price for ${canisterId} to ${displayContract.strikePrice}`);
                        } else {
                            console.log(`No strike price found for ${canisterId}`);
                        }
                    }

                    return displayContract;
                });

                console.log("Processed contracts:", allContracts);

                // Filter contracts by type
                const marketContracts = allContracts.filter(c => c.contract_type === 'BinaryOptionMarket');
                const tokenContracts = allContracts.filter(c => c.contract_type === 'ICRC1Token');

                console.log(`Found ${marketContracts.length} markets after filtering`);

                setContracts(allContracts);
                setMarkets(marketContracts);
                setTokens(tokenContracts);
                setIsLoading(false);
                console.log("Successfully updated market list with getAllContracts data");
            } else {
                console.error("No contracts found in any approach");
                setError(`No markets found. Please try again later.`);
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Fatal error in fetchContracts:", error);
            setError(`Failed to fetch contracts: ${error instanceof Error ? error.message : String(error)}`);
            setIsLoading(false);
        } finally {
            console.log(`Refresh completed at ${new Date().toISOString()}`);
            console.log("------------------- END MARKET LIST REFRESH -------------------");
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
                    window.location.href = `/customer/${contractId}`;
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
                        onClick={refreshMarketsList}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Refreshing...' : 'Refresh'}
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
                            <Grid item xs={12} sm={6} md={4} key={contract.canister_id}>
                                <ContractCard>
                                    <CardContent>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                                {contract.name}
                                            </Typography>
                                            <Chip
                                                label={contract.status || 'Active'}
                                                size="small"
                                                sx={{
                                                    bgcolor: getBadgeColor(contract.status || 'active'),
                                                    color: 'white',
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                        </Stack>

                                        <Stack spacing={1}>
                                            {contract.contract_type === 'BinaryOptionMarket' && (
                                                <>
                                                    {contract.tradingPair && (
                                                        <Typography variant="body2">
                                                            <strong>Trading Pair:</strong> {contract.tradingPair}
                                                        </Typography>
                                                    )}
                                                    {contract.strikePrice && (
                                                        <Typography variant="body2">
                                                            <strong>Strike Price:</strong> {contract.strikePrice}
                                                        </Typography>
                                                    )}
                                                    {contract.maturityDate && (
                                                        <Typography variant="body2">
                                                            <strong>Expiry:</strong> {formatDate(contract.maturityDate)}
                                                        </Typography>
                                                    )}
                                                </>
                                            )}

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