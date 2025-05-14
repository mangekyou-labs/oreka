const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

/**
 * Script to generate environment variables from canister IDs
 * Run with: node scripts/generate-env.js
 */

// Helper function to get a canister ID
function getCanisterId(canisterName) {
    try {
        return execSync(`dfx canister id ${canisterName}`)
            .toString()
            .trim();
    } catch (error) {
        console.error(`Failed to get canister ID for ${canisterName}:`, error.message);
        return null;
    }
}

// Get canister IDs
const factoryId = getCanisterId('factory');
const ledgerId = getCanisterId('icp_ledger_canister');

if (!factoryId || !ledgerId) {
    console.error('Failed to get required canister IDs. Make sure dfx is running and canisters are deployed.');
    process.exit(1);
}

// Generate development environment content
const devEnvContent = `NEXT_PUBLIC_FACTORY_CANISTER_ID=${factoryId}
NEXT_PUBLIC_ICP_LEDGER_CANISTER_ID=${ledgerId}
NEXT_PUBLIC_IC_HOST=http://localhost:4943
DFX_NETWORK=local
`;

// Generate production environment content
const prodEnvContent = `NEXT_PUBLIC_FACTORY_CANISTER_ID=t2xwy-pyaaa-aaaar-qblaq-cai
NEXT_PUBLIC_ICP_LEDGER_CANISTER_ID=ryjl3-tyaaa-aaaaa-aaaba-cai
NEXT_PUBLIC_IC_HOST=https://ic0.app
DFX_NETWORK=ic
`;

// Define file paths
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envDevPath = path.join(__dirname, '..', '.env.development');
const envProdPath = path.join(__dirname, '..', '.env.production');

// Write to files
try {
    fs.writeFileSync(envLocalPath, devEnvContent);
    console.log(`Created ${envLocalPath}`);

    fs.writeFileSync(envDevPath, devEnvContent);
    console.log(`Created ${envDevPath}`);

    fs.writeFileSync(envProdPath, prodEnvContent);
    console.log(`Created ${envProdPath}`);

    console.log('Environment files generated successfully!');
} catch (error) {
    console.error('Error writing environment files:', error);
    process.exit(1);
} 