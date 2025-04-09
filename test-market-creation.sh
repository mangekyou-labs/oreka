#!/bin/bash
set -e

# Check if dfx is running
if ! dfx ping; then
  echo "Error: dfx is not running. Please start the local replica with 'dfx start' in another terminal."
  exit 1
fi

# Market parameters
MARKET_NAME="Test Market $(date +%s)"
MARKET_DESCRIPTION="This is a test binary option market created by the factory"
UNDERLYING="BTC/USD"
# Set expiry to 30 days from now
EXPIRY=$(( $(date +%s) + 30*24*60*60 ))
MARKET_TYPE="CALL_PUT"
STRIKE_PRICE=50000.0
FEE_PERCENTAGE=10

echo "Creating market with the following parameters:"
echo "Name: $MARKET_NAME"
echo "Description: $MARKET_DESCRIPTION"
echo "Underlying: $UNDERLYING"
echo "Expiry: $EXPIRY"
echo "Market Type: $MARKET_TYPE"
echo "Strike Price: $STRIKE_PRICE"
echo "Fee Percentage: $FEE_PERCENTAGE%"
echo ""

# Generate a temporary Motoko file to deploy a new canister
TEMP_DIR=$(mktemp -d)
TEMP_CANISTER="market_$(date +%s | head -c 8)"
echo "Creating temporary canister $TEMP_CANISTER in directory $TEMP_DIR"

# Create dfx.json for the temporary canister
cat > $TEMP_DIR/dfx.json << EOF
{
  "canisters": {
    "$TEMP_CANISTER": {
      "type": "motoko",
      "main": "main.mo"
    }
  },
  "defaults": {
    "build": {
      "packtool": ""
    }
  },
  "networks": {
    "local": {
      "bind": "127.0.0.1:4943"
    }
  },
  "version": 1
}
EOF

# Create a simple actor file
cat > $TEMP_DIR/main.mo << EOF
actor {
  public query func greet() : async Text {
    return "Hello from binary option market";
  }
}
EOF

# Create canister
cd $TEMP_DIR
dfx canister create $TEMP_CANISTER
CANISTER_ID=$(dfx canister id $TEMP_CANISTER)
echo "Created new canister with ID: $CANISTER_ID"

# Install the binary option market WASM
cd /Users/zeref/workdir/oreka
WASM_PATH=".dfx/local/canisters/binary_option_market/binary_option_market.wasm"
echo "Installing binary option market WASM from $WASM_PATH"

# Format args properly for Candid
ARG_STRING="($STRIKE_PRICE : float64, $EXPIRY : nat64, \"$UNDERLYING\", $FEE_PERCENTAGE : nat)"
echo "Using initialization arguments: $ARG_STRING"

dfx canister install $CANISTER_ID --wasm $WASM_PATH --mode install --argument "$ARG_STRING"
echo "Binary option market WASM installed successfully!"

# Register the market with the factory
echo "Registering market with factory..."
FACTORY_ID=$(dfx canister id factory)
echo "Using factory canister ID: $FACTORY_ID"

echo "Registering market with ID $CANISTER_ID in factory $FACTORY_ID"
dfx canister call factory addExternalContract "(\"$MARKET_NAME\", principal \"$CANISTER_ID\", variant { BinaryOptionMarket })"

echo "Successfully created and registered binary option market with canister ID: $CANISTER_ID"
echo ""
echo "You can access the market at: http://127.0.0.1:4943/?canisterId=br5f7-7uaaa-aaaaa-qaaca-cai&id=$CANISTER_ID"
echo ""
echo "To verify the market details, run:"
echo "dfx canister call factory getContractDetails '(principal \"$CANISTER_ID\")'"

# Clean up temporary directory
rm -rf $TEMP_DIR 