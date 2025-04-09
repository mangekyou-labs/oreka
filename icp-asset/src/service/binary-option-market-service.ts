import { Actor } from "@dfinity/agent";
import { binaryOptionMarketActor } from "./actor-locator";
import { Principal } from "@dfinity/principal";

// Interface defining the service contract
export interface IBinaryOptionMarketService {
    bid(side: { Long: null } | { Short: null }, amount: number | bigint | null): Promise<{ ok: string } | { err: string }>;
    claimReward(): Promise<void>;
    getCurrentPhase(): Promise<{ Bidding: null } | { Trading: null } | { Maturity: null } | { Expiry: null }>;
    getMarketDetails(): Promise<{
        resolved: boolean;
        oracleDetails: { finalPrice: number; strikePrice: number };
        positions: { long: bigint; short: bigint };
    }>;
    getUserPosition(principal: Principal | null): Promise<{ long: bigint; short: bigint } | null>;
    hasUserClaimed(principal: Principal | null): Promise<boolean | null>;
    getContractBalance(): Promise<bigint>;
    getTotalDeposit(): Promise<bigint>;
    getBidders(): Promise<{
        long: Array<[Principal, bigint]>;
        short: Array<[Principal, bigint]>;
    }>;
    getIcpUsdExchange(): Promise<string>;
    startTrading(): Promise<void>;
    resolveMarket(): Promise<void>;
    expireMarket(): Promise<void>;
}

// Base abstract class for market services
abstract class BaseMarketService {
    protected actor: any = null;

    abstract initialize(canisterId?: string): Promise<void>;
    protected assertInitialized(): void {
        if (!this.actor) {
            throw new Error("Service not initialized");
        }
    }
}
// Concrete implementation
export class BinaryOptionMarketService extends BaseMarketService implements IBinaryOptionMarketService {
    private static instance: BinaryOptionMarketService;

    private constructor() {
        super();
    }


    // Singleton pattern
    public static getInstance(): BinaryOptionMarketService {
        if (!BinaryOptionMarketService.instance) {
            BinaryOptionMarketService.instance = new BinaryOptionMarketService();
        }
        return BinaryOptionMarketService.instance;
    }

    public async initialize(canisterId?: string): Promise<void> {
        // Reset actor if a different canister ID is provided
        if (canisterId && this.actor) {
            console.log("Reinitializing with new canister ID:", canisterId);
            this.actor = null;
        }

        if (!this.actor) {
            if (canisterId) {
                // Import dynamically to avoid circular dependencies
                const { Actor, HttpAgent } = await import("@dfinity/agent");
                const { idlFactory } = await import("../declarations/binary_option_market/binary_option_market.did.js");

                // Get the properly authenticated actor
                try {
                    // Import the getActor function to get an authenticated actor
                    const { getActor } = await import("./actor-locator");
                    this.actor = await getActor(idlFactory, canisterId);
                    console.log(`Initialized binary option market actor with custom canister ID: ${canisterId} and authenticated identity`);
                } catch (error) {
                    console.error("Failed to get authenticated actor, falling back to default agent:", error);

                    // Fallback to creating a new agent if getting the authenticated actor fails
                    const agent = new HttpAgent({
                        host: process.env.NEXT_PUBLIC_IC_HOST || "http://localhost:4943",
                    });

                    // Only fetch the root key in development
                    if (process.env.NODE_ENV !== 'production') {
                        await agent.fetchRootKey().catch(err => {
                            console.warn('Unable to fetch root key. Check to ensure local replica is running');
                            console.error(err);
                        });
                    }

                    this.actor = Actor.createActor(idlFactory, {
                        agent,
                        canisterId,
                    });
                    console.log(`Initialized binary option market actor with custom canister ID: ${canisterId} (unauthenticated)`);
                }
            } else {
                // Use the default actor
                this.actor = binaryOptionMarketActor;
                console.log("Initialized binary option market actor with default canister ID");
            }
        }
    }

    public async bid(side: { Long: null } | { Short: null }, amount: number | bigint | null): Promise<{ ok: string } | { err: string }> {
        this.assertInitialized();
        const bidAmount = amount !== null ? (typeof amount === 'number' ? BigInt(amount) : amount) : null;

        return await this.actor?.bid(side, bidAmount);
    }

    public async claimReward(): Promise<void> {
        this.assertInitialized();
        return await this.actor.claimReward();
    }

    public async getCurrentPhase() {
        this.assertInitialized();
        return await this.actor.getCurrentPhase();
    }

    public async getEndTimestamp() {
        this.assertInitialized();
        return await this.actor.getEndTimestamp();
    }

    public async getMarketDetails() {
        this.assertInitialized();
        return await this.actor.getMarketDetails();
    }

    public async getUserPosition(principal: Principal | null): Promise<{ long: bigint; short: bigint } | null> {
        this.assertInitialized();
        if (this.actor) {
            return await this.actor.getUserPosition(principal);
        }
        throw new Error("Actor is not initialized");
    }

    public async hasUserClaimed(principal: Principal | null): Promise<boolean | null> {
        this.assertInitialized();
        if (this.actor) {
            return await this.actor.hasUserClaimed(principal);
        }
        throw new Error("Actor is not initialized");
    }

    public async getContractBalance() {
        this.assertInitialized();
        return await this.actor.getContractBalance();
    }

    public async getTotalDeposit() {
        this.assertInitialized();
        return await this.actor.getTotalDeposit();
    }

    public async getBidders() {
        this.assertInitialized();
        return await this.actor.getBidders();
    }

    public async getIcpUsdExchange() {
        this.assertInitialized();
        return await this.actor.get_icp_usd_exchange();
    }

    // Owner functions

    /**
     * Starts the trading phase (owner only)
     */
    public async startTrading(): Promise<void> {
        this.assertInitialized();
        return await this.actor.startTrading();
    }

    /**
     * Resolves the market using price feed data (anyone can call)
     */
    public async resolveMarket(): Promise<void> {
        this.assertInitialized();
        return await this.actor.resolveMarket();
    }

    /**
     * Expires the market (owner only)
     */
    public async expireMarket(): Promise<void> {
        this.assertInitialized();
        return await this.actor.expireMarket();
    }
}
