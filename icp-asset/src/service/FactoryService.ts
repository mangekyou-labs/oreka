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
        ? "bd3sg-teaaa-aaaaa-qaaba-cai"  // Local canister ID for development
        : "rrkah-fqaaa-aaaaa-aaaaq-cai"); // Default production canister ID

/**
 * Helper service for interacting with the Factory canister
 */
export class FactoryApiService {
    private agent: HttpAgent;
    private factoryActor: _SERVICE;
    private localCanisterId: string = process.env.NEXT_PUBLIC_FACTORY_CANISTER_ID || "bd3sg-teaaa-aaaaa-qaaba-cai";

    constructor() {
        console.log("Initializing FactoryApiService with canister ID:", this.localCanisterId);
        console.log("Using host:", process.env.NEXT_PUBLIC_IC_HOST || "http://localhost:4943");
        console.log("Environment variables:", {
            NODE_ENV: process.env.NODE_ENV,
            NEXT_PUBLIC_FACTORY_CANISTER_ID: process.env.NEXT_PUBLIC_FACTORY_CANISTER_ID
        });

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
     * Deploy a new market canister with enhanced error handling
     */
    async deployMarket(
        marketName: string,
        strikePrice: number,
        maturityTime: number,
        feePercentage: number,
        tradingPair: string = "ICP-USD"
    ): Promise<ApiResult<Principal>> {
        // Validate input parameters before making the call
        if (!marketName || marketName.trim() === "") {
            return { ok: null, err: "Market name cannot be empty" };
        }

        if (typeof strikePrice !== 'number' || isNaN(strikePrice) || strikePrice <= 0) {
            return { ok: null, err: "Strike price must be a positive number" };
        }

        if (typeof maturityTime !== 'number' || maturityTime <= 0) {
            return { ok: null, err: "Maturity time must be a positive number of seconds in the future" };
        }

        if (typeof feePercentage !== 'number' || feePercentage < 0 || feePercentage > 100) {
            return { ok: null, err: "Fee percentage must be between 0 and 100" };
        }

        if (!tradingPair || tradingPair.trim() === "") {
            return { ok: null, err: "Trading pair cannot be empty" };
        }

        try {
            console.log("Deploying market with parameters:", {
                marketName: `${marketName} (${typeof marketName})`,
                strikePrice: `${strikePrice} (${typeof strikePrice})`,
                maturityTime: `${maturityTime} (${typeof maturityTime})`,
                feePercentage: `${feePercentage} (${typeof feePercentage})`,
                tradingPair: `${tradingPair} (${typeof tradingPair})`
            });

            try {
                // Make the canister call with the correct parameter types
                const result = await this.factoryActor.deployMarket(
                    marketName,              // Text
                    strikePrice,             // Float64
                    maturityTime,            // Int
                    feePercentage,           // Nat
                    tradingPair              // Text
                );

                console.log("Market deployment call result:", result);

                if ('ok' in result && result.ok) {
                    const canisterId = result.ok.toString();
                    console.log(`Market deployed successfully with canister ID: ${canisterId}`);
                    return { ok: result.ok, err: null };
                } else if ('err' in result) {
                    console.error(`Error from canister: ${result.err}`);

                    // Enhance the error messages with more helpful information
                    const errMsg = typeof result.err === 'string' ? result.err.toLowerCase() : '';

                    if (errMsg.includes("cycles") || errMsg.includes("out of cycles")) {
                        return {
                            ok: null,
                            err: `Insufficient cycles: The factory canister (${this.localCanisterId}) is out of cycles. Please contact the administrator to top up cycles before trying again.`
                        };
                    } else if (errMsg.includes("maturity") || errMsg.includes("time")) {
                        return {
                            ok: null,
                            err: `Invalid time value: ${result.err}. Please check the maturity time parameter.`
                        };
                    } else {
                        return { ok: null, err: result.err };
                    }
                } else {
                    console.error("Unexpected result format from canister call");
                    return { ok: null, err: "Unexpected result format from canister" };
                }
            } catch (error) {
                console.error("Deploy market call failed:", error);

                // Handle different types of errors
                const errorMsg = error instanceof Error ? error.message : String(error);

                if (errorMsg.includes("type") || errorMsg.includes("argument")) {
                    return {
                        ok: null,
                        err: `Type error: ${errorMsg}. Please make sure all parameters have the correct type.`
                    };
                } else if (errorMsg.includes("rejected")) {
                    if (errorMsg.includes("out of cycles") || errorMsg.includes("cycles")) {
                        return {
                            ok: null,
                            err: `Insufficient cycles: The factory canister (${this.localCanisterId}) needs more cycles to create a new market. Please contact the administrator.`
                        };
                    }
                    return {
                        ok: null,
                        err: `Call rejected: ${errorMsg}. The canister may be busy or unavailable.`
                    };
                } else {
                    return { ok: null, err: `Error: ${errorMsg}` };
                }
            }
        } catch (error) {
            console.error("Top-level error during market deployment:", error);
            return {
                ok: null,
                err: `Exception during market deployment: ${error instanceof Error ? error.message : String(error)}`
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
            // The getContractDetails function doesn't exist in the canister
            // Instead, get all contracts and filter for the one with matching ID
            const allContracts = await this.factoryActor.getAllContracts();
            const contract = allContracts.find(
                contract => contract.canisterId.toString() === contractId.toString()
            );

            if (contract) {
                console.log("Contract details retrieved successfully");
                return {
                    ok: contract,
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