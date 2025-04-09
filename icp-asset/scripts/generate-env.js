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

// Generate environment content
const envContent = `NEXT_PUBLIC_FACTORY_CANISTER_ID=${factoryId}
NEXT_PUBLIC_ICP_LEDGER_CANISTER_ID=${ledgerId}
NEXT_PUBLIC_IC_HOST=http://localhost:4943
DFX_NETWORK=local
`;

// Define file paths
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envDevPath = path.join(__dirname, '..', '.env.development');

// Write to files
try {
    fs.writeFileSync(envLocalPath, envContent);
    console.log(`Created ${envLocalPath}`);

    fs.writeFileSync(envDevPath, envContent);
    console.log(`Created ${envDevPath}`);

    console.log('Environment files generated successfully!');
} catch (error) {
    console.error('Error writing environment files:', error);
    process.exit(1);
} 