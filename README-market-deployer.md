# Binary Option Market Deployer Solution

This is a production-ready solution for deploying Binary Option Market canisters on the Internet Computer without relying on the `dfx` command-line tool.

## Architecture

The solution consists of three main components:

1. **Rust-based Market Deployer Canister**: A canister that embeds the Binary Option Market WASM and can deploy new markets directly through the IC management canister.

2. **Frontend TypeScript Service**: A service that interacts with the Market Deployer canister from your web application.

3. **Backend API**: A Node.js API that provides a RESTful interface for deploying markets from server environments.

## Benefits

- **No dfx dependency in production**: Deploy markets without needing `dfx` installed on production servers.
- **Fully on-chain deployment**: The deployment process is handled entirely on the IC.
- **Pre-compiled WASM**: The Binary Option Market WASM is embedded in the deployer canister.
- **Proper error handling**: Comprehensive error handling and reporting across all components.
- **State tracking**: The deployer canister tracks all deployed markets.
- **Cycle management**: Built-in cycle management for new canisters.
- **RESTful API**: Backend API for server-side deployments.

## Components

### 1. Market Deployer Canister (Rust)

Located in `canisters/market_deployer/`, this Rust canister:

- Stores the pre-compiled Binary Option Market WASM
- Creates new canisters
- Installs the WASM code with initialization arguments
- Manages cycles
- Tracks all deployed markets

### 2. Frontend Service (TypeScript)

Located in `icp-asset/src/service/MarketDeployerService.ts`, this service:

- Provides an interface to the Market Deployer canister
- Handles error formatting
- Includes TypeScript types for all canister interfaces

### 3. Backend API (Node.js)

Located in `api/`, this Express-based API:

- Exposes a RESTful endpoint for deploying markets
- Can be used in any server environment
- Doesn't require `dfx` to be installed
- Includes proper error handling and logging

## Getting Started

### 1. Deploy the Market Deployer Canister

```bash
# Make the script executable
chmod +x deploy-market-deployer.sh

# Deploy the canister
./deploy-market-deployer.sh
```

The script will:
- Build the Binary Option Market WASM
- Copy it to the Market Deployer canister directory
- Deploy the Market Deployer canister
- Add cycles to the canister
- Update environment variables

### 2. Use the Frontend Service

```typescript
import MarketDeployerService, { MarketParams } from '../service/MarketDeployerService';

// Deploy a new market
const deployNewMarket = async () => {
  const params: MarketParams = {
    name: "BTC-USD Market",
    strike_price: 60000.0,
    maturity_time: BigInt(86400), // 24 hours in seconds
    fee_percentage: BigInt(1),
    trading_pair: "BTC-USD"
  };
  
  const result = await MarketDeployerService.deployMarket(params);
  
  if ('ok' in result) {
    console.log("Market deployed with ID:", result.ok.toText());
  } else {
    console.error("Deployment failed:", MarketDeployerService.formatError(result.err));
  }
};

// Get markets by owner
const getMyMarkets = async (principal) => {
  const markets = await MarketDeployerService.getMarketsByOwner(principal);
  console.log("My markets:", markets);
};
```

### 3. Set Up the Backend API

```bash
# Navigate to the API directory
cd api

# Install dependencies
npm install

# Set environment variables
echo "MARKET_DEPLOYER_ID=your-canister-id" > .env

# Start the API server
npm run dev
```

### 4. Use the API to Deploy Markets

```bash
# Example using curl
curl -X POST http://localhost:3001/api/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BTC-USD Market",
    "strikePrice": 60000.0,
    "maturityTime": 86400,
    "feePercentage": 1,
    "tradingPair": "BTC-USD"
  }'
```

## Production Deployment

### Deploying the Market Deployer Canister

For production deployment:

1. Build your project for production:
   ```bash
   DFX_NETWORK=ic ./deploy-market-deployer.sh
   ```

2. The canister will be deployed to the IC mainnet.

### Deploying the Backend API

For production deployment of the API:

1. Set the necessary environment variables:
   ```
   NODE_ENV=production
   DFX_NETWORK=ic
   MARKET_DEPLOYER_ID=your-production-canister-id
   ```

2. Deploy using your preferred hosting solution (e.g., AWS, GCP, Azure).

## Conclusion

This solution provides a production-ready way to deploy Binary Option Markets on the Internet Computer without relying on the `dfx` command-line tool. The Rust-based Market Deployer canister, combined with the TypeScript frontend service and Node.js backend API, gives you multiple ways to deploy markets based on your needs. 