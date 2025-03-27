#!/bin/bash
set -e

echo "Deploying Factory Canister..."

# Deploy the factory canister
dfx deploy factory

# Get the canister ID
FACTORY_CANISTER_ID=$(dfx canister id factory)
echo "Factory Canister deployed with ID: $FACTORY_CANISTER_ID"

# Update the environment variable in .env.local
echo "NEXT_PUBLIC_FACTORY_CANISTER_ID=$FACTORY_CANISTER_ID" > icp-asset/.env.local
echo "Updated icp-asset/.env.local with factory canister ID"

# Update the FactoryService.ts file with the correct canister ID
sed -i '' "s/asrmz-lmaaa-aaaaa-qaaeq-cai/$FACTORY_CANISTER_ID/g" icp-asset/src/service/FactoryService.ts
echo "Updated FactoryService.ts with factory canister ID"

echo "-----------------------------------------------------------------------------"
echo "Factory canister deployed and frontend updated."
echo "To create a new market: "
echo "1. Navigate to the factory tab in the frontend"
echo "2. Fill in the market details and click 'Create Market'"
echo "3. Copy the returned canister ID"
echo "4. Deploy the binary option market code to that canister with:"
echo "   dfx deploy binary_option_market --argument '(STRIKE_PRICE, MATURITY_TIME)' --canister-id=CANISTER_ID"
echo "-----------------------------------------------------------------------------"

# Start the frontend
echo "Starting the frontend..."
cd icp-asset && npm run dev 