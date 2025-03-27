import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory } from "../declarations/factory/factory.did.js";
import { _SERVICE, Contract, ContractType, DeployEvent } from "../declarations/factory/factory";

// Type for API Results
type ApiResult<T> = {
    ok: T | null;
    err: string | null;
}

// Default canister ID - should be configured based on environment
const FACTORY_CANISTER_ID = process.env.NEXT_PUBLIC_FACTORY_CANISTER_ID ||
    (process.env.NODE_ENV !== "production"
        ? "be2us-64aaa-aaaaa-qaabq-cai"  // Local canister ID for development
        : "rrkah-fqaaa-aaaaa-aaaaq-cai"); // Default production canister ID

/**
 * Helper service for interacting with the Factory canister
 */
export class FactoryApiService {
    private agent: HttpAgent;
    private factoryActor: _SERVICE;
    private localCanisterId: string = process.env.NEXT_PUBLIC_FACTORY_CANISTER_ID || "be2us-64aaa-aaaaa-qaabq-cai";

    constructor() {
        console.log("Initializing FactoryApiService with canister ID:", this.localCanisterId);
        console.log("Using host:", process.env.NEXT_PUBLIC_IC_HOST || "http://localhost:4943");

        this.agent = new HttpAgent({
            host: process.env.NEXT_PUBLIC_IC_HOST || "http://localhost:4943",
        });

        // Only fetch the root key in development
        if (process.env.NODE_ENV !== 'production') {
            this.agent.fetchRootKey().catch(err => {
                console.warn('Unable to fetch root key. Check to ensure local replica is running');
                console.error(err);
            });
        }

        this.factoryActor = Actor.createActor<_SERVICE>(idlFactory, {
            agent: this.agent,
            canisterId: this.localCanisterId
        });
        console.log("FactoryApiService initialized successfully");
    }

    /**
     * Deploy a new market canister
     * @param marketName The name of the market
     * @param strikePrice The strike price in e8s
     * @param maturityTime The maturity time in nanoseconds
     * @param feePercentage The fee percentage in basis points (e.g. 100 = 1%)
     * @param tradingPair The trading pair (e.g. "ICP-USD")
     * @returns Promise with the canister ID or error
     */
    async deployMarket(
        marketName: string,
        strikePrice: bigint,
        maturityTime: bigint,
        feePercentage: bigint,
        tradingPair: string = "ICP-USD"
    ): Promise<ApiResult<Principal>> {
        console.log(`Deploying market with name: ${marketName}, strike price: ${strikePrice}, maturity time: ${maturityTime}, fee percentage: ${feePercentage}, trading pair: ${tradingPair}`);
        try {
            // Convert strikePrice to float for the canister
            const strikeFloat = Number(strikePrice) / 100000000;
            console.log(`Converted strike price to float: ${strikeFloat}`);

            // Add extra logging for debugging
            console.log(`Calling deployMarket with parameters:`, {
                marketName,
                strikeFloat,
                maturityTime: maturityTime.toString(),
                feePercentage: feePercentage.toString(),
                tradingPair
            });

            // Use try-catch to handle any unexpected issues
            try {
                // Based on the actual canister did file:
                // deployMarket: (text, float64, int, nat, text) -> (Result);
                // We need to convert our parameters accordingly

                // The Motoko code expects maturityTime to be a RELATIVE time offset
                // in nanoseconds from the current time, not an absolute timestamp!

                // Calculate future timestamp in nanoseconds (relative to now)
                const nowMs = Date.now();
                const maturityMs = Number(maturityTime) * 1000; // Convert seconds to ms
                const offsetMs = maturityMs - nowMs;

                if (offsetMs <= 0) {
                    throw new Error("Maturity time must be in the future");
                }

                // Convert to nanoseconds offset
                const maturityOffset = offsetMs * 1000000; // ms to ns

                const feePercentageNumber = Number(feePercentage);

                console.log("Converted parameters to Candid types:", {
                    marketName: typeof marketName,                // text
                    strikeFloat: typeof strikeFloat,              // float64
                    maturityOffset: `${maturityOffset} ns (relative to now)`, // int
                    feePercentageNumber: typeof feePercentageNumber, // nat
                    tradingPair: typeof tradingPair                // text
                });

                // TypeScript definitions now match the Candid interface
                const result = await this.factoryActor.deployMarket(
                    marketName,             // text
                    strikeFloat,            // float64
                    maturityOffset,         // int (ns from now)
                    feePercentageNumber,    // nat
                    tradingPair             // text
                );

                // Add detailed logging to help debug
                console.log("Deploy market result (raw):", JSON.stringify(result));
                console.log("Result type:", typeof result);
                console.log("Has ok property:", 'ok' in result);
                if ('ok' in result) {
                    console.log("Result.ok type:", typeof result.ok);
                    console.log("Result.ok value:", result.ok);
                    console.log("Result.ok instanceof Principal:", result.ok instanceof Principal);
                    if (result.ok) {
                        try {
                            console.log("Result.ok can be converted to string:", result.ok.toString());
                        } catch (e) {
                            console.error("Error converting result.ok to string:", e);
                        }
                    }
                }

                if ('ok' in result) {
                    // Check explicitly if result.ok is not null and is a Principal
                    if (result.ok && typeof result.ok === 'object') {
                        try {
                            const principalStr = result.ok.toString();
                            console.log('Market deployed successfully, canister ID:', principalStr);
                            return {
                                ok: result.ok,
                                err: null
                            };
                        } catch (e) {
                            console.error('Error converting principal to string:', e);
                            return {
                                ok: null,
                                err: "Invalid Principal returned from factory"
                            };
                        }
                    } else {
                        console.error('Received invalid result.ok (null or not a Principal):', result);
                        return {
                            ok: null,
                            err: "Received invalid canister ID from factory"
                        };
                    }
                } else {
                    console.error('Error deploying market:', result.err);
                    return {
                        ok: null,
                        err: result.err
                    };
                }
            } catch (callError) {
                console.error("Error during deployMarket call:", callError);
                return {
                    ok: null,
                    err: `Error calling deployMarket: ${callError instanceof Error ? callError.message : String(callError)}`
                };
            }
        } catch (error) {
            console.error('Exception while deploying market:', error);
            return {
                ok: null,
                err: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * List all registered markets
     * @returns A Result containing an array of market information or an error message
     */
    async listMarkets(): Promise<{ ok: Array<{ name: string, market_type: string, canister_id: string }>, err?: never } | { ok?: never, err: string }> {
        try {
            console.log("Listing markets from canister...");

            // Get all contracts
            const result = await this.getAllContracts();
            if (!result.ok) {
                console.error("Failed to get contracts:", result.err);
                return { err: result.err || "Failed to retrieve contracts" };
            }

            const contracts = result.ok;
            console.log("Retrieved contracts:", contracts);

            // Filter for BinaryOptionMarket contracts
            const binaryMarkets = contracts.filter(contract =>
                'BinaryOptionMarket' in contract.contractType
            );
            console.log("Filtered binary markets:", binaryMarkets);

            const formattedMarkets = binaryMarkets.map(contract => {
                return {
                    name: contract.name || "Unnamed Market",
                    market_type: 'BinaryOptionMarket',
                    canister_id: contract.canisterId.toString()
                };
            });

            console.log("Formatted markets:", formattedMarkets);
            return { ok: formattedMarkets };
        } catch (error) {
            console.error("Error listing markets:", error);
            return { err: `Failed to list markets: ${error}` };
        }
    }

    /**
     * Get all contracts registered with the factory
     */
    async getAllContracts(): Promise<ApiResult<Contract[]>> {
        try {
            console.log("Fetching all contracts");
            const contracts = await this.factoryActor.getAllContracts();
            console.log("Contracts found:", contracts.length);
            return {
                ok: contracts,
                err: null
            };
        } catch (error) {
            console.error("Error fetching contracts:", error);
            return {
                ok: null,
                err: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Get contracts by owner
     * @param owner The owner's principal ID
     */
    async getContractsByOwner(owner: Principal): Promise<ApiResult<Principal[]>> {
        try {
            console.log("Fetching contracts for owner:", owner.toString());
            const contracts = await this.factoryActor.getContractsByOwner(owner);
            console.log("Contracts found for owner:", contracts.length);
            return {
                ok: contracts,
                err: null
            };
        } catch (error) {
            console.error("Error fetching contracts by owner:", error);
            return {
                ok: null,
                err: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Get details of a specific contract
     * @param contractId The canister ID of the contract
     */
    async getContractDetails(contractId: Principal): Promise<ApiResult<Contract>> {
        try {
            console.log("Fetching contract details for:", contractId.toString());
            const result = await this.factoryActor.getContractDetails(contractId);

            if (result.length > 0 && result[0]) {
                console.log("Contract details retrieved successfully");
                return {
                    ok: result[0],
                    err: null
                };
            } else {
                console.error("Contract not found");
                return {
                    ok: null,
                    err: "Contract not found"
                };
            }
        } catch (error) {
            console.error("Error fetching contract details:", error);
            return {
                ok: null,
                err: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Get recent deployment events
     */
    async getRecentEvents(): Promise<ApiResult<DeployEvent[]>> {
        try {
            console.log("Fetching recent deployment events");
            const events = await this.factoryActor.getRecentEvents();
            console.log("Events found:", events.length);
            return {
                ok: events,
                err: null
            };
        } catch (error) {
            console.error("Error fetching recent events:", error);
            return {
                ok: null,
                err: error instanceof Error ? error.message : String(error)
            };
        }
    }
} 