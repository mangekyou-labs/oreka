const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const router = express.Router();

/**
 * Deploy Binary Option Market WASM to an existing canister
 * @route POST /api/deploy/market
 * @param {string} canisterId - The canister ID to deploy to
 * @param {number} strikePrice - The strike price for the market
 * @param {number} maturityTimestamp - The maturity timestamp in seconds
 * @param {number} feePercentage - The fee percentage (0-100)
 * @param {string} tradingPair - The trading pair (default: ICP-USD)
 * @returns {object} Success status and output or error message
 */
router.post('/market', async (req, res, next) => {
    try {
        const { canisterId, strikePrice, maturityTimestamp, feePercentage, tradingPair = 'ICP-USD' } = req.body;

        // Validate required parameters
        if (!canisterId) {
            return res.status(400).json({ error: 'Missing canister ID' });
        }
        if (!strikePrice || isNaN(parseFloat(strikePrice))) {
            return res.status(400).json({ error: 'Invalid strike price' });
        }
        if (!maturityTimestamp || isNaN(parseInt(maturityTimestamp))) {
            return res.status(400).json({ error: 'Invalid maturity timestamp' });
        }
        if (!feePercentage || isNaN(parseInt(feePercentage))) {
            return res.status(400).json({ error: 'Invalid fee percentage' });
        }

        console.log('Deploying binary option market to canister:', canisterId);
        console.log('Parameters:', {
            strikePrice,
            maturityTimestamp,
            feePercentage,
            tradingPair
        });

        // Create a promise that resolves when the script completes
        const deployMarket = () => {
            return new Promise((resolve, reject) => {
                // Path to the deploy-market.sh script (assuming it's in the root directory)
                const scriptPath = path.join(process.cwd(), 'deploy-market.sh');

                // Spawn a child process to run the script
                const child = spawn('bash', [
                    scriptPath,
                    canisterId,
                    strikePrice.toString(),
                    maturityTimestamp.toString(),
                    feePercentage.toString(),
                    tradingPair
                ]);

                let stdout = '';
                let stderr = '';

                // Collect output
                child.stdout.on('data', (data) => {
                    stdout += data.toString();
                    console.log(`stdout: ${data}`);
                });

                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                    console.error(`stderr: ${data}`);
                });

                // Handle completion
                child.on('close', (code) => {
                    if (code === 0) {
                        resolve({ success: true, output: stdout });
                    } else {
                        reject(new Error(`Deploy script failed with code ${code}: ${stderr}`));
                    }
                });

                // Handle errors
                child.on('error', (err) => {
                    reject(new Error(`Failed to execute deploy script: ${err.message}`));
                });
            });
        };

        // Execute the deployment
        const result = await deployMarket();

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Binary option market deployed successfully',
            canisterId,
            details: result
        });
    } catch (error) {
        console.error('Deployment error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to deploy binary option market'
        });
    }
});

/**
 * Get deployment status endpoint
 * @route GET /api/deploy/status/:canisterId
 * @param {string} canisterId - The canister ID to check status
 * @returns {object} Status information for the canister
 */
router.get('/status/:canisterId', async (req, res, next) => {
    try {
        const { canisterId } = req.params;

        if (!canisterId) {
            return res.status(400).json({ error: 'Missing canister ID' });
        }

        // Execute dfx canister info command to get canister status
        const getCanisterInfo = () => {
            return new Promise((resolve, reject) => {
                const child = spawn('dfx', ['canister', 'info', canisterId]);

                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        resolve({ success: true, output: stdout });
                    } else {
                        reject(new Error(`Canister info command failed with code ${code}: ${stderr}`));
                    }
                });

                child.on('error', (err) => {
                    reject(new Error(`Failed to execute canister info command: ${err.message}`));
                });
            });
        };

        const result = await getCanisterInfo();

        // Check if the canister has a module installed
        const hasModule = !result.output.includes('no wasm module') &&
            !result.output.includes('contains no Wasm module');

        res.status(200).json({
            canisterId,
            status: hasModule ? 'deployed' : 'empty',
            hasWasmModule: hasModule,
            details: result.output
        });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            error: error.message || 'Failed to check canister status'
        });
    }
});

module.exports = router; 