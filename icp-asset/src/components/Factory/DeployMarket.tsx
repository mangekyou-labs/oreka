import React, { useState, useEffect } from 'react';
import {
    Box, Button, Typography, TextField, CircularProgress, Alert,
    Paper, Grid, Divider, Select, MenuItem, InputAdornment,
    Slider, Tooltip, ListItem, ListItemText, List, Input
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { FaSync, FaArrowUp, FaArrowDown, FaClock } from 'react-icons/fa';
import { FactoryApiService } from '../../service/FactoryService';
import { AuthClient } from '@dfinity/auth-client';

// Styled components to match EVM version
const GradientBox = styled(Box)(({ theme }) => ({
    background: 'linear-gradient(to right, rgba(15, 23, 42, 0.9), rgba(26, 32, 44, 0.9))',
    borderRadius: theme.shape.borderRadius * 2,
    padding: theme.spacing(3),
    border: '1px solid rgba(255,255,255,0.1)',
}));

const StyledButton = styled(Button)(({ theme }) => ({
    background: 'linear-gradient(90deg, #4A63C8 0%, #6A83E8 100%)',
    color: 'white',
    borderRadius: 50,
    padding: theme.spacing(1.5, 4),
    fontSize: '1.2rem',
    height: 60,
    width: 300,
    '&:hover': {
        background: 'linear-gradient(90deg, #3A53B8 0%, #5A73D8 100%)',
        transform: 'translateY(-2px)',
        boxShadow: theme.shadows[10],
    },
    transition: 'all 0.2s',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
    '& .MuiOutlinedInput-root': {
        height: 60,
        color: 'white',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: theme.shape.borderRadius * 2,
        '& fieldset': {
            borderColor: 'rgba(255,255,255,0.2)',
        },
        '&:hover fieldset': {
            borderColor: 'white',
        },
        '&.Mui-focused fieldset': {
            borderColor: 'white',
            borderWidth: 1,
        },
    },
    '& .MuiInputLabel-root': {
        color: 'rgba(255,255,255,0.7)',
    },
    '& .MuiInputAdornment-root': {
        color: 'white',
    },
}));

const StyledSelect = styled(Select)(({ theme }) => ({
    height: 60,
    color: 'white',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: theme.shape.borderRadius * 2,
    '& .MuiOutlinedInput-notchedOutline': {
        borderColor: 'rgba(255,255,255,0.2)',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: 'white',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: 'white',
        borderWidth: 1,
    },
    '& .MuiSelect-icon': {
        color: 'white',
    },
}));

// Coin interface matching EVM version
interface Coin {
    value: string;
    label: string;
    currentPrice: number;
}

interface DeployMarketProps {
    userPrincipal?: string;
    onSuccess?: (marketId: string) => void;
}

interface FormState {
    name: string;
    strike_price: string;
    hours: string;
}

const DeployMarket: React.FC<DeployMarketProps> = ({ userPrincipal, onSuccess }) => {
    // Form state
    const [marketName, setMarketName] = useState('');
    const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
    const [strikePrice, setStrikePrice] = useState('');
    const [maturityDate, setMaturityDate] = useState('');
    const [maturityTime, setMaturityTime] = useState('');
    const [feePercentage, setFeePercentage] = useState('1.0');
    const [showTooltip, setShowTooltip] = useState(false);

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceChangePercent, setPriceChangePercent] = useState<number>(0);
    const [daysToExercise, setDaysToExercise] = useState<string>('Not set');
    const [deploymentStage, setDeploymentStage] = useState(0); // 0: not started, 1: approving, 2: creating, 3: finished

    // Available coins
    const [availableCoins, setAvailableCoins] = useState<Coin[]>([
        { value: "BTC", label: "Bitcoin (BTC)", currentPrice: 47406.92 },
        { value: "ETH", label: "Ethereum (ETH)", currentPrice: 3521.45 },
        { value: "ICP", label: "Internet Computer (ICP)", currentPrice: 12.87 },
        { value: "SOL", label: "Solana (SOL)", currentPrice: 105.32 }
    ]);

    // State for simplified form
    const [formState, setFormState] = useState<FormState>({
        name: '',
        strike_price: '0.00',
        hours: "72"
    });

    // Set default date and time (tomorrow)
    useEffect(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setMaturityDate(tomorrow.toISOString().split('T')[0]);

        // Set default time (current time)
        const now = new Date();
        setMaturityTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    }, []);

    // Calculate days to exercise
    useEffect(() => {
        if (maturityDate && maturityTime) {
            const now = new Date();
            const maturityDateTime = new Date(`${maturityDate} ${maturityTime}`);

            const diffTime = maturityDateTime.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 0) {
                setDaysToExercise('Expired');
            } else if (diffDays === 1) {
                setDaysToExercise('1 day');
            } else if (diffDays < 30) {
                setDaysToExercise(`${diffDays} days`);
            } else if (diffDays < 365) {
                const months = Math.floor(diffDays / 30);
                setDaysToExercise(`${months} ${months === 1 ? 'month' : 'months'}`);
            } else {
                const years = Math.floor(diffDays / 365);
                const remainingMonths = Math.floor((diffDays % 365) / 30);
                if (remainingMonths === 0) {
                    setDaysToExercise(`${years} ${years === 1 ? 'year' : 'years'}`);
                } else {
                    setDaysToExercise(`${years} ${years === 1 ? 'year' : 'years'}, ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`);
                }
            }
        }
    }, [maturityDate, maturityTime]);

    // Calculate price change percentage when strike price changes
    useEffect(() => {
        if (selectedCoin && strikePrice && strikePrice !== '') {
            const strikePriceNum = parseFloat(strikePrice);
            if (!isNaN(strikePriceNum) && strikePriceNum > 0 && selectedCoin.currentPrice > 0) {
                const changePercent = ((selectedCoin.currentPrice - strikePriceNum) / strikePriceNum) * 100;
                setPriceChangePercent(changePercent);
                setCurrentPrice(selectedCoin.currentPrice);
            }
        }
    }, [selectedCoin, strikePrice]);

    // Fetch current prices
    useEffect(() => {
        const fetchPrices = async () => {
            try {
                // This would be replaced with your actual price fetching logic
                // For demo, we're just using static values
                const updatedCoins = [...availableCoins];
                setAvailableCoins(updatedCoins);

                if (selectedCoin) {
                    const coin = updatedCoins.find(c => c.value === selectedCoin.value);
                    if (coin) {
                        setSelectedCoin(coin);
                        setCurrentPrice(coin.currentPrice);
                    }
                }
            } catch (error) {
                console.error("Error fetching prices:", error);
            }
        };

        fetchPrices();
        // Refresh prices every 60 seconds
        const interval = setInterval(fetchPrices, 60000);

        return () => clearInterval(interval);
    }, []);

    const handleCoinSelect = (event: React.ChangeEvent<{ value: unknown }>) => {
        const value = event.target.value as string;
        const selected = availableCoins.find(coin => coin.value === value);
        setSelectedCoin(selected || null);
        setCurrentPrice(selected?.currentPrice || null);
    };

    const handleFeeSliderChange = (event: Event, value: number | number[]) => {
        setFeePercentage((value as number).toFixed(1));
    };

    const handleFeeInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        if (/^\d*\.?\d*$/.test(value)) {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || value === '') {
                setFeePercentage('');
            } else if (numValue < 0.1) {
                setFeePercentage('0.1');
            } else if (numValue > 20) {
                setFeePercentage('20');
            } else {
                setFeePercentage(numValue.toFixed(1));
            }
        }
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleDeployMarket = async () => {
        // Reset deployment state
        setDeploymentStage(0);
        setErrorMsg("");
        setSuccessMsg("");
        setIsLoading(true);

        try {
            // Validate inputs
            if (!marketName) {
                setErrorMsg("Market name cannot be empty");
                setDeploymentStage(0);
                setIsLoading(false);
                return;
            }

            if (!strikePrice || parseFloat(strikePrice) <= 0) {
                setErrorMsg("Strike price must be greater than 0");
                setDeploymentStage(0);
                setIsLoading(false);
                return;
            }

            if (!selectedCoin) {
                setErrorMsg("You must select a trading pair");
                setDeploymentStage(0);
                setIsLoading(false);
                return;
            }

            if (!maturityDate || !maturityTime) {
                setErrorMsg("You must set a maturity date and time");
                setDeploymentStage(0);
                setIsLoading(false);
                return;
            }

            // Get trading pair from selected coin
            const tradingPair = `${selectedCoin.value}-USD`;

            console.log("Market creation parameters:", {
                name: marketName,
                strike_price: parseFloat(strikePrice),
                maturityDate,
                maturityTime,
                trading_pair: tradingPair,
                selectedCoin
            });

            // Calculate timestamp for expiry using built-in Date
            const datePart = new Date(maturityDate);
            const timeParts = maturityTime.split(':');
            datePart.setHours(parseInt(timeParts[0], 10));
            datePart.setMinutes(parseInt(timeParts[1], 10));
            datePart.setSeconds(0);
            datePart.setMilliseconds(0);

            console.log("Maturity date (User's timezone):", datePart.toString());

            // Convert milliseconds to seconds for the canister
            // The factory expects timestamps in seconds (not milliseconds or nanoseconds)
            const expiryInSeconds = BigInt(Math.floor(datePart.valueOf() / 1000));
            console.log("Expiry timestamp in seconds:", expiryInSeconds.toString());

            // Set deployment stage to initializing
            setDeploymentStage(1);

            // Get authenticated identity
            const authClient = await AuthClient.create();
            if (!authClient.isAuthenticated()) {
                setErrorMsg("You must be logged in to deploy a market");
                setDeploymentStage(0);
                setIsLoading(false);
                return;
            }

            const identity = authClient.getIdentity();
            const principal = identity.getPrincipal().toString();
            console.log("Authenticated identity principal:", principal);

            // Set deployment stage to creating market
            setDeploymentStage(2);

            // Instantiate the factory service WITH the authenticated identity
            const factoryService = new FactoryApiService(identity);

            // Call the deployMarketFinal method with the trading pair
            console.log("Calling deployMarketFinal with:", {
                marketName,
                strikePrice: parseFloat(strikePrice),
                expiryInSeconds: expiryInSeconds.toString(),
                tradingPair
            });

            const result = await factoryService.deployMarketFinal(
                marketName,
                parseFloat(strikePrice),
                expiryInSeconds,
                tradingPair
            );

            console.log("Deployment result:", result);

            if ('ok' in result && result.ok) {
                const canisterId = result.ok.toString();
                console.log(`Market deployed successfully with ID: ${canisterId}`);

                setSuccessMsg(
                    `Market deployed with ID: ${canisterId}\n\n` +
                    `Market is now ready for trading!`
                );
                setDeploymentStage(3);

                // Call the onSuccess callback with the new canister ID
                if (onSuccess) {
                    onSuccess(canisterId);
                }

                // Reset form after successful deployment
                setTimeout(() => {
                    setDeploymentStage(0); // Reset stage
                }, 5000);
            } else if ('err' in result) {
                console.error("Error deploying market:", result.err);
                setErrorMsg(`Error: ${result.err}`);
                setDeploymentStage(0); // Reset on error
            } else {
                console.error("Unknown deployment result:", result);
                setErrorMsg("Unknown deployment result - check console for details");
                setDeploymentStage(0);
            }
        } catch (error) {
            console.error("Exception during deployment:", error);
            setErrorMsg(`An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`);
            setDeploymentStage(0); // Reset on error
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ bgcolor: "#0a1647", color: "white", borderRadius: 2, p: 0 }}>
            <Grid container spacing={0} sx={{ position: 'relative' }}>
                {/* Left side - Market Creation Form */}
                <Grid item xs={12} md={6} sx={{ p: 4 }}>
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h5" fontWeight="bold" color="white">Create New Market</Typography>
                    </Box>

                    {errorMsg && (
                        <Alert severity="error" sx={{ mb: 3, bgcolor: 'rgba(211,47,47,0.1)', color: '#f44336' }}>
                            {errorMsg}
                        </Alert>
                    )}

                    {successMsg && (
                        <Alert severity="success" sx={{ mb: 3, bgcolor: 'rgba(46,125,50,0.1)', color: '#4caf50' }}>
                            <Typography component="div" sx={{ whiteSpace: 'pre-line' }}>
                                {successMsg}
                            </Typography>
                        </Alert>
                    )}

                    <GradientBox sx={{ mb: 3, p: 2 }}>
                        <Typography variant="body2" color="white">
                            Note: When creating a market, you're establishing a binary options contract
                            where users can bid on whether the price will be above (LONG) or below (SHORT)
                            the strike price at maturity. The fee you set (between 0.1% and 20%) will be
                            applied to winning positions and distributed to you as the market creator.
                        </Typography>
                    </GradientBox>

                    <Box sx={{ mb: 3 }}>
                        <Typography color="white" fontWeight="bold" mb={1}>MARKET NAME:</Typography>
                        <StyledTextField
                            fullWidth
                            placeholder="Enter market name"
                            value={marketName}
                            onChange={(e) => setMarketName(e.target.value)}
                            variant="outlined"
                        />
                    </Box>

                    <Box sx={{ mb: 3 }}>
                        <Typography color="white" fontWeight="bold" mb={1}>SELECT ASSET:</Typography>
                        <StyledSelect
                            fullWidth
                            value={selectedCoin?.value || ''}
                            onChange={handleCoinSelect as any}
                            displayEmpty
                            inputProps={{ 'aria-label': 'Select coin' }}
                            variant="outlined"
                        >
                            <MenuItem value="" disabled>
                                <Typography color="text.secondary">Select Trading Pair</Typography>
                            </MenuItem>
                            {availableCoins.map((coin) => (
                                <MenuItem key={coin.value} value={coin.value} sx={{ bgcolor: '#0a1647', color: 'white' }}>
                                    {coin.label}
                                </MenuItem>
                            ))}
                        </StyledSelect>
                    </Box>

                    <Box sx={{ mb: 3 }}>
                        <Typography color="white" fontWeight="bold" mb={1}>STRIKE PRICE:</Typography>
                        <StyledTextField
                            fullWidth
                            placeholder="Enter strike price"
                            value={strikePrice}
                            onChange={(e) => {
                                const value = e.target.value;
                                // Better regex for decimal numbers
                                // Allows: empty, single digit, numbers with decimal points
                                // Examples: "", "5", "123", "0.5", "123.45"
                                if (/^(\d*\.?\d*)?$/.test(value)) {
                                    setStrikePrice(value);
                                }
                            }}
                            variant="outlined"
                            InputProps={{
                                endAdornment: <InputAdornment position="end">$</InputAdornment>,
                            }}
                        />
                        <Typography color="text.secondary" variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                            The strike price can include decimal points (e.g., 2000.50).
                        </Typography>
                    </Box>

                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} md={6}>
                            <Typography color="white" fontWeight="bold" mb={1}>DATE:</Typography>
                            <Input
                                type="date"
                                value={maturityDate}
                                onChange={(e) => setMaturityDate(e.target.value)}
                                sx={{
                                    color: 'white',
                                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '8px',
                                    p: 1,
                                    width: '100%'
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography color="white" fontWeight="bold" mb={1}>TIME:</Typography>
                            <Input
                                type="time"
                                value={maturityTime}
                                onChange={(e) => setMaturityTime(e.target.value)}
                                sx={{
                                    color: 'white',
                                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '8px',
                                    p: 1,
                                    width: '100%'
                                }}
                            />
                        </Grid>
                    </Grid>

                    <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography color="white" fontWeight="bold" mr={1}>FEE:</Typography>
                            <Box sx={{ flex: 1, mx: 2 }}>
                                <Slider
                                    min={0.1}
                                    max={20}
                                    step={0.1}
                                    value={parseFloat(feePercentage) || 0.1}
                                    onChange={handleFeeSliderChange}
                                    onMouseEnter={() => setShowTooltip(true)}
                                    onMouseLeave={() => setShowTooltip(false)}
                                    sx={{
                                        '& .MuiSlider-thumb': {
                                            bgcolor: 'white',
                                        },
                                        '& .MuiSlider-track': {
                                            bgcolor: '#4a63c8',
                                        },
                                        '& .MuiSlider-rail': {
                                            bgcolor: 'rgba(255,255,255,0.1)',
                                        },
                                    }}
                                    valueLabelDisplay={showTooltip ? "on" : "off"}
                                    valueLabelFormat={(value) => `${value}%`}
                                />
                            </Box>
                            <Box sx={{ width: 100 }}>
                                <StyledTextField
                                    value={feePercentage}
                                    onChange={handleFeeInputChange}
                                    variant="outlined"
                                    InputProps={{
                                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                    }}
                                    sx={{ width: 100 }}
                                />
                            </Box>
                        </Box>
                        <Typography color="text.secondary" variant="body2">
                            This fee will be applied to winning positions and distributed to the market creator.
                        </Typography>
                    </Box>
                </Grid>

                {/* Vertical Divider */}
                <Divider orientation="vertical" flexItem sx={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    bgcolor: 'rgba(255,255,255,0.2)'
                }} />

                {/* Right side - Market Details */}
                <Grid item xs={12} md={6} sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Typography
                            variant="h3"
                            fontWeight="bold"
                            sx={{
                                background: 'linear-gradient(90deg, #4A63C8 0%, #6A83E8 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                mb: 4,
                                letterSpacing: 2,
                                textShadow: '0 0 10px rgba(74, 99, 200, 0.7)'
                            }}
                        >
                            OREKA
                        </Typography>

                        <GradientBox sx={{ width: '100%', mb: 3 }}>
                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography color="text.secondary">Strike price</Typography>
                                <Typography color="white" fontWeight="bold" variant="h6">
                                    ${strikePrice || 'Not set'}
                                </Typography>
                            </Box>

                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography color="text.secondary">Current market price</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    {priceChangePercent !== 0 && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                                            {priceChangePercent > 0 ? (
                                                <FaArrowUp style={{ color: 'green' }} />
                                            ) : (
                                                <FaArrowDown style={{ color: 'red' }} />
                                            )}
                                            <Typography
                                                color={priceChangePercent > 0 ? 'green' : 'red'}
                                            >
                                                {Math.abs(priceChangePercent).toFixed(2)}%
                                            </Typography>
                                        </Box>
                                    )}
                                    <Typography color="white" fontWeight="bold" variant="h6">
                                        ${currentPrice ? currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Loading...'}
                                    </Typography>
                                </Box>
                            </Box>

                            <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 2 }} />

                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography color="text.secondary">Maturity date</Typography>
                                <Typography color="white">
                                    {maturityDate || 'Not set'} {maturityTime || ''}
                                </Typography>
                            </Box>

                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography color="text.secondary">Time to exercise</Typography>
                                <Typography color="white">{daysToExercise}</Typography>
                            </Box>

                            <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 2 }} />

                            <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1 }}>
                                <Typography variant="body2" color="white">
                                    Note: When creating a market, you're establishing a binary options contract
                                    where users can bid on whether the price will be above (LONG) or below (SHORT)
                                    the strike price at maturity. The fee you set (between 0.1% and 20%) will be
                                    applied to winning positions and distributed to you as the market creator.
                                </Typography>
                            </Box>
                        </GradientBox>

                        <GradientBox sx={{ width: '100%' }}>
                            <Typography color="white" fontWeight="bold" mb={1}>
                                When creating a market you will:
                            </Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText
                                        primary={`Earn the fee percentage you set (currently ${feePercentage}%) from all winning positions at market expiry.`}
                                        primaryTypographyProps={{ color: 'text.secondary' }}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Control when to start the bidding phase after market creation."
                                        primaryTypographyProps={{ color: 'text.secondary' }}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Pay canister creation fees for deploying the market contract."
                                        primaryTypographyProps={{ color: 'text.secondary' }}
                                    />
                                </ListItem>
                            </List>
                        </GradientBox>
                    </Box>
                </Grid>
            </Grid>

            {/* Progress bar and Create Market Button */}
            <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box sx={{ width: '100%', maxWidth: 600, mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography color={deploymentStage >= 1 ? "white" : "text.secondary"} fontWeight={deploymentStage >= 1 ? "bold" : "normal"}>
                            Initializing
                        </Typography>
                        <Typography color={deploymentStage >= 2 ? "white" : "text.secondary"} fontWeight={deploymentStage >= 2 ? "bold" : "normal"}>
                            Creating market
                        </Typography>
                        <Typography color={deploymentStage >= 3 ? "white" : "text.secondary"} fontWeight={deploymentStage >= 3 ? "bold" : "normal"}>
                            Finished
                        </Typography>
                    </Box>
                    <Box sx={{ position: 'relative', height: 2, bgcolor: 'rgba(255,255,255,0.1)', width: '100%' }}>
                        <Box
                            sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                height: 2,
                                width: `${deploymentStage === 0 ? 0 : deploymentStage === 1 ? 33 : deploymentStage === 2 ? 66 : 100}%`,
                                bgcolor: 'white',
                                transition: 'width 0.5s ease-in-out'
                            }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', position: 'absolute', width: '100%', top: -8 }}>
                            <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: deploymentStage >= 1 ? 'white' : 'rgba(255,255,255,0.1)' }} />
                            <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: deploymentStage >= 2 ? 'white' : 'rgba(255,255,255,0.1)' }} />
                            <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: deploymentStage >= 3 ? 'white' : 'rgba(255,255,255,0.1)' }} />
                        </Box>
                    </Box>
                </Box>

                <StyledButton
                    onClick={handleDeployMarket}
                    disabled={isLoading || !marketName || !selectedCoin || !strikePrice || !maturityDate || !maturityTime}
                >
                    {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Create market'}
                </StyledButton>
            </Box>
        </Box>
    );
};

export default DeployMarket; 