#!/bin/bash
set -e

# Check if arguments are provided
if [ "$#" -lt 3 ]; then
    echo "Usage: $0 MARKET_NAME STRIKE_PRICE MATURITY_TIME [FEE_PERCENTAGE]"
    echo "Example: $0 \"BTC_25K_June\" 25000 1734503362 1.0"
    exit 1
fi

MARKET_NAME=$1
STRIKE_PRICE=$2
MATURITY_TIME=$3
FEE_PERCENTAGE=${4:-1.0}  # Default to 1.0% if not provided

echo "Creating new binary option market..."
echo "Market Name: $MARKET_NAME"
echo "Strike Price: $STRIKE_PRICE"
echo "Maturity Time: $MATURITY_TIME" 
echo "Fee Percentage: $FEE_PERCENTAGE%"

# Generate a unique canister name
TIMESTAMP=$(date +%s)
CANISTER_NAME="market_${TIMESTAMP}"

echo "Step 1: Creating canister..."
dfx canister create $CANISTER_NAME
CANISTER_ID=$(dfx canister id $CANISTER_NAME)
echo "Created canister with ID: $CANISTER_ID"

echo "Step 2: Deploying binary option market code..."
dfx deploy binary_option_market --argument "(${STRIKE_PRICE}, ${MATURITY_TIME})" --canister-id=$CANISTER_ID
echo "Binary option market code deployed successfully!"

echo "Step 3: Registering market with factory..."
# Convert fee percentage to basis points (multiply by 10)
FEE_BASIS_POINTS=$(echo "$FEE_PERCENTAGE * 10" | bc | cut -d. -f1)
dfx canister call factory registerMarket "($MARKET_NAME, principal \"$CANISTER_ID\", $FEE_BASIS_POINTS)"
echo "Market registered with factory successfully!"

echo "Market creation complete!"
echo "Canister ID: $CANISTER_ID"
echo "You can now interact with this market through the frontend." 