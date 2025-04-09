#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== ICRC-1 Token Creation Test ===${NC}"

# Check if dfx is running
echo -e "${YELLOW}Checking if dfx is running...${NC}"
dfx ping
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: dfx is not running. Please start dfx with 'dfx start' and try again.${NC}"
    exit 1
fi

# Get the factory canister ID
FACTORY_CANISTER_ID=$(dfx canister id factory)
echo -e "${GREEN}Using factory canister ID: ${FACTORY_CANISTER_ID}${NC}"

# Check if WASM module is available
echo -e "${YELLOW}Checking if ICRC-1 WASM module is available...${NC}"
MODULE_AVAILABLE=$(dfx canister call factory isWasmModuleAvailable '("icrc1_ledger")')

if [[ $MODULE_AVAILABLE == *"false"* ]]; then
    echo -e "${YELLOW}WASM module for ICRC-1 is not available. Triggering HTTP outcall to fetch it...${NC}"
    
    # Check if factory has enough cycles
    CYCLE_BALANCE=$(dfx canister status factory | grep "Balance:" | awk '{print $2}')
    if (( $CYCLE_BALANCE < 1000000000000 )); then
        echo -e "${YELLOW}Adding cycles to factory canister...${NC}"
        dfx canister deposit-cycles 5000000000000 $FACTORY_CANISTER_ID
    fi
    
    # Trigger refresh of WASM module
    echo -e "${YELLOW}Refreshing WASM module...${NC}"
    dfx canister call factory refreshWasmModule '("icrc1_ledger")'
    
    # Wait a moment for the outcall to complete
    echo -e "${YELLOW}Waiting for module refresh...${NC}"
    sleep 5
    
    # Check again
    MODULE_AVAILABLE=$(dfx canister call factory isWasmModuleAvailable '("icrc1_ledger")')
    if [[ $MODULE_AVAILABLE == *"false"* ]]; then
        echo -e "${RED}ERROR: Failed to fetch ICRC-1 WASM module. Please try again later.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}ICRC-1 WASM module is available.${NC}"

# Get timestamp for unique token name
TIMESTAMP=$(date +%s)

# Token parameters
TOKEN_NAME="Test Token $TIMESTAMP"
TOKEN_SYMBOL="TST"
DECIMALS=8
INITIAL_SUPPLY=1000000000
FEE=10000

echo -e "${YELLOW}Creating token with parameters:${NC}"
echo -e "  Name: ${TOKEN_NAME}"
echo -e "  Symbol: ${TOKEN_SYMBOL}"
echo -e "  Decimals: ${DECIMALS}"
echo -e "  Initial Supply: ${INITIAL_SUPPLY}"
echo -e "  Fee: ${FEE}"

# Deploy token using factory canister
echo -e "${YELLOW}Deploying token using factory canister...${NC}"
RESULT=$(dfx canister call factory deployToken "(\"$TOKEN_NAME\", \"$TOKEN_SYMBOL\", $DECIMALS:nat8, $INITIAL_SUPPLY:nat, $FEE:nat)")

# Check if deployment was successful
if [[ $RESULT == *"err"* ]]; then
    echo -e "${RED}ERROR: Token deployment failed:${NC}"
    echo -e "$RESULT"
    exit 1
fi

# Extract the token canister ID from the result
TOKEN_CANISTER_ID=$(echo $RESULT | sed -n 's/.*principal "\([^"]*\)".*/\1/p')

if [ -z "$TOKEN_CANISTER_ID" ]; then
    echo -e "${RED}ERROR: Failed to extract token canister ID from result:${NC}"
    echo -e "$RESULT"
    exit 1
fi

echo -e "${GREEN}Token deployed successfully!${NC}"
echo -e "${GREEN}Token Canister ID: ${TOKEN_CANISTER_ID}${NC}"
echo -e "${GREEN}You can access your token at: http://localhost:4943/?canisterId=${TOKEN_CANISTER_ID}${NC}"
echo -e "${BLUE}=== Token Creation Complete ===${NC}"

# Optionally, verify the token details
echo -e "${YELLOW}Verifying token details...${NC}"
dfx canister call $TOKEN_CANISTER_ID icrc1_name

echo -e "${YELLOW}Token symbol:${NC}"
dfx canister call $TOKEN_CANISTER_ID icrc1_symbol

echo -e "${YELLOW}Token decimals:${NC}"
dfx canister call $TOKEN_CANISTER_ID icrc1_decimals

echo -e "${YELLOW}Token fee:${NC}"
dfx canister call $TOKEN_CANISTER_ID icrc1_fee

echo -e "${YELLOW}Total supply:${NC}"
dfx canister call $TOKEN_CANISTER_ID icrc1_total_supply 