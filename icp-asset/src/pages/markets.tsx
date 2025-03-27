import React, { useState, useEffect } from 'react';
import {
    Container,
    Box,
    Typography,
    Paper,
    Tabs,
    Tab,
    Button,
    Stack,
    Divider,
    CircularProgress
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import muiTheme from '../themes/muiTheme';
import { AuthClient } from '@dfinity/auth-client';
import DeployMarket from '../components/Factory/DeployMarket';
import ListMarketsMui from '../components/Factory/ListMarketsMui';
import { useRouter } from 'next/router';
import { FactoryApiService } from '../service/FactoryService';

// Define the Market interface to match what's returned from the API
interface Market {
    name: string;
    market_type: string;
    canister_id: string;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel: React.FC<TabPanelProps> = (props) => {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`factory-tabpanel-${index}`}
            aria-labelledby={`factory-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
};

const MarketsPage: React.FC = () => {
    const [currentTab, setCurrentTab] = useState<number>(0);
    const [userPrincipal, setUserPrincipal] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
    const [isClient, setIsClient] = useState(false);
    const [markets, setMarkets] = useState<Market[]>([]);
    const router = useRouter();

    // Set isClient after component mounts
    useEffect(() => {
        setIsClient(true);
    }, []);

    // Get the current page from query instead of pathname parsing
    const currentPage = router.query.page ? parseInt(router.query.page as string, 10) : 1;

    useEffect(() => {
        async function checkAuth() {
            try {
                const authClient = await AuthClient.create();
                const isAuthenticated = await authClient.isAuthenticated();

                if (isAuthenticated) {
                    const identity = authClient.getIdentity();
                    const principal = identity.getPrincipal().toString();
                    setUserPrincipal(principal);
                }
            } catch (error) {
                console.error('Error checking authentication:', error);
            } finally {
                setIsLoading(false);
            }
        }

        if (isClient) {
            checkAuth();
            fetchMarkets();
        }
    }, [isClient]);

    const fetchMarkets = async () => {
        try {
            const factory = new FactoryApiService();
            const result = await factory.listMarkets();
            if ('ok' in result) {
                setMarkets(result.ok || []);
                console.log("Markets retrieved:", result.ok);
            } else {
                console.error("Failed to fetch markets:", result.err);
            }
        } catch (error) {
            console.error("Error fetching markets:", error);
        }
    };

    // Check URL for tab selection
    useEffect(() => {
        if (router.pathname.includes('/create')) {
            setCurrentTab(1);
        } else {
            setCurrentTab(0);
        }
    }, [router.pathname]);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setCurrentTab(newValue);
        router.push(newValue === 0 ? '/markets' : '/markets/create');
    };

    const handleMarketCreated = (marketId: string) => {
        // Navigate to the markets list and refresh
        setRefreshTrigger(prev => prev + 1);
        fetchMarkets(); // Refresh the markets list
        setCurrentTab(0);
        router.push('/markets');
    };

    // Don't render router-dependent components during SSR
    if (!isClient) {
        return (
            <Box sx={{ bgcolor: "#0A1647", minHeight: "calc(100vh - 64px)" }}>
                <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
                    <Box display="flex" justifyContent="center" p={4}>
                        <CircularProgress />
                    </Box>
                </Container>
            </Box>
        );
    }

    return (
        <ThemeProvider theme={muiTheme}>
            <Box sx={{ bgcolor: "#0A1647", minHeight: "calc(100vh - 64px)" }}>
                <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                        <Typography variant="h4" component="h1" color="text.primary">
                            Binary Option Markets
                        </Typography>

                        {!isLoading && userPrincipal && (
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => router.push('/markets/create')}
                            >
                                Create New Market
                            </Button>
                        )}
                    </Box>

                    <Paper sx={{ width: '100%', mb: 4, borderRadius: 2, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)' }}>
                        <Tabs
                            value={currentTab}
                            onChange={handleTabChange}
                            indicatorColor="primary"
                            textColor="primary"
                            centered
                            sx={{
                                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                '& .MuiTabs-indicator': {
                                    backgroundColor: '#4A63C8',
                                }
                            }}
                        >
                            <Tab label="Browse Markets" />
                            <Tab label="Create Market" />
                        </Tabs>

                        <TabPanel value={currentTab} index={0}>
                            {isClient && (
                                <ListMarketsMui
                                    userPrincipal={userPrincipal}
                                    page={currentPage}
                                    key={`markets-${refreshTrigger}`}
                                />
                            )}
                        </TabPanel>

                        <TabPanel value={currentTab} index={1}>
                            {isClient && (
                                <DeployMarket
                                    userPrincipal={userPrincipal}
                                    onSuccess={handleMarketCreated}
                                />
                            )}
                        </TabPanel>
                    </Paper>

                    {isLoading ? (
                        <Box display="flex" justifyContent="center" p={4}>
                            <CircularProgress />
                        </Box>
                    ) : !userPrincipal && (
                        <Paper sx={{ p: 3, mt: 2, borderRadius: 2, bgcolor: 'rgba(15, 32, 87, 0.8)' }}>
                            <Typography variant="h6" gutterBottom color="text.primary">
                                Not Connected
                            </Typography>
                            <Typography paragraph color="text.secondary">
                                You are not logged in with Internet Identity. Please log in to create markets and track your positions.
                            </Typography>
                            <Button variant="outlined" color="primary">
                                Connect with Internet Identity
                            </Button>
                        </Paper>
                    )}
                </Container>
            </Box>
        </ThemeProvider>
    );
};

export default MarketsPage; 