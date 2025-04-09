const { Actor, HttpAgent } = require('@dfinity/agent');
const { Principal } = require('@dfinity/principal');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Read the market deployer candid interface
const didFile = fs.readFileSync(path.join(__dirname, '../../.dfx/local/canisters/market_deployer/market_deployer.did'), 'utf8');

// Parse the DID file to create the IDL factory
const { IDL } = require('@dfinity/candid');
const idlFactory = ({ IDL }) => {
    const DeployedMarket = IDL.Record({
        'canister_id': IDL.Principal,
        'owner': IDL.Principal,
        'name': IDL.Text,
        'created_at': IDL.Nat64,
    });
    const DeploymentError = IDL.Variant({
        'InvalidParams': IDL.Text,
        'CanisterCreationFailed': IDL.Text,
        'ControllerUpdateFailed': IDL.Text,
        'CodeInstallationFailed': IDL.Text,
        'InsufficientCycles': IDL.Null,
        'Unknown': IDL.Text,
    });
    const MarketParams = IDL.Record({
        'name': IDL.Text,
        'strike_price': IDL.Float64,
        'maturity_time': IDL.Int64,
        'fee_percentage': IDL.Nat64,
        'trading_pair': IDL.Text,
    });
    const Result = IDL.Variant({ 'ok': IDL.Principal, 'err': DeploymentError });
    return IDL.Service({
        'accept_cycles': IDL.Func([], [IDL.Nat], []),
        'cycles_balance': IDL.Func([], [IDL.Nat], ['query']),
        'deploy_market': IDL.Func([MarketParams], [Result], []),
        'get_all_markets': IDL.Func([], [IDL.Vec(DeployedMarket)], ['query']),
        'get_markets_by_owner': IDL.Func([IDL.Principal], [IDL.Vec(DeployedMarket)], ['query']),
    });
};

// Configure the API
const CONFIG = {
    // Local development
    local: {
        host: 'http://localhost:4943',
        canisterId: process.env.MARKET_DEPLOYER_ID || 'bw4dl-smaaa-aaaaa-qaacq-cai', // Replace with your local canister ID
    },
    // Production environment on the IC
    ic: {
        host: 'https://ic0.app',
        canisterId: process.env.MARKET_DEPLOYER_ID || 'rrkah-fqaaa-aaaaa-aaaaq-cai', // Replace with your production canister ID
    },
    // Choose environment based on NODE_ENV
    get current() {
        return process.env.DFX_NETWORK === 'ic' ? this.ic : this.local;
    }
};

// Create an agent and actor
const createActor = () => {
    // Configure the agent
    const agent = new HttpAgent({
        host: CONFIG.current.host,
        fetch
    });

    // Only fetch the root key in local development
    if (CONFIG.current === CONFIG.local) {
        agent.fetchRootKey().catch(err => {
            console.warn('Unable to fetch root key. Check if your local replica is running');
            console.error(err);
        });
    }

    // Create and return the actor
    return Actor.createActor(idlFactory, {
        agent,
        canisterId: CONFIG.current.canisterId,
    });
};

/**
 * API endpoint for deploying a new binary option market
 */
module.exports = async (req, res) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Extract parameters from request body
        const { name, strikePrice, maturityTime, feePercentage, tradingPair } = req.body;

        // Validate required parameters
        if (!name || !strikePrice || !maturityTime || feePercentage === undefined || !tradingPair) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['name', 'strikePrice', 'maturityTime', 'feePercentage', 'tradingPair']
            });
        }

        // Create the market parameters
        const marketParams = {
            name,
            strike_price: Number(strikePrice),
            maturity_time: BigInt(maturityTime),
            fee_percentage: BigInt(feePercentage),
            trading_pair: tradingPair
        };

        // Deploy the market using the canister
        const actor = createActor();
        const result = await actor.deploy_market(marketParams);

        // Return the result
        if ('ok' in result) {
            return res.status(200).json({
                success: true,
                canisterId: result.ok.toText(),
                message: `Market deployed successfully with canister ID: ${result.ok.toText()}`
            });
        } else {
            let errorMsg = 'Unknown error';

            // Format the error message based on the error type
            if ('InvalidParams' in result.err) {
                errorMsg = `Invalid parameters: ${result.err.InvalidParams}`;
            } else if ('CanisterCreationFailed' in result.err) {
                errorMsg = `Failed to create canister: ${result.err.CanisterCreationFailed}`;
            } else if ('ControllerUpdateFailed' in result.err) {
                errorMsg = `Failed to set controllers: ${result.err.ControllerUpdateFailed}`;
            } else if ('CodeInstallationFailed' in result.err) {
                errorMsg = `Failed to install code: ${result.err.CodeInstallationFailed}`;
            } else if ('InsufficientCycles' in result.err) {
                errorMsg = 'Insufficient cycles to create a new canister';
            } else if ('Unknown' in result.err) {
                errorMsg = `Error: ${result.err.Unknown}`;
            }

            return res.status(400).json({
                success: false,
                error: errorMsg,
                details: result.err
            });
        }
    } catch (error) {
        console.error('Error deploying market:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
};

// For local testing
if (require.main === module) {
    const mockReq = {
        method: 'POST',
        body: {
            name: 'BTC-USD Test Market',
            strikePrice: 60000.0,
            maturityTime: 86400, // 24 hours in seconds
            feePercentage: 1,
            tradingPair: 'BTC-USD'
        }
    };

    const mockRes = {
        status: (code) => ({
            json: (data) => {
                console.log(`Status Code: ${code}`);
                console.log('Response:', JSON.stringify(data, null, 2));
            }
        })
    };

    // Call the endpoint handler
    module.exports(mockReq, mockRes)
        .catch(err => console.error('Error running test:', err));
} 