#!/bin/bash
set -e

# Check if dfx is running
if ! dfx ping; then
  echo "Error: dfx is not running. Please start the local replica with 'dfx start' in another terminal."
  exit 1
fi

# Get factory canister ID
FACTORY_ID=$(dfx canister id factory)
echo "Using factory canister ID: $FACTORY_ID"

# Check if WASM module is available
echo "Checking if WASM module is available..."
WASM_AVAILABLE=$(dfx canister call factory isWasmModuleAvailable)
echo "WASM module available: $WASM_AVAILABLE"

# If WASM module is not available, register it manually in chunks
if [[ "$WASM_AVAILABLE" == "(false)" ]]; then
  echo "WASM module not available. Trying to register it manually in chunks..."
  
  # Find the WASM file
  WASM_FILE=".dfx/local/canisters/binary_option_market/binary_option_market.wasm"
  if [ ! -f "$WASM_FILE" ]; then
    echo "Error: Cannot find binary_option_market.wasm file at $WASM_FILE"
    exit 1
  fi
  
  echo "Found WASM file at $WASM_FILE"
  
  # Get file size
  WASM_SIZE=$(stat -f%z "$WASM_FILE")
  echo "WASM file size: $WASM_SIZE bytes"
  
  # Define chunk size (100KB)
  CHUNK_SIZE=100000
  
  # Calculate number of chunks
  CHUNKS=$(( ($WASM_SIZE + $CHUNK_SIZE - 1) / $CHUNK_SIZE ))
  echo "Splitting WASM file into $CHUNKS chunks of ~$CHUNK_SIZE bytes each"
  
  # Create a temporary directory for chunks
  TMP_DIR=$(mktemp -d)
  echo "Using temporary directory: $TMP_DIR"
  
  # Split the file into chunks
  split -b $CHUNK_SIZE "$WASM_FILE" "$TMP_DIR/chunk_"
  
  # Get total number of chunks
  TOTAL_CHUNKS=$(ls "$TMP_DIR/chunk_"* | wc -l | tr -d ' ')
  echo "Created $TOTAL_CHUNKS chunks"
  
  # Register each chunk
  CHUNK_INDEX=0
  for CHUNK_FILE in "$TMP_DIR/chunk_"*; do
    echo "Registering chunk $CHUNK_INDEX of $TOTAL_CHUNKS ($CHUNK_FILE)..."
    
    # Convert chunk to vec format (limited to 10KB per call for safety)
    CHUNK_HEX=$(xxd -p "$CHUNK_FILE" | tr -d '\n')
    
    # Create Candid arguments for registerWasmChunk
    CANDID_ARGS="(vec {$(echo $CHUNK_HEX | sed 's/\(..\)/0x\1;/g')}, $CHUNK_INDEX, $TOTAL_CHUNKS)"
    
    # Call factory to register chunk
    dfx canister call factory registerWasmChunk "$CANDID_ARGS"
    
    CHUNK_INDEX=$((CHUNK_INDEX + 1))
  done
  
  # Clean up
  rm -rf "$TMP_DIR"
  
  # Check again if WASM module is available
  echo "Checking if WASM module is available after registration..."
  WASM_AVAILABLE=$(dfx canister call factory isWasmModuleAvailable)
  echo "WASM module available: $WASM_AVAILABLE"
  
  if [[ "$WASM_AVAILABLE" == "(false)" ]]; then
    echo "Error: Failed to register WASM module"
    exit 1
  fi
fi

# Market parameters
MARKET_NAME="Test Market $(date +%s)"
STRIKE_PRICE=35000.00
MATURITY_TIME=3600  # 1 hour from now
FEE_PERCENTAGE=2
TRADING_PAIR="ICP-USD"

echo "Creating market with the following parameters:"
echo "Name: $MARKET_NAME"
echo "Strike Price: $STRIKE_PRICE"
echo "Maturity Time: $MATURITY_TIME seconds"
echo "Fee Percentage: $FEE_PERCENTAGE%"
echo "Trading Pair: $TRADING_PAIR"
echo ""

# Deploy the market using the factory canister
echo "Deploying market using factory canister..."
RESULT=$(dfx canister call factory deployMarket "(\"$MARKET_NAME\", $STRIKE_PRICE, $MATURITY_TIME, $FEE_PERCENTAGE, \"$TRADING_PAIR\")" 2>&1)

# Check for errors
if [[ $RESULT == *"error"* ]] || [[ $RESULT == *"err"* ]]; then
  echo "Error deploying market:"
  echo "$RESULT"
  exit 1
fi

# Extract the canister ID
MARKET_ID=$(echo "$RESULT" | grep -o "principal \"[^\"]*\"" | cut -d '"' -f 2)

if [ -z "$MARKET_ID" ]; then
  echo "Failed to extract market canister ID from output:"
  echo "$RESULT"
  exit 1
fi

echo "Successfully deployed market with canister ID: $MARKET_ID"
echo ""
echo "You can access the new market at: http://127.0.0.1:4943/?canisterId=br5f7-7uaaa-aaaaa-qaaca-cai&id=$MARKET_ID"
echo ""
echo "To verify the market details, run:"
echo "dfx canister call factory getContractDetails '(principal \"$MARKET_ID\")'" 