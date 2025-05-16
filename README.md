# ICP Prediction Market Layer 🎯

A decentralized binary options trading platform built on the Internet Computer Protocol (ICP), allowing users to make price direction predictions on cryptocurrency pairs.

## Overview 🌟

### Key Features
- 📈 Resolved with price feeds via HTTP Outcalls
- ⚡ 30-second trading windows
- 🎲 Entire-pool reward/loss per correct/incorrect prediction
- 🔒 Secure identity management via Internet Identity
- 💱 Support for multiple cryptocurrency pairs
- 🏭 Factory canister for deploying custom markets

## Demo 🎮

- [EVM Demo](https://youtu.be/krkaNUv0kKY)
- [EVM webiste](https://oreka.zeta.vercel.app)
- [ICP Demo](https://youtu.be/3SbgZNxx3wU)



![Diagram](./docs/images/diagram.png)

### Factory Canister Architecture

```
                      +----------------------------------+
                      |          FACTORY CANISTER        |
                      +---------------+------------------+
                                      |
           +-------------------------+-------------------------+-------------------------+
           |                         |                         |                         |
+----------v-----------+  +----------v-----------+  +----------v-----------+  +----------v-----------+
|  Market Deployment   |  | Contract Management  |  |   Events Tracking    |  |   WASM Module Mgmt   |
+----------------------+  +----------------------+  +----------------------+  +----------------------+
| • deployMarket()     |  | • getContractDetails |  | • getRecentEvents()  |  | • fetchWasmModule()  |
| • createCanister()   |  | • getMarketDetails() |  | • Log deploy events  |  | • registerWasmModule |
| • installCode()      |  | • getAllMarkets()    |  | • DeployEvent type   |  | • registerWasmChunk  |
| • configParameters   |  | • getAllContracts()  |  | • Archive events     |  | • upgradeAllMarkets  |
+----------+-----------+  +----------+-----------+  +----------------------+  +----------------------+
           |                         |
           v                         v
+----------+-----------+  +----------+-----------+
|   Binary Options     |  |     State Storage    |
|   Market Canisters   |  +----------------------+
+----------------------+  | • allContracts       |
| • Market 1           |  | • ownerContracts     |
| • Market 2           |  | • deployEvents       |
| • Market N           |  | • wasmModuleStable   |
+----------------------+  +----------------------+
```

#### Key Components

1. **Market Deployment**
   - Creates customizable prediction markets with specific parameters:
     - Custom trading pairs (e.g., "ICP-USD", "BTC-USD")
     - Strike price for the binary option
     - Maturity time (expiry timestamp)
     - Fee percentage for the market
   - Manages canister creation lifecycle including:
     - Allocating cycles for new canisters
     - Creating empty canisters
     - Installing WASM code modules
     - Setting appropriate controllers

2. **WASM Module Management**
   - Fetches and caches Binary Option Market WASM code
   - Supports HTTP outcalls to retrieve code from GitHub
   - Handles chunked uploads for large WASM files
   - Provides canister upgrade capabilities


## Technical Stack 🛠

- **Backend**: Motoko
- **Frontend**: Next.js, TypeScript, Chakra UI
- **Identity**: Internet Identity
- **Price Feeds**: HTTP Outcalls
- **State Management**: Redux Toolkit

## Getting Started 🚀

### Prerequisites
- dfx CLI
- Node.js >= 14
- NPM

### Local Development

1. Start the local replica:

```bash
cd oreka/

dfx start --clean
```

2. Deploy the Factory and Binary Option Market canister:

```bash
export MINTER=$(dfx --identity anonymous identity get-principal)
export DEFAULT=$(dfx identity get-principal)

# deploy icp_ledger_canister dependency first
dfx deploy icp_ledger_canister --argument "(variant { Init =
record {
     token_symbol = \"ICRC1\";
     token_name = \"L-ICRC1\";
     minting_account = record { owner = principal \"${MINTER}\" };
     transfer_fee = 10_000;
     metadata = vec {};
     initial_balances = vec { record { record { owner = principal \"${DEFAULT}\"; }; 10_000_000_000; }; };
     archive_options = record {
         num_blocks_to_archive = 1000;
         trigger_threshold = 2000;
         controller_id = principal \"${MINTER}\";
     };
     feature_flags = opt record {
         icrc2 = true;
     };
 }
})"

# transfer ICP to player
dfx canister call icp_ledger_canister icrc1_transfer "(record {
  to = record {
    owner = principal \"${DEFAULT}\";
  };
  amount = 1_000_000_000;
})"

# deploy factory canister
dfx deploy factory

# (Optional) Deploy a test market directly for testing
dfx deploy binary_option_market --argument '(12.0, 1743880750, "ICP-USD", 10)'

# optional: deploy test canister
dfx deploy binary_option_market_test
dfx canister call binary_option_market_test test
```

3. Install frontend dependencies:

```bash
# deploy the internet identity
dfx deps deploy

cd icp-asset
npm install --legacy-peer-deps
```

4. Start the frontend development server:

```bash
npm run dev
```

### Creating a Market

You can create a new market through the factory canister with:

```bash
dfx canister call factory deployMarket '("My Market", 12.0, 3600000000000, 10, "ICP-USD")'
```

Parameters:
- `"My Market"`: Market name
- `12.0`: Strike price (float)
- `3600000000000`: Maturity time in nanoseconds (1 hour)
- `10`: Fee percentage (10%)
- `"ICP-USD"`: Trading pair

# Important Notes for Factory Canister

## Cycles Requirements

The Factory canister requires a sufficient amount of cycles to deploy and operate binary option markets:

- **Factory Canister Operation**: The factory canister itself must maintain at least **2.2T cycles** to function properly
- **Market Deployment Cost**: Each binary option market deployment requires **4T cycles** to ensure successful creation and initialization
- **Total Cost (worst case)**: 4.4T cycles (2.2T for factory operation + 2.2T for market deployment)
- **ICP Equivalent**: Approximately 1.32 ICP (at current conversion rate of 0.3 ICP = 1T cycles)

### Important Notes:
- Always ensure the factory canister has more than the required cycles before attempting to create a new market
- If you encounter an "out of cycles" error, you need to top up the factory canister
- The exact cycle consumption may vary slightly depending on market parameters and network conditions
- For safety, consider allocating extra cycles beyond the minimum requirements

## Project Status 📊

Current Features:
- ✅ Core prediction market contracts
- ✅ HTTP Outcalls price feed integration
- ✅ Basic trading interface
- ✅ Internet Identity integration
- ✅ Factory for deploying custom markets
- ✅ Support for multiple cryptocurrency pairs

## Work-In-Progress 🚧

- **Liquidity Tree AMM Design Diagram**
```
                                  +-------------------+
                                  |   Liquidity Tree  |
                                  |   AMM for Markets |
                                  +-------------------+
                                           |
                          +----------------+---------------+
                          |                                |
              +-----------v------------+      +-----------v------------+
              |    Liquidity Pool      |      |   Prediction Markets   |
              |  (Single Token Pool)   <----->|   (Betting Conditions) |
              +-----------+------------+      +-----------+------------+
                          |                                |
      +-------------------+-------------------+            |
      |                   |                   |            |
+-----v------+     +-----v------+     +------v-----+      |
|   Leaf 1   |     |   Leaf 2   |     |   Leaf 3   |      |
| (LP Node)  |     | (LP Node)  |     | (LP Node)  |      |
+-----+------+     +-----+------+     +------+-----+      |
      |                   |                   |            |
      |                   |                   |            |
+-----v------+     +-----v------+     +------v-----+      |
| Liquidity  |     | Liquidity  |     | Liquidity  |      |
| Provider 1 |     | Provider 2 |     | Provider 3 |      |
+------------+     +------------+     +------------+      |
                                                          |
                          +-------------------------------|
                          |                               |
               +----------v-----------+      +------------v-----------+
               |  Market Resolution   |      |   Outcome Settlement   |
               | (Oracle Resolution)  |      | (Profit/Loss Handling) |
               +----------------------+      +------------------------+
```

- **LMSR AMM**: https://youtu.be/f0sqRKw5vqI

### Calling for ICP Collaboration 📢

If you're interested in contributing to this platform, please DM for further collaboration opportunities.

The Liquidity Tree AMM design enables efficient management of shared liquidity across multiple prediction markets simultaneously, eliminating the traditional need for dedicated market makers. This design allows for:

1. Optimized capital efficiency across all markets
2. Automatic fair profit/loss distribution to liquidity providers
3. Scalable infrastructure for hosting thousands of markets
4. Competitive pricing through advanced mathematical models

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments 🙏

- DFINITY Foundation
- Internet Computer Community

## Contact 📧

For questions and support, please open an issue or reach out to the maintainers.

---

Built with ❤️ for the Internet Computer ecosystem.