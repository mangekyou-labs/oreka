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
    Divider
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { FaSync } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { FactoryApiService } from '../../service/FactoryService';

// Material UI styled components
const GradientPaper = styled(Paper)(({ theme }) => ({
    background: 'linear-gradient(to right, rgba(15, 23, 42, 0.9), rgba(26, 32, 44, 0.9))',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    boxShadow: theme.shadows[10],
}));

const MarketCard = styled(Card)(({ theme }) => ({
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

interface Market {
    name: string;
    market_type: string;
    canister_id: string;
    status?: string;
    strikePrice?: string;
    maturityDate?: string;
}

// Simple interface for our factory service response
interface MarketResponse {
    name: string;
    market_type: string;
    canister_id: string;
}

// Props interface for ListMarkets component
interface ListMarketsProps {
    userPrincipal?: string;
    page?: number;
}

const ListMarketsMui: React.FC<ListMarketsProps> = ({ userPrincipal, page = 1 }) => {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [rawData, setRawData] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const factoryService = new FactoryApiService();

    useEffect(() => {
        console.log("ListMarkets component mounted");
        fetchMarkets();
    }, []);

    const fetchMarkets = async () => {
        console.log("Starting to fetch markets...");
        setIsLoading(true);
        setError(null);
        try {
            console.log("Calling factoryService.listMarkets()");
            const result = await factoryService.listMarkets();
            console.log("Markets API response:", result);
            setRawData(JSON.stringify(result, null, 2));

            if ('ok' in result && result.ok) {
                console.log("Successfully fetched markets:", result.ok);
                if (result.ok.length === 0) {
                    console.log("No markets found in the response");
                }

                // Transform the data to include status, strike price, and maturity date
                const fetchedMarkets: Market[] = result.ok.map((market: MarketResponse) => {
                    console.log("Processing market:", market);
                    return {
                        ...market,
                        status: Math.random() > 0.5 ? 'active' : Math.random() > 0.5 ? 'settled' : 'expired',
                        strikePrice: `$${(Math.random() * 1000).toFixed(2)}`,
                        maturityDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
                    };
                });
                console.log("Processed markets:", fetchedMarkets);
                setMarkets(fetchedMarkets);
            } else {
                console.error("Error from API:", result.err);
                setError('Failed to fetch markets: ' + (result.err || 'Unknown error'));
            }
        } catch (err) {
            console.error("Exception occurred:", err);
            setError('An unexpected error occurred');
        } finally {
            setIsLoading(false);
            console.log("Finished fetching markets");
        }
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

    const navigateToMarket = (marketId: string) => {
        console.log("Navigating to market:", marketId);
        try {
            if (typeof window !== 'undefined') {
                window.location.href = `/?marketId=${marketId}`;
            }
        } catch (error) {
            console.error("Navigation error:", error);
            window.location.href = `/?marketId=${marketId}`;
        }
    };

    // Determine badge color based on status
    const getBadgeColor = (status: string) => {
        const statusLower = status?.toLowerCase() || '';
        if (statusLower === 'active') return 'success';
        if (statusLower === 'settled') return 'primary';
        if (statusLower === 'expired') return 'error';
        return 'default';
    };

    return (
        <Box sx={{ width: '100%', py: 4 }}>
            <GradientPaper>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" component="h2" color="white">
                        Available Markets
                    </Typography>
                    <StyledButton
                        startIcon={<FaSync />}
                        onClick={fetchMarkets}
                        disabled={isLoading}
                    >
                        Refresh
                    </StyledButton>
                </Box>

                {isLoading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5 }}>
                        <CircularProgress sx={{ mb: 2, color: '#6A83E8' }} />
                        <Typography color="grey.300">Loading markets...</Typography>
                    </Box>
                ) : error ? (
                    <Alert severity="error" sx={{
                        backgroundColor: 'rgba(211, 47, 47, 0.1)',
                        color: '#f44336',
                        '.MuiAlert-icon': { color: '#f44336' }
                    }}>
                        <AlertTitle>Error</AlertTitle>
                        {error}
                        <CodeDisplay sx={{ mt: 2 }}>
                            <pre>{rawData || "No response data"}</pre>
                        </CodeDisplay>
                    </Alert>
                ) : markets.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 5 }}>
                        <Typography color="grey.300" variant="h6">No markets found</Typography>
                        <Typography color="grey.500" sx={{ mt: 1 }}>
                            Markets you deploy will appear here
                        </Typography>
                        <CodeDisplay sx={{ mt: 3, mx: 'auto', maxWidth: '100%' }}>
                            <pre>{rawData || "No response data"}</pre>
                        </CodeDisplay>
                    </Box>
                ) : (
                    <>
                        <Grid container spacing={3}>
                            {markets.map((market) => (
                                <Grid item xs={12} md={6} lg={4} key={market.canister_id}>
                                    <MarketCard>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                <Typography variant="h6" color="white" noWrap sx={{ maxWidth: '70%' }}>
                                                    {market.name}
                                                </Typography>
                                                {market.status && (
                                                    <Chip
                                                        label={market.status}
                                                        color={getBadgeColor(market.status) as any}
                                                        size="small"
                                                    />
                                                )}
                                            </Box>

                                            <Stack spacing={1.5}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography color="grey.500">Type:</Typography>
                                                    <Typography color="white" fontWeight="medium">{market.market_type}</Typography>
                                                </Box>

                                                {market.strikePrice && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography color="grey.500">Strike Price:</Typography>
                                                        <Typography color="white" fontWeight="medium">{market.strikePrice}</Typography>
                                                    </Box>
                                                )}

                                                {market.maturityDate && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography color="grey.500">Maturity Date:</Typography>
                                                        <Typography color="white" fontWeight="medium">{formatDate(market.maturityDate)}</Typography>
                                                    </Box>
                                                )}

                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography color="grey.500">Canister ID:</Typography>
                                                    <Typography color="white" fontWeight="medium" noWrap sx={{ maxWidth: '150px' }}>
                                                        {market.canister_id}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </CardContent>

                                        <Divider sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />

                                        <CardActions sx={{ p: 2 }}>
                                            <StyledButton
                                                fullWidth
                                                onClick={() => navigateToMarket(market.canister_id)}
                                            >
                                                View Market
                                            </StyledButton>
                                        </CardActions>
                                    </MarketCard>
                                </Grid>
                            ))}
                        </Grid>

                        <Box sx={{ mt: 4 }}>
                            <Typography color="grey.500" variant="subtitle2" sx={{ mb: 1 }}>Debug - API Response:</Typography>
                            <CodeDisplay>
                                <pre>{rawData || "No response data"}</pre>
                            </CodeDisplay>
                        </Box>
                    </>
                )}
            </GradientPaper>
        </Box>
    );
};

export default ListMarketsMui; 