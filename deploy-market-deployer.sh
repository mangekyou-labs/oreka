#!/bin/bash
set -e

echo "Building binary option market WASM..."
dfx build binary_option_market

echo "Copying binary_option_market WASM to market_deployer canister directory..."
mkdir -p canisters/market_deployer/src
cp .dfx/local/canisters/binary_option_market/binary_option_market.wasm canisters/market_deployer/binary_option_market.wasm

echo "Deploying market_deployer canister..."
dfx deploy market_deployer

# Get canister ID
MARKET_DEPLOYER_ID=$(dfx canister id market_deployer)

echo "Market deployer canister deployed with ID: $MARKET_DEPLOYER_ID"
echo "Adding cycles to the market_deployer canister..."
dfx canister deposit-cycles 2000000000000 $MARKET_DEPLOYER_ID

echo "Updating .env.local with market deployer canister ID..."
echo "NEXT_PUBLIC_MARKET_DEPLOYER_ID=$MARKET_DEPLOYER_ID" >> icp-asset/.env.local

echo "Deployment complete!"
echo "Use the market deployer to create and deploy binary option markets."
echo "Example call: dfx canister call market_deployer deploy_market '(record { name = \"BTC-USD Market\"; strike_price = 60000.0; maturity_time = 86400; fee_percentage = 1; trading_pair = \"BTC-USD\" })'" 