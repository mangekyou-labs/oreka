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

# If WASM module is not available, trigger HTTP outcall to fetch it
if [[ "$WASM_AVAILABLE" == "(false)" ]]; then
  echo "WASM module not available. Triggering HTTP outcall to fetch it from DFINITY..."
  
  # Call refreshWasmModule to trigger HTTP outcall
  RESULT=$(dfx canister call factory refreshWasmModule)
  echo "Refresh result: $RESULT"
  
  # Wait a moment for the fetch to complete
  echo "Waiting for WASM module to be fetched..."
  sleep 3
  
  # Check again if WASM module is available
  echo "Checking if WASM module is available after refresh..."
  WASM_AVAILABLE=$(dfx canister call factory isWasmModuleAvailable)
  echo "WASM module available: $WASM_AVAILABLE"
  
  if [[ "$WASM_AVAILABLE" == "(false)" ]]; then
    echo "Error: Failed to fetch WASM module after refresh"
    echo "Let's try again with more cycles..."
    
    # Add more cycles to the factory canister
    echo "Adding more cycles to the factory canister..."
    dfx canister deposit-cycles 1000000000000 $FACTORY_ID
    
    # Try refresh again
    RESULT=$(dfx canister call factory refreshWasmModule)
    echo "Refresh result after adding cycles: $RESULT"
    
    # Wait a moment for the fetch to complete
    echo "Waiting for WASM module to be fetched..."
    sleep 3
    
    # Check one more time
    WASM_AVAILABLE=$(dfx canister call factory isWasmModuleAvailable)
    echo "WASM module available: $WASM_AVAILABLE"
    
    if [[ "$WASM_AVAILABLE" == "(false)" ]]; then
      echo "Error: Failed to fetch WASM module after multiple attempts"
      exit 1
    fi
  fi
fi

# Token parameters
TOKEN_NAME="Test Token $(date +%s)"
TOKEN_SYMBOL="TST"
DECIMALS=8
INITIAL_SUPPLY=1000000000 # 10 tokens with 8 decimals
FEE=10000 # 0.0001 token fee

echo "Creating token with the following parameters:"
echo "Name: $TOKEN_NAME"
echo "Symbol: $TOKEN_SYMBOL"
echo "Decimals: $DECIMALS"
echo "Initial Supply: $INITIAL_SUPPLY"
echo "Fee: $FEE"
echo ""

# Deploy the token using the factory canister
echo "Deploying token using factory canister..."
RESULT=$(dfx canister call factory deployToken "(\"$TOKEN_NAME\", \"$TOKEN_SYMBOL\", $DECIMALS:nat8, $INITIAL_SUPPLY, $FEE)" 2>&1)

# Check for errors
if [[ $RESULT == *"error"* ]] || [[ $RESULT == *"err"* ]]; then
  echo "Error deploying token:"
  echo "$RESULT"
  exit 1
fi

# Extract the canister ID
TOKEN_ID=$(echo "$RESULT" | grep -o "principal \"[^\"]*\"" | cut -d '"' -f 2)

if [ -z "$TOKEN_ID" ]; then
  echo "Failed to extract token canister ID from output:"
  echo "$RESULT"
  exit 1
fi

echo "Successfully deployed ICRC-1 token with canister ID: $TOKEN_ID"
echo ""
echo "You can access the token at: http://127.0.0.1:4943/?canisterId=br5f7-7uaaa-aaaaa-qaaca-cai&id=$TOKEN_ID"
echo ""
echo "To verify the token details, run:"
echo "dfx canister call factory getContractDetails '(principal \"$TOKEN_ID\")'" 