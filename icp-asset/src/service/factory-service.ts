import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory } from "../declarations/factory/factory.did.js";

export interface MarketInfo {
    id: string;
    name: string;
    createdAt: bigint;
}

export interface IFactoryService {
    initialize(): Promise<void>;
    getMarkets(): Promise<MarketInfo[]>;
    deployMarket(name: string, strikePrice: number, expiry: bigint): Promise<string>;
}

export class FactoryService implements IFactoryService {
    private static instance: FactoryService;
    private actor: any;
    private initialized = false;

    private constructor() { }

    public static getInstance(): FactoryService {
        if (!FactoryService.instance) {
            FactoryService.instance = new FactoryService();
        }
        return FactoryService.instance;
    }

    public async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            const factoryCanisterId = process.env.NEXT_PUBLIC_FACTORY_CANISTER_ID;
            if (!factoryCanisterId) {
                throw new Error("Factory canister ID not found in environment variables");
            }

            const host = process.env.NEXT_PUBLIC_IC_HOST || "https://ic0.app";
            const agent = new HttpAgent({ host });

            // Only fetch the root key in development
            if (process.env.NODE_ENV !== "production") {
                await agent.fetchRootKey();
            }

            this.actor = Actor.createActor(idlFactory, {
                agent,
                canisterId: factoryCanisterId,
            });

            this.initialized = true;
            console.log("Factory service initialized successfully");
        } catch (error) {
            console.error("Failed to initialize factory service:", error);
            throw error;
        }
    }

    public async getMarkets(): Promise<MarketInfo[]> {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // Get all contracts from the factory and filter for binary option markets
            const contracts = await this.actor.getAllContracts();

            // Filter for BinaryOptionMarket contracts only and transform to MarketInfo format
            return contracts
                .filter((contract: any) => 'BinaryOptionMarket' in contract.contractType)
                .map((market: any) => ({
                    id: Principal.from(market.canisterId).toText(),
                    name: market.name,
                    createdAt: market.createdAt
                }));
        } catch (error) {
            console.error("Failed to get markets:", error);
            throw error;
        }
    }

    public async deployMarket(name: string, strikePrice: number, expiry: bigint): Promise<string> {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const result = await this.actor.deployMarket(name, strikePrice, expiry);

            if ('ok' in result) {
                return Principal.from(result.ok).toText();
            } else {
                throw new Error(`Failed to deploy market: ${result.err}`);
            }
        } catch (error) {
            console.error("Failed to deploy market:", error);
            throw error;
        }
    }
} 