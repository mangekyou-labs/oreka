import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Typography,
    CircularProgress,
    Container,
    Grid,
    IconButton,
    Paper,
    Stack,
    Alert,
    Chip,
    Divider
} from '@mui/material';
import { FaSync } from 'react-icons/fa';
import { useRouter } from 'next/router';
import { FactoryApiService } from '@/service/FactoryService';

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

const ListMarkets: React.FC<ListMarketsProps> = ({ userPrincipal, page = 1 }) => {
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
            // The error happens because we're trying to use includes on undefined
            // We need to check if we're using react-router or next/router
            if (typeof window !== 'undefined') {
                // Use a client-side redirect to the home page with the market ID
                window.location.href = `/?marketId=${marketId}`;
                // Alternatively, we could use router.push, but direct navigation works better for this case
                // router.push(`/?marketId=${marketId}`);
            }
        } catch (error) {
            console.error("Navigation error:", error);
            // Fallback to direct navigation
            window.location.href = `/?marketId=${marketId}`;
        }
    };

    const getStatusColor = (status: string): "success" | "info" | "error" | "default" => {
        const statusLower = status?.toLowerCase() || '';
        if (statusLower === 'active') return 'success';
        if (statusLower === 'settled') return 'info';
        if (statusLower === 'expired') return 'error';
        return 'default';
    };

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Paper
                elevation={3}
                sx={{
                    p: 3,
                    background: 'linear-gradient(to right, rgba(15, 23, 42, 0.9), rgba(26, 32, 44, 0.9))',
                    borderRadius: 2
                }}
            >
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                    <Typography variant="h4" color="white">
                        Available Markets
                    </Typography>
                    <IconButton
                        onClick={fetchMarkets}
                        disabled={isLoading}
                        sx={{
                            color: 'white',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.1)'
                            }
                        }}
                    >
                        <FaSync />
                    </IconButton>
                </Stack>

                {isLoading ? (
                    <Stack alignItems="center" justifyContent="center" py={5}>
                        <CircularProgress sx={{ color: '#6A83E8', mb: 2 }} />
                        <Typography color="white">Loading markets...</Typography>
                    </Stack>
                ) : error ? (
                    <Box sx={{ textAlign: 'center', py: 5, px: 3 }}>
                        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
                        <Paper sx={{ p: 2, bgcolor: 'rgba(0, 0, 0, 0.3)', maxHeight: 300, overflow: 'auto' }}>
                            <Typography variant="body2" color="white" sx={{ mb: 1 }}>
                                API Response:
                            </Typography>
                            <Typography
                                component="pre"
                                sx={{
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all'
                                }}
                            >
                                {rawData || "No response data"}
                            </Typography>
                        </Paper>
                    </Box>
                ) : markets.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 5, px: 3 }}>
                        <Typography color="white" variant="h6">No markets found</Typography>
                        <Typography color="rgba(255, 255, 255, 0.7)" sx={{ mt: 1 }}>
                            Markets you deploy will appear here
                        </Typography>
                    </Box>
                ) : (
                    <Grid container spacing={2}>
                        {markets.map((market) => (
                            <Grid item xs={12} key={market.canister_id}>
                                <Paper
                                    sx={{
                                        p: 2,
                                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                                        cursor: 'pointer',
                                        '&:hover': {
                                            bgcolor: 'rgba(255, 255, 255, 0.1)'
                                        }
                                    }}
                                    onClick={() => navigateToMarket(market.canister_id)}
                                >
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Stack spacing={1}>
                                            <Typography color="white" variant="h6">
                                                {market.name}
                                            </Typography>
                                            <Typography color="rgba(255, 255, 255, 0.7)" variant="body2">
                                                Type: {market.market_type}
                                            </Typography>
                                            <Typography color="rgba(255, 255, 255, 0.7)" variant="body2">
                                                Strike Price: {market.strikePrice}
                                            </Typography>
                                            <Typography color="rgba(255, 255, 255, 0.7)" variant="body2">
                                                Maturity: {formatDate(market.maturityDate)}
                                            </Typography>
                                        </Stack>
                                        <Chip
                                            label={market.status}
                                            color={getStatusColor(market.status || '')}
                                            size="small"
                                        />
                                    </Stack>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Paper>
        </Container>
    );
};

export default ListMarkets; 