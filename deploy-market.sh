#!/bin/bash

# Check if we have enough arguments
if [ "$#" -lt 4 ]; then
  echo "Usage: $0 <canister_id> <strike_price> <maturity_timestamp> <fee_percentage> [trading_pair]"
  echo ""
  echo "Example: $0 be2us-64aaa-aaaaa-qaabq-cai 12.0 1734503362 10 ICP-USD"
  exit 1
fi

CANISTER_ID=$1
STRIKE_PRICE=$2
MATURITY_TIMESTAMP=$3
FEE_PERCENTAGE=$4
TRADING_PAIR=${5:-"ICP-USD"}  # Default to ICP-USD if not provided

echo "Deploying binary option market to canister $CANISTER_ID..."
echo "Parameters:"
echo "  Strike Price: $STRIKE_PRICE"
echo "  Maturity Timestamp: $MATURITY_TIMESTAMP"
echo "  Fee Percentage: $FEE_PERCENTAGE"
echo "  Trading Pair: $TRADING_PAIR"

# Deploy the binary option market code to the canister
# Build the wasm first if needed
WASM_PATH=".dfx/local/canisters/binary_option_market/binary_option_market.wasm"

# Format args for Candid (correct types)
# Format: (Float, Nat64, Text, Nat)
ARG_STRING="($STRIKE_PRICE : float64, $MATURITY_TIMESTAMP : nat64, \"$TRADING_PAIR\", $FEE_PERCENTAGE : nat)"

echo "Using argument string: $ARG_STRING"

# Install the wasm to the canister
dfx canister install $CANISTER_ID --wasm $WASM_PATH --mode reinstall --argument "$ARG_STRING" --yes

if [ $? -eq 0 ]; then
  echo "✅ Successfully deployed binary option market code to canister $CANISTER_ID"
  echo "Market is now ready for trading!"
else
  echo "❌ Failed to deploy binary option market code"
  exit 1
fi 