# Market Deployer Canister

This Rust canister provides a production-ready solution for deploying Binary Option Market canisters without relying on the `dfx` command-line tool.

## Features

- Fully on-chain deployment of Binary Option Markets
- Direct use of the IC Management Canister API
- Pre-compiled WASM embedded in the canister
- Proper error handling and validation
- Cycle management for new canisters
- Tracking of deployed markets

## How It Works

1. The market deployer canister includes the pre-compiled binary option market WASM code
2. When `deploy_market` is called, it:
   - Validates market parameters
   - Creates a new canister with cycles
   - Installs the WASM code with proper initialization arguments
   - Sets the controllers to include both the caller and the market deployer
   - Keeps track of all deployed markets

## Deployment

To deploy the market deployer canister:

```bash
./deploy-market-deployer.sh
```

This script will:
1. Build the binary option market WASM
2. Copy it to the market deployer canister directory
3. Deploy the market deployer canister
4. Add cycles to the canister
5. Update environment variables with the canister ID

## Usage

### From the Command Line

Deploy a new market:

```bash
dfx canister call market_deployer deploy_market '(
  record { 
    name = "BTC-USD Market"; 
    strike_price = 60000.0; 
    maturity_time = 86400; 
    fee_percentage = 1; 
    trading_pair = "BTC-USD" 
  }
)'
```

Get markets by owner:

```bash
dfx canister call market_deployer get_markets_by_owner '(principal "your-principal-id")'
```

Get all markets:

```bash
dfx canister call market_deployer get_all_markets
```

### From Frontend Code

```typescript
import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory } from "./declarations/market_deployer/market_deployer.did.js";

// Create agent and actor
const agent = new HttpAgent();
const marketDeployerActor = Actor.createActor(idlFactory, {
  agent,
  canisterId: process.env.NEXT_PUBLIC_MARKET_DEPLOYER_ID,
});

// Deploy a new market
async function deployMarket() {
  try {
    const result = await marketDeployerActor.deploy_market({
      name: "BTC-USD Market",
      strike_price: 60000.0,
      maturity_time: 86400,
      fee_percentage: 1,
      trading_pair: "BTC-USD"
    });
    
    if ('ok' in result) {
      console.log("Market deployed with canister ID:", result.ok.toText());
      return result.ok;
    } else {
      console.error("Error deploying market:", result.err);
      throw new Error(`Failed to deploy market: ${JSON.stringify(result.err)}`);
    }
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

// Get markets by owner
async function getMarketsByOwner(ownerPrincipal) {
  return await marketDeployerActor.get_markets_by_owner(ownerPrincipal);
}

// Get all markets
async function getAllMarkets() {
  return await marketDeployerActor.get_all_markets();
}
```

## Advantages Over Previous Approaches

1. **No dfx dependency**: Can be used in production environments
2. **Single deployment step**: Creates canister and installs code in one process
3. **Error handling**: Proper error handling and reporting
4. **State tracking**: Tracks all deployed markets by owner
5. **Cycle management**: Handles cycles required for deployment
6. **Controller setup**: Automatically sets up controllers 