import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory } from "../declarations/market_deployer/market_deployer.did.js";

// Types to match the canister's interface
export type DeployedMarket = {
    canister_id: Principal;
    owner: Principal;
    name: string;
    created_at: bigint;
};

export type DeploymentError =
    | { InvalidParams: string }
    | { CanisterCreationFailed: string }
    | { ControllerUpdateFailed: string }
    | { CodeInstallationFailed: string }
    | { InsufficientCycles: null }
    | { Unknown: string };

export type DeploymentResult =
    | { ok: Principal }
    | { err: DeploymentError };

export type MarketParams = {
    name: string;
    strike_price: number;
    maturity_time: bigint;
    fee_percentage: bigint;
    trading_pair: string;
};

class MarketDeployerService {
    private actor: any;
    private canisterId: string;

    constructor() {
        this.canisterId = process.env.NEXT_PUBLIC_MARKET_DEPLOYER_ID ||
            (process.env.NODE_ENV !== "production"
                ? "bw4dl-smaaa-aaaaa-qaacq-cai"  // Replace with local canister ID for development
                : "rrkah-fqaaa-aaaaa-aaaaq-cai"); // Replace with production canister ID
    }

    private async getActor() {
        if (!this.actor) {
            const agent = new HttpAgent();

            // Only fetch the root key in development
            if (process.env.NODE_ENV !== "production") {
                await agent.fetchRootKey();
            }

            this.actor = Actor.createActor(idlFactory, {
                agent,
                canisterId: this.canisterId
            });
        }

        return this.actor;
    }

    /**
     * Deploy a new binary option market
     */
    async deployMarket(params: MarketParams): Promise<DeploymentResult> {
        try {
            const actor = await this.getActor();
            return await actor.deploy_market(params);
        } catch (error) {
            console.error("Error deploying market:", error);
            return { err: { Unknown: `${error}` } };
        }
    }

    /**
     * Get all markets deployed by a specific owner
     */
    async getMarketsByOwner(owner: Principal): Promise<DeployedMarket[]> {
        try {
            const actor = await this.getActor();
            return await actor.get_markets_by_owner(owner);
        } catch (error) {
            console.error("Error fetching markets by owner:", error);
            return [];
        }
    }

    /**
     * Get all deployed markets
     */
    async getAllMarkets(): Promise<DeployedMarket[]> {
        try {
            const actor = await this.getActor();
            return await actor.get_all_markets();
        } catch (error) {
            console.error("Error fetching all markets:", error);
            return [];
        }
    }

    /**
     * Check the cycles balance of the market deployer canister
     */
    async getCyclesBalance(): Promise<bigint> {
        try {
            const actor = await this.getActor();
            return await actor.cycles_balance();
        } catch (error) {
            console.error("Error fetching cycles balance:", error);
            return BigInt(0);
        }
    }

    /**
     * Format error messages for UI display
     */
    formatError(error: DeploymentError): string {
        if ("InvalidParams" in error) {
            return `Invalid parameters: ${error.InvalidParams}`;
        } else if ("CanisterCreationFailed" in error) {
            return `Failed to create canister: ${error.CanisterCreationFailed}`;
        } else if ("ControllerUpdateFailed" in error) {
            return `Failed to set controllers: ${error.ControllerUpdateFailed}`;
        } else if ("CodeInstallationFailed" in error) {
            return `Failed to install code: ${error.CodeInstallationFailed}`;
        } else if ("InsufficientCycles" in error) {
            return "Insufficient cycles to create a new canister";
        } else {
            return `Unknown error: ${error.Unknown}`;
        }
    }
}

export default new MarketDeployerService(); 