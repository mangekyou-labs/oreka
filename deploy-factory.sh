#!/bin/bash
set -e

echo "Deploying Binary Option Market canister..."
dfx build binary_option_market

echo "Deploying Factory canister..."
dfx build factory
dfx deploy factory

FACTORY_ID=$(dfx canister id factory)
echo "Factory canister deployed with ID: $FACTORY_ID"

# Make sure the factory fetches the WASM module
echo "Refreshing WASM module from GitHub via HTTP outcall..."
dfx canister call factory refreshWasmModule

# Wait a moment for the fetch to complete
echo "Waiting for WASM module to be fetched..."
sleep 3

# Verify the WASM module is available
echo "Checking if WASM module is available..."
WASM_AVAILABLE=$(dfx canister call factory isWasmModuleAvailable)
echo "WASM module available: $WASM_AVAILABLE"

# Update .env.local with the factory canister ID
echo "Updating .env.local with factory canister ID..."
if [ -f icp-asset/.env.local ]; then
  # Update existing file
  sed -i '' "s/^NEXT_PUBLIC_FACTORY_CANISTER_ID=.*/NEXT_PUBLIC_FACTORY_CANISTER_ID=$FACTORY_ID/" icp-asset/.env.local
else
  # Create new file
  echo "NEXT_PUBLIC_FACTORY_CANISTER_ID=$FACTORY_ID" > icp-asset/.env.local
fi

# Update FactoryService.ts with the new canister ID
echo "Updating FactoryService.ts with factory canister ID..."
FACTORY_SERVICE_FILE="icp-asset/src/service/FactoryService.ts"
if [ -f "$FACTORY_SERVICE_FILE" ]; then
  # Replace the default canister ID in the FACTORY_CANISTER_ID variable
  sed -i '' "s/\"bd3sg-teaaa-aaaaa-qaaba-cai\"/\"$FACTORY_ID\"/" "$FACTORY_SERVICE_FILE"
  echo "Updated FactoryService.ts with new canister ID: $FACTORY_ID"
else
  echo "FactoryService.ts not found, skipping update"
fi

echo "Deployment completed successfully!"
echo ""
echo "Instructions for creating a new market:"
echo "1. Start the frontend with: cd icp-asset && npm run dev"
echo "2. Navigate to the factory tab"
echo "3. Fill in market details (name, strike price, maturity time, fee percentage, trading pair)"
echo "4. Click Create Market"
echo "5. The factory will automatically fetch the WASM module and deploy a new binary option market canister"
echo ""
echo "To start the frontend, run: cd icp-asset && npm run dev" 