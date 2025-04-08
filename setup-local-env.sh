#!/bin/bash

# Setup script for local development environment
echo "Setting up local development environment..."

# Start dfx if not already running
if ! dfx ping; then
    echo "Starting dfx..."
    dfx start --clean --background
    sleep 5
fi

# Clean up existing canisters
echo "Removing existing canisters..."
dfx canister stop --all || true
dfx canister delete --all || true

# Deploy ledger canister
echo "Deploying ICP ledger canister..."
dfx deploy icp_ledger_canister

# Get ledger canister ID
LEDGER_ID=$(dfx canister id icp_ledger_canister)
echo "Ledger canister deployed with ID: $LEDGER_ID"

# Deploy binary option market canister
echo "Deploying binary option market canister..."
dfx deploy binary_option_market

# Get binary option market canister ID
MARKET_ID=$(dfx canister id binary_option_market)
echo "Binary option market canister deployed with ID: $MARKET_ID"

# Deploy factory canister
echo "Deploying factory canister..."
dfx deploy factory

# Get factory canister ID
FACTORY_ID=$(dfx canister id factory)
echo "Factory canister deployed with ID: $FACTORY_ID"

# Generate environment variables
echo "Generating environment variables..."
node icp-asset/scripts/generate-env.js

echo "Local environment setup complete!"
echo "Factory canister ID: $FACTORY_ID"
echo "Market canister ID: $MARKET_ID"
echo "Ledger canister ID: $LEDGER_ID"
echo ""
echo "You can now run:"
echo "  cd icp-asset && npm run dev" 