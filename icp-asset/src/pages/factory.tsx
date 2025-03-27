import React, { useState, useEffect } from 'react';
import {
    Container,
    Box,
    Tabs,
    Tab,
    Typography,
    Divider
} from "@mui/material";
import { TabContext, TabList, TabPanel } from '@mui/lab';
import DeployContract from '../components/Factory/DeployContract';
import DeployMarket from '../components/Factory/DeployMarket';
import ListMarkets from '../components/Factory/ListMarkets';
import FactoryContracts from '../components/Factory/FactoryContracts';
import { AuthClient } from '@dfinity/auth-client';

interface FactoryPageProps { }

interface ListMarketsProps {
    refreshTrigger: number;
}

interface FactoryContractsProps {
    refreshTrigger: number;
}

const FactoryPage: React.FC<FactoryPageProps> = () => {
    const [currentTab, setCurrentTab] = useState<string>('0');
    const [userPrincipal, setUserPrincipal] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

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

        checkAuth();
    }, []);

    const handleContractRegistered = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    const handleMarketDeployed = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    if (isLoading) {
        return (
            <Container maxWidth="xl">
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                    <Typography>Loading...</Typography>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl">
            <Box sx={{ py: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Factory
                </Typography>
                <Divider sx={{ mb: 4 }} />

                <TabContext value={currentTab}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <TabList onChange={(event: React.SyntheticEvent, newValue: string) => setCurrentTab(newValue)}>
                            <Tab label="Deploy Market" value="0" />
                            <Tab label="Deploy Contract" value="1" />
                            <Tab label="List Markets" value="2" />
                            <Tab label="Factory Contracts" value="3" />
                        </TabList>
                    </Box>

                    <TabPanel value="0">
                        <DeployMarket userPrincipal={userPrincipal} onSuccess={handleMarketDeployed} />
                    </TabPanel>
                    <TabPanel value="1">
                        <DeployContract userPrincipal={userPrincipal} onSuccess={handleContractRegistered} />
                    </TabPanel>
                    <TabPanel value="2">
                        <ListMarkets key={`markets-${refreshTrigger}`} />
                    </TabPanel>
                    <TabPanel value="3">
                        <FactoryContracts key={`contracts-${refreshTrigger}`} />
                    </TabPanel>
                </TabContext>
            </Box>
        </Container>
    );
};

export default FactoryPage; 