import React, { useState } from 'react';
import {
    Box, Button, Typography, TextField, CircularProgress, Alert,
    Paper, Grid, Divider, InputAdornment, Slider, Tooltip, ListItem, ListItemText, List
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { FaCoins, FaInfoCircle } from 'react-icons/fa';
import { FactoryApiService } from '../../service/FactoryService';

// Styled components
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

interface TokenCreationProps {
    userPrincipal?: string;
    onSuccess?: (tokenId: string) => void;
}

const TokenCreation: React.FC<TokenCreationProps> = ({ userPrincipal, onSuccess }) => {
    // Form state
    const [tokenName, setTokenName] = useState('');
    const [tokenSymbol, setTokenSymbol] = useState('');
    const [decimals, setDecimals] = useState('8');
    const [initialSupply, setInitialSupply] = useState('1000000');
    const [fee, setFee] = useState('10000');
    const [showTooltip, setShowTooltip] = useState(false);

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [deploymentStage, setDeploymentStage] = useState(0); // 0: not started, 1: initializing, 2: creating, 3: finished

    const handleDeployToken = async () => {
        try {
            // Enhanced Validation
            if (!tokenName || tokenName.trim() === '') {
                setErrorMsg('Please enter a token name');
                return;
            }

            if (!tokenSymbol || tokenSymbol.trim() === '') {
                setErrorMsg('Please enter a token symbol');
                return;
            }

            // Validate token symbol (typically 2-6 uppercase letters)
            if (!/^[A-Z0-9]{2,6}$/.test(tokenSymbol)) {
                setErrorMsg('Token symbol should be 2-6 uppercase letters or numbers');
                return;
            }

            // Validate decimals
            const decimalsNum = parseInt(decimals);
            if (isNaN(decimalsNum) || decimalsNum < 0 || decimalsNum > 255) {
                setErrorMsg('Decimals must be a number between 0 and 255');
                return;
            }

            // Validate initial supply
            const initialSupplyNum = parseInt(initialSupply);
            if (isNaN(initialSupplyNum) || initialSupplyNum <= 0) {
                setErrorMsg('Initial supply must be a positive number');
                return;
            }

            // Validate fee
            const feeNum = parseInt(fee);
            if (isNaN(feeNum) || feeNum < 0) {
                setErrorMsg('Fee must be a non-negative number');
                return;
            }

            // Start the deployment process
            setIsLoading(true);
            setErrorMsg('');
            setSuccessMsg('');
            setDeploymentStage(1); // Initializing stage

            // Simulate initialization stage
            await new Promise(resolve => setTimeout(resolve, 1500));

            setDeploymentStage(2); // Creating token

            const factoryService = new FactoryApiService();

            console.log("Calling deployToken with params:", {
                tokenName,
                tokenSymbol,
                decimals: decimalsNum,
                initialSupply: initialSupplyNum,
                fee: feeNum
            });

            const result = await factoryService.deployToken(
                tokenName,        // Text
                tokenSymbol,      // Text
                decimalsNum,      // Nat8
                initialSupplyNum, // Nat
                feeNum           // Nat
            );

            console.log("Deploy token result:", result);

            if ('ok' in result && result.ok) {
                setDeploymentStage(3); // Finished
                try {
                    // Try to get the canister ID as a string
                    const canisterId = result.ok.toString();
                    console.log("Canister ID as string:", canisterId);

                    if (canisterId && canisterId !== "null") {
                        setSuccessMsg(
                            `Token canister created successfully with ID: ${canisterId}\n\n` +
                            `Token is now ready for use!`
                        );

                        if (onSuccess) {
                            onSuccess(canisterId);
                        }

                        // Reset form after a delay
                        setTimeout(() => {
                            // Reset form
                            setTokenName('');
                            setTokenSymbol('');
                            setDecimals('8');
                            setInitialSupply('1000000');
                            setFee('10000');
                            setDeploymentStage(0); // Reset stage
                        }, 5000);
                    } else {
                        setErrorMsg(`Failed to deploy token: Invalid canister ID (${canisterId})`);
                        setDeploymentStage(0); // Reset on error
                    }
                } catch (err) {
                    console.error("Error processing canister ID:", err);
                    setErrorMsg(`Failed to process canister ID: ${err instanceof Error ? err.message : String(err)}`);
                    setDeploymentStage(0); // Reset on error
                }
            } else {
                const errorMessage = 'err' in result ? result.err : "Result is missing canister ID";

                // Provide more user-friendly error messages based on the error content
                if (typeof errorMessage === 'string') {
                    if (errorMessage.includes("type") || errorMessage.includes("argument")) {
                        setErrorMsg(`Type error in token parameters: ${errorMessage}. Please check that all values are valid.`);
                    } else if (errorMessage.includes("cycles")) {
                        setErrorMsg(
                            `Deployment failed due to insufficient cycles: ${errorMessage}\n\n` +
                            `This means the factory canister has run out of cycles, which are required to create new tokens. ` +
                            `Please contact the administrator to add more cycles to the factory canister.`
                        );
                    } else if (errorMessage.includes("decimals")) {
                        setErrorMsg(`Invalid decimals value: ${errorMessage}. Please enter a value between 0 and 255.`);
                    } else {
                        setErrorMsg(`Failed to deploy token: ${errorMessage}`);
                    }
                } else {
                    setErrorMsg(`Failed to deploy token: Unknown error occurred`);
                }

                setDeploymentStage(0); // Reset on error
            }
        } catch (error) {
            console.error('Unexpected deploy error:', error);

            // Provide user-friendly error message based on error type
            if (error instanceof Error) {
                if (error.message.includes("Internet connection")) {
                    setErrorMsg(`Network error: Please check your internet connection and try again.`);
                } else if (error.message.includes("timeout")) {
                    setErrorMsg(`Request timed out: The operation took too long. Please try again later.`);
                } else {
                    setErrorMsg(`An unexpected error occurred: ${error.message}`);
                }
            } else {
                setErrorMsg(`An unknown error occurred. Please try again later.`);
            }

            setDeploymentStage(0); // Reset on error
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ bgcolor: "#0a1647", color: "white", borderRadius: 2, p: 0 }}>
            <Grid container spacing={0} sx={{ position: 'relative' }}>
                {/* Left side - Token Creation Form */}
                <Grid item xs={12} md={6} sx={{ p: 4 }}>
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h5" fontWeight="bold" color="white">Create New ICRC-1 Token</Typography>
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
                            Note: When creating a token, you're establishing a new ICRC-1 token canister.
                            The token will be fully compliant with the ICRC-1 standard, making it compatible
                            with any application that supports this standard. You will be the default admin.
                        </Typography>
                    </GradientBox>

                    <Box sx={{ mb: 3 }}>
                        <Typography color="white" fontWeight="bold" mb={1}>TOKEN NAME:</Typography>
                        <StyledTextField
                            fullWidth
                            placeholder="Enter token name"
                            value={tokenName}
                            onChange={(e) => setTokenName(e.target.value)}
                            variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                            The full name of your token (e.g., "Internet Computer")
                        </Typography>
                    </Box>

                    <Box sx={{ mb: 3 }}>
                        <Typography color="white" fontWeight="bold" mb={1}>TOKEN SYMBOL:</Typography>
                        <StyledTextField
                            fullWidth
                            placeholder="Enter token symbol"
                            value={tokenSymbol}
                            onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                            variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                            The abbreviated symbol for your token (e.g., "ICP"). Typically 2-6 uppercase letters.
                        </Typography>
                    </Box>

                    <Box sx={{ mb: 3 }}>
                        <Typography color="white" fontWeight="bold" mb={1}>DECIMALS:</Typography>
                        <StyledTextField
                            fullWidth
                            placeholder="Enter decimals"
                            value={decimals}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (/^\d*$/.test(value) && parseInt(value) <= 255) {
                                    setDecimals(value);
                                }
                            }}
                            variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                            The number of decimal places your token supports (e.g., 8 for ICP). Range: 0-255
                        </Typography>
                    </Box>

                    <Box sx={{ mb: 3 }}>
                        <Typography color="white" fontWeight="bold" mb={1}>INITIAL SUPPLY:</Typography>
                        <StyledTextField
                            fullWidth
                            placeholder="Enter initial supply"
                            value={initialSupply}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (/^\d*$/.test(value)) {
                                    setInitialSupply(value);
                                }
                            }}
                            variant="outlined"
                            InputProps={{
                                endAdornment: <InputAdornment position="end">tokens</InputAdornment>,
                            }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            The initial supply of tokens (whole units, not counting decimals)
                        </Typography>
                    </Box>

                    <Box sx={{ mb: 3 }}>
                        <Typography color="white" fontWeight="bold" mb={1}>TRANSACTION FEE:</Typography>
                        <StyledTextField
                            fullWidth
                            placeholder="Enter transaction fee"
                            value={fee}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (/^\d*$/.test(value)) {
                                    setFee(value);
                                }
                            }}
                            variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                            The fee charged for each transaction (in the smallest token unit)
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

                {/* Right side - Token Details */}
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
                                <Typography color="text.secondary">Token Name</Typography>
                                <Typography color="white" fontWeight="bold" variant="h6">
                                    {tokenName || 'Not set'}
                                </Typography>
                            </Box>

                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography color="text.secondary">Token Symbol</Typography>
                                <Typography color="white" fontWeight="bold" variant="h6">
                                    {tokenSymbol || 'Not set'}
                                </Typography>
                            </Box>

                            <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 2 }} />

                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography color="text.secondary">Decimals</Typography>
                                <Typography color="white">
                                    {decimals || '0'}
                                </Typography>
                            </Box>

                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography color="text.secondary">Initial Supply</Typography>
                                <Typography color="white">
                                    {initialSupply ? parseInt(initialSupply).toLocaleString() : '0'} {tokenSymbol}
                                </Typography>
                            </Box>

                            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography color="text.secondary">Transaction Fee</Typography>
                                <Typography color="white">
                                    {fee || '0'} (smallest units)
                                </Typography>
                            </Box>

                            <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', my: 2 }} />

                            <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1 }}>
                                <Typography variant="body2" color="white">
                                    <FaInfoCircle style={{ marginRight: '8px', display: 'inline' }} />
                                    Your token will be ICRC-1 compliant, which is the Internet Computer's standard
                                    for fungible tokens. You will be the default admin of the token, and the initial supply
                                    will be minted to your principal ID.
                                </Typography>
                            </Box>
                        </GradientBox>

                        <GradientBox sx={{ width: '100%' }}>
                            <Typography color="white" fontWeight="bold" mb={1}>
                                When creating a token you will:
                            </Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText
                                        primary="Become the default admin with full control over the token"
                                        primaryTypographyProps={{ color: 'text.secondary' }}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Receive the entire initial supply in your account"
                                        primaryTypographyProps={{ color: 'text.secondary' }}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Pay canister creation fees for deploying the token contract"
                                        primaryTypographyProps={{ color: 'text.secondary' }}
                                    />
                                </ListItem>
                            </List>
                        </GradientBox>
                    </Box>
                </Grid>
            </Grid>

            {/* Progress bar and Create Token Button */}
            <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box sx={{ width: '100%', maxWidth: 600, mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography color={deploymentStage >= 1 ? "white" : "text.secondary"} fontWeight={deploymentStage >= 1 ? "bold" : "normal"}>
                            Initializing
                        </Typography>
                        <Typography color={deploymentStage >= 2 ? "white" : "text.secondary"} fontWeight={deploymentStage >= 2 ? "bold" : "normal"}>
                            Creating token
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
                    onClick={handleDeployToken}
                    disabled={isLoading || !tokenName || !tokenSymbol || !decimals || !initialSupply || !fee}
                >
                    {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Create Token'}
                </StyledButton>
            </Box>
        </Box>
    );
};

export default TokenCreation; 