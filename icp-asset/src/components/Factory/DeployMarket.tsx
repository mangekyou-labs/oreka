import React, { useState, useEffect } from 'react';
import {
    Box, Button, Typography, TextField, CircularProgress, Alert,
    Paper, Grid, Divider, Select, MenuItem, InputAdornment,
    Slider, Tooltip, ListItem, ListItemText, List
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { FaSync, FaArrowUp, FaArrowDown, FaClock } from 'react-icons/fa';
import { FactoryApiService } from '../../service/FactoryService';

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

    const handleDeployMarket = async () => {
        try {
            // Basic validation
            if (!selectedCoin) {
                setErrorMsg("Please select a trading pair");
                setDeploymentStage(0);
                setIsLoading(false);
                return;
            }

            setDeploymentStage(1);
            setErrorMsg("");
            setSuccessMsg("");

            // Convert strike price to a proper float (not an integer)
            const strikePriceFloat = parseFloat(strikePrice);

            // Validate the strike price
            if (isNaN(strikePriceFloat) || strikePriceFloat <= 0) {
                setErrorMsg("Strike price must be a positive number");
                setDeploymentStage(0);
                setIsLoading(false);
                return;
            }

            // Prepare market name and validate
            const marketNameTrimmed = marketName.trim();
            if (marketNameTrimmed.length === 0) {
                setErrorMsg("Market name cannot be empty");
                setDeploymentStage(0);
                setIsLoading(false);
                return;
            }

            // Check for special characters that might cause issues
            if (/[&<>"]/.test(marketNameTrimmed)) {
                console.warn("Market name contains special characters that might cause issues");
                setErrorMsg("Please avoid using special characters like &, <, >, \" in the market name");
                setDeploymentStage(0);
                setIsLoading(false);
                return;
            }

            // Validate userPrincipal - make sure we have the owner's principal ID
            if (!userPrincipal) {
                console.warn("Missing user principal ID - will use default owner");
            } else {
                console.log("Using user principal as owner:", userPrincipal);
            }

            // Get trading pair from selected coin
            const tradingPair = selectedCoin.value;

            // Calculate expiry timestamp (convert from local date/time to UTC timestamp in seconds)
            const targetDate = new Date(`${maturityDate}T${maturityTime}`);
            const targetDateMs = targetDate.getTime();

            // Validate expiry time is in the future
            if (targetDateMs <= Date.now()) {
                setErrorMsg("Expiry time must be in the future");
                setDeploymentStage(0);
                setIsLoading(false);
                return;
            }

            const expiryTimestamp = BigInt(Math.floor(targetDateMs / 1000));

            // Make sure expiry is properly converted to bigint
            const expiryAsBigInt = BigInt(expiryTimestamp);

            // Instantiate the factory service
            const factoryService = new FactoryApiService();

            // Log the parameters we're going to use
            console.log("Deploying market with dfx-compatible interface:", {
                name: marketNameTrimmed,        // (1) Text
                strikePrice: strikePriceFloat,  // (2) Float64 (number)
                expiry: expiryAsBigInt.toString(), // (3) Nat64 (bigint)
                owner: userPrincipal || "default" // (4) Owner principal
            });

            let result;
            try {
                // Call with the exact same format as the successful dfx CLI command
                console.log("About to call deployMarketDfx with these exact parameters:");
                console.log("- Market Name:", JSON.stringify(marketNameTrimmed));
                console.log("- Strike Price:", JSON.stringify(strikePriceFloat));
                console.log("- Expiry:", JSON.stringify(expiryAsBigInt.toString()));
                console.log("- Owner:", userPrincipal || "default");

                // Test serialization first
                const serializationResult = factoryService.debugSerialize([
                    marketNameTrimmed,
                    strikePriceFloat,
                    expiryAsBigInt.toString(),
                    userPrincipal || "default"
                ]);
                console.log("Serialization test result:", serializationResult);

                // The factory canister's deployMarket function should use the caller as owner by default,
                // but also allow an explicit owner parameter which we're passing now
                result = await factoryService.deployMarketDfx(
                    marketNameTrimmed,      // (1) name: Text 
                    strikePriceFloat,       // (2) strikePrice: Float64 (number)
                    expiryAsBigInt          // (3) expiry: Nat64 (bigint)
                    // userPrincipal is not used directly in the backend call, as the
                    // Factory canister will use the caller as the owner
                );

                console.log("Market deployment result:", result);
            } catch (error) {
                console.error("Error during deployment call:", error);
                // Add more detailed error information
                if (error instanceof Error) {
                    console.error("Error name:", error.name);
                    console.error("Error message:", error.message);
                    console.error("Error stack:", error.stack);

                    if (error.message.includes("&")) {
                        setErrorMsg("Error: Special character '&' found. Please avoid using special characters in the market name.");
                    } else {
                        setErrorMsg(`Error during deployment: ${error.message}`);
                    }
                } else {
                    setErrorMsg(`Error during deployment: ${String(error)}`);
                }
                setDeploymentStage(0);
                setIsLoading(false);
                return;
            }

            if ('ok' in result && result.ok) {
                setDeploymentStage(3); // Finished
                try {
                    // Try to get the canister ID as a string
                    const canisterId = result.ok.toString();
                    console.log("Canister ID as string:", canisterId);

                    if (canisterId && canisterId !== "null") {
                        setSuccessMsg(
                            `Market canister created successfully with ID: ${canisterId}\n\n` +
                            `Market is now ready for trading!`
                        );

                        if (onSuccess) {
                            onSuccess(canisterId);
                        }

                        // Reset form after a delay
                        setTimeout(() => {
                            // Reset form
                            setSelectedCoin(null);
                            setStrikePrice('');
                            setMarketName('');
                            setDeploymentStage(0); // Reset stage
                        }, 5000);
                    } else {
                        setErrorMsg(`Failed to deploy market: Invalid canister ID (${canisterId})`);
                        setDeploymentStage(0); // Reset on error
                    }
                } catch (err) {
                    console.error("Error processing canister ID:", err);
                    setErrorMsg(`Failed to process canister ID: ${err instanceof Error ? err.message : String(err)}`);
                    setDeploymentStage(0); // Reset on error
                }
            } else {
                const errorMessage = 'err' in result ? result.err : "Result is missing canister ID";

                if (typeof errorMessage === 'string') {
                    if (errorMessage.includes("type") || errorMessage.includes("argument")) {
                        console.error("Detailed parameter error:", errorMessage);
                        setErrorMsg(`Type error in market parameters: ${errorMessage}. The order of parameters may be incorrect or the value types don't match what's expected.`);
                    } else if (errorMessage.includes("cycles")) {
                        setErrorMsg(`Deployment failed due to insufficient cycles: ${errorMessage}`);
                    } else if (errorMessage.includes("expiry") || errorMessage.includes("future")) {
                        setErrorMsg(`Invalid expiry time: ${errorMessage}. Please select a valid date and time in the future.`);
                    } else {
                        setErrorMsg(`Failed to deploy market: ${errorMessage}`);
                    }
                } else {
                    setErrorMsg(`Failed to deploy market: Unknown error occurred`);
                }

                setDeploymentStage(0); // Reset on error
            }
        } catch (error) {
            console.error('Unexpected deploy error:', error);
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
                        <Grid item xs={6}>
                            <Typography color="white" fontWeight="bold" mb={1}>MATURITY DATE:</Typography>
                            <StyledTextField
                                fullWidth
                                type="date"
                                value={maturityDate}
                                onChange={(e) => setMaturityDate(e.target.value)}
                                variant="outlined"
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <Typography color="white" fontWeight="bold" mb={1}>TIME (EST):</Typography>
                            <StyledTextField
                                fullWidth
                                type="time"
                                value={maturityTime}
                                onChange={(e) => setMaturityTime(e.target.value)}
                                variant="outlined"
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <FaClock />
                                        </InputAdornment>
                                    ),
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
                                    {maturityDate || 'Not set'} {maturityTime ? `${maturityTime} (EST)` : ''}
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