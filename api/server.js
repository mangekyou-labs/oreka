const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const deployEndpoint = require('./deploy');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Market Deployer API is running' });
});

// Deploy endpoint
app.post('/api/deploy', async (req, res) => {
    try {
        // Pass the request to the deploy endpoint handler
        await deployEndpoint(req, res);
    } catch (error) {
        console.error('Unhandled error in deploy endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Market Deployer API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`DFX Network: ${process.env.DFX_NETWORK || 'local'}`);

    if (!process.env.MARKET_DEPLOYER_ID) {
        console.warn('WARNING: MARKET_DEPLOYER_ID environment variable not set. Using default canister ID.');
    }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
}); 