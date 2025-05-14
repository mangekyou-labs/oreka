import {
  createActor as createBinaryOptionMarketActor,
  canisterId as binaryOptionMarketCanisterId,
} from "../declarations/binary_option_market"

import {
  createActor as createIcpLedgerActor,
  canisterId as icpLedgerCanisterId,
} from "../declarations/icp_ledger_canister"

import { AuthClient } from "@dfinity/auth-client";
import { Actor, HttpAgent, Identity } from "@dfinity/agent";
import { II_CONFIG, isInternetIdentityCanister } from "../configs/internet-identity.config";
import { Principal } from "@dfinity/principal";

// Track the current identity
let currentIdentity: Identity | null = null;

// Force production ICP ledger canister ID
const PRODUCTION_ICP_LEDGER_ID = "ryjl3-tyaaa-aaaaa-aaaba-cai";

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';
const host = isProduction ? "https://ic0.app" : (process.env.NEXT_PUBLIC_IC_HOST || "http://localhost:4943");

// Add DEBUG prefix to make logs easily identifiable
console.log("DEBUG: Environment:", process.env.NODE_ENV);
console.log("DEBUG: Using host:", host);
console.log("DEBUG: Hardcoded ICP ledger canister ID:", PRODUCTION_ICP_LEDGER_ID);
console.log("DEBUG: Imported ICP ledger canister ID:", icpLedgerCanisterId);

export const binaryOptionMarketActor = createBinaryOptionMarketActor(
  binaryOptionMarketCanisterId, {
  agentOptions: {
    host: host
  }
});

console.log("DEBUG: Binary Market Canister ID:", binaryOptionMarketCanisterId);

export function setActorIdentity(identity: Identity) {
  currentIdentity = identity;
  (Actor.agentOf(binaryOptionMarketActor) as HttpAgent).replaceIdentity(identity);
}

export const icpLedgerCanister = (() => {
  console.log("DEBUG: Creating ICP ledger actor");

  try {
    // Always use production ID regardless of environment
    const actor = createIcpLedgerActor(PRODUCTION_ICP_LEDGER_ID, {
      agentOptions: {
        host: host
      }
    });

    console.log("DEBUG: Successfully created ICP ledger actor with ID:", PRODUCTION_ICP_LEDGER_ID);

    // Log the actor type and properties to verify it's created correctly
    console.log("DEBUG: Actor type:", typeof actor);
    console.log("DEBUG: Actor methods:", Object.keys(actor));

    return actor;
  } catch (error) {
    console.error("DEBUG: Error creating ICP ledger actor:", error);
    throw error;
  }
})();

console.log("ICP ledger canister initialized with ID:", PRODUCTION_ICP_LEDGER_ID);

export function setIcpLedgerIdentity(identity: Identity) {
  console.log("DEBUG: Setting ICP ledger identity");
  try {
    const agent = Actor.agentOf(icpLedgerCanister) as HttpAgent;
    console.log("DEBUG: Current agent host:", (agent as any).host || "host not accessible");
    agent.replaceIdentity(identity);
    console.log("DEBUG: Identity successfully set");
  } catch (error) {
    console.error("DEBUG: Error setting identity:", error);
  }
}

// Add a function to verify canister connectivity
export async function verifyIcpLedgerConnectivity() {
  try {
    console.log("DEBUG: Testing ICP ledger connectivity...");
    // Try calling a simple query method
    const name = await icpLedgerCanister.icrc1_name();
    console.log("DEBUG: Successfully connected to ICP ledger. Name:", name);
    return true;
  } catch (error) {
    console.error("DEBUG: Failed to connect to ICP ledger:", error);
    return false;
  }
}

/**
 * Creates an actor with the current identity for the given canister ID
 * @param idlFactory The IDL factory for the actor
 * @param canisterId The canister ID to create the actor for
 * @returns A properly authenticated actor
 */
export async function getActor(idlFactory: any, canisterId: string) {
  if (!currentIdentity) {
    const authClient = await AuthClient.create();
    const identity = authClient.getIdentity();
    currentIdentity = identity;
  }

  // Configure host properly for the environment
  const host = process.env.NEXT_PUBLIC_IC_HOST || "http://localhost:4943";
  console.log(`Creating actor for canister ${canisterId} with host ${host}`);

  const agent = new HttpAgent({
    host,
    identity: currentIdentity
  });

  // Determine if we need to fetch the root key
  const isProduction = process.env.NODE_ENV === 'production';
  const isII = isInternetIdentityCanister(canisterId);

  // Always fetch root key in development OR when using Internet Identity in any environment
  // This is critical for certificate validation
  if (!isProduction || isII) {
    console.log(`Fetching root key for canister ${canisterId} (dev mode: ${!isProduction}, II: ${isII})`);
    try {
      await agent.fetchRootKey();
    } catch (err) {
      console.error('Error fetching root key:', err);
      // Don't throw here - some environments might still work without the root key
    }
  }

  // Special case for Internet Identity in production - ensure proper verification
  if (isProduction && isII) {
    console.log('Setting up special handling for Internet Identity in production');
    // The agent will use the mainnet root key which is hard-coded into @dfinity/agent
    // but we'll manually override the host to use the proper II host
    (agent as any)._host = II_CONFIG.PRODUCTION_SETTINGS.HOST;
  }

  return Actor.createActor(idlFactory, {
    agent,
    canisterId,
  });
}

// Add a global diagnostic function that can be called from browser console
export async function diagnoseIcpLedgerConnectivity() {
  console.log("=== ICP LEDGER DIAGNOSTIC TOOL ===");
  console.log("Environment:", process.env.NODE_ENV);
  console.log("Host:", host);
  console.log("Production ICP ledger ID:", PRODUCTION_ICP_LEDGER_ID);
  console.log("Imported ICP ledger ID:", icpLedgerCanisterId);

  // Create a safe stringify function to handle BigInt
  const safeStringify = (obj: any) => {
    return JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  };

  try {
    console.log("Testing connectivity to production ledger...");
    const name = await icpLedgerCanister.icrc1_name();
    console.log("✅ Successfully connected to production ledger");
    console.log("Token name:", name);

    // Get fee
    try {
      const fee = await icpLedgerCanister.icrc1_fee();
      // Safely handle BigInt
      console.log("Token fee:", typeof fee === 'bigint' ? fee.toString() : fee);
    } catch (e) {
      console.error("❌ Failed to get fee:", e);
    }

    // Try to get balance
    try {
      const mintingAccount = await icpLedgerCanister.icrc1_minting_account();
      console.log("Minting account:", mintingAccount ? safeStringify(mintingAccount) : 'null');
    } catch (e) {
      console.error("❌ Failed to get minting account:", e);
    }

  } catch (error) {
    console.error("❌ Failed to connect to production ledger:", error);
  }

  console.log("=== END OF DIAGNOSTIC ===");

  return {
    env: process.env.NODE_ENV,
    host,
    productionLedgerId: PRODUCTION_ICP_LEDGER_ID,
    importedLedgerId: icpLedgerCanisterId
  };
}

// Add an explicit check for the bidding process
export async function debugBidProcess() {
  console.log("=== DEBUGGING BID PROCESS ===");
  console.log("ICP Ledger canister ID being used:", PRODUCTION_ICP_LEDGER_ID);

  try {
    // Create a fake simple bid to test the communication flow
    const testPrincipal = Principal.fromText("aaaaa-aa");
    const testAccount = {
      owner: testPrincipal,
      subaccount: null as null | Uint8Array
    };

    // Don't actually send the transaction, just log the IDs
    console.log("DEBUG: When bidding, will use:");
    console.log("- ICP Ledger ID:", PRODUCTION_ICP_LEDGER_ID);
    console.log("- Binary option market ID:", binaryOptionMarketCanisterId);

    // Fetch agent details
    const icpAgent = Actor.agentOf(icpLedgerCanister) as HttpAgent;
    const marketAgent = Actor.agentOf(binaryOptionMarketActor) as HttpAgent;

    console.log("ICP Ledger agent:", {
      canisterId: (icpAgent as any)._canisterId?.toString() || "unknown",
      host: (icpAgent as any).host || "host not accessible"
    });

    console.log("Market agent:", {
      canisterId: (marketAgent as any)._canisterId?.toString() || "unknown",
      host: (marketAgent as any).host || "host not accessible"
    });

    // Log information about actors
    console.log("ICP Ledger actor methods:", Object.keys(icpLedgerCanister).filter(k => typeof (icpLedgerCanister as any)[k] === 'function'));
    console.log("Market actor methods:", Object.keys(binaryOptionMarketActor).filter(k => typeof (binaryOptionMarketActor as any)[k] === 'function'));

    console.log("=== END OF BID PROCESS DEBUG ===");
    return true;
  } catch (error) {
    console.error("Error in bid debug process:", error);
    return false;
  }
}

// Attach to window for easy browser console access
if (typeof window !== 'undefined') {
  (window as any).diagnoseIcpLedger = diagnoseIcpLedgerConnectivity;
  (window as any).debugBidProcess = debugBidProcess;
  (window as any).ICP_LEDGER_ID = PRODUCTION_ICP_LEDGER_ID;
  console.log("DEBUG: ICP diagnostic tools available. Run 'diagnoseIcpLedger()' or 'debugBidProcess()' in browser console");
}
