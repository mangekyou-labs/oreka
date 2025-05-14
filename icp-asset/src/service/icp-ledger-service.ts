import { Actor } from "@dfinity/agent";
import { icpLedgerCanister } from "./actor-locator";
import { Principal } from "@dfinity/principal";

// Define ICRC-1 Account type
export type Account = {
    owner: Principal;
    subaccount?: Uint8Array | [];
};

// Define ICRC-2 Approve Args type
export type ApproveArgs = {
    spender: Account;
    amount: bigint;
    fee?: bigint;
    memo?: Uint8Array;
    from_subaccount?: Uint8Array;
    created_at_time?: bigint;
    expected_allowance?: bigint;
    expires_at?: bigint;
};

// Interface defining the service contract
export interface IIcpLedgerService {
    transfer(to: Account, amount: bigint): Promise<any>;
    getBalance(account: Account): Promise<bigint>;
    getSymbol(): Promise<string>;
    getName(): Promise<string>;
    getDecimals(): Promise<number>;
    getFee(): Promise<bigint>;
    approve(args: ApproveArgs): Promise<any>;
}

// Base abstract class for ledger services
abstract class BaseLedgerService {
    protected actor: any = null;

    abstract initialize(): Promise<void>;
    protected assertInitialized(): void {
        if (!this.actor) {
            throw new Error("Service not initialized");
        }
    }
}

// Concrete implementation
export class IcpLedgerService extends BaseLedgerService implements IIcpLedgerService {
    private static instance: IcpLedgerService;

    private constructor() {
        super();
    }

    // Singleton pattern
    public static getInstance(): IcpLedgerService {
        if (!IcpLedgerService.instance) {
            IcpLedgerService.instance = new IcpLedgerService();
        }
        return IcpLedgerService.instance;
    }

    public async initialize(): Promise<void> {
        if (!this.actor) {
            console.log("Initializing ICP ledger service...");
            this.actor = icpLedgerCanister;
            console.log("ICP ledger service initialized with actor:", this.actor);
        }
    }

    public async transfer(to: Account, amount: bigint) {
        this.assertInitialized();
        return await this.actor.icrc1_transfer({
            to: to,
            amount: amount,
            fee: [],
            memo: [],
            from_subaccount: [],
            created_at_time: []
        });
    }

    public async getBalance(account: Account): Promise<bigint> {
        this.assertInitialized();
        return await this.actor.icrc1_balance_of(account);
    }

    public async getSymbol(): Promise<string> {
        this.assertInitialized();
        return await this.actor.icrc1_symbol();
    }

    public async getName(): Promise<string> {
        this.assertInitialized();
        return await this.actor.icrc1_name();
    }

    public async getDecimals(): Promise<number> {
        this.assertInitialized();
        return await this.actor.icrc1_decimals();
    }

    public async getFee(): Promise<bigint> {
        this.assertInitialized();
        return await this.actor.icrc1_fee();
    }

    public async approve(args: ApproveArgs) {
        this.assertInitialized();
        console.log("DEBUG: Approving spend for market. Spender:", JSON.stringify({
            owner: args.spender.owner.toString(),
            subaccount: args.spender.subaccount ? "present" : "not present"
        }));
        console.log("DEBUG: Amount:", args.amount.toString());
        console.log("DEBUG: Using actor:", this.actor ? "Actor exists" : "Actor is null");

        try {
            const result = await this.actor.icrc2_approve({
                spender: args.spender,
                amount: args.amount,
                fee: args.fee ? [args.fee] : [],
                memo: args.memo ? [args.memo] : [],
                from_subaccount: args.from_subaccount ? [args.from_subaccount] : [],
                created_at_time: args.created_at_time ? [args.created_at_time] : [],
                expected_allowance: args.expected_allowance ? [args.expected_allowance] : [],
                expires_at: args.expires_at ? [args.expires_at] : [],
            });
            // Handle result logging safely for BigInt values
            console.log("DEBUG: Approval result:", typeof result === 'object' ?
                JSON.stringify(result, (_, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                ) : result);
            return result;
        } catch (error) {
            console.error("DEBUG: Error in approve method:", error);
            throw error;
        }
    }

    // Add a debug method to test ICP ledger connection
    public async debug_testConnection() {
        try {
            console.log("DEBUG: Testing ICP ledger service connection");
            this.assertInitialized();

            // Try to get name as simple test
            console.log("DEBUG: Getting token name...");
            const name = await this.actor.icrc1_name();
            console.log("DEBUG: Token name:", name);

            // Try to get symbol
            console.log("DEBUG: Getting token symbol...");
            const symbol = await this.actor.icrc1_symbol();
            console.log("DEBUG: Token symbol:", symbol);

            return {
                success: true,
                name,
                symbol
            };
        } catch (error) {
            console.error("DEBUG: ICP ledger connection test failed:", error);
            return {
                success: false,
                error: String(error)
            };
        }
    }
} 