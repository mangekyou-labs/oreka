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

// Track the current identity
let currentIdentity: Identity | null = null;

export const binaryOptionMarketActor = createBinaryOptionMarketActor(
  binaryOptionMarketCanisterId, {
  agentOptions: {
    host: process.env.NEXT_PUBLIC_IC_HOST
  }
});

export function setActorIdentity(identity: Identity) {
  currentIdentity = identity;
  (Actor.agentOf(binaryOptionMarketActor) as HttpAgent).replaceIdentity(identity);
}

export const icpLedgerCanister = createIcpLedgerActor(
  icpLedgerCanisterId, {
  agentOptions: {
    host: process.env.NEXT_PUBLIC_IC_HOST
  }
})

export function setIcpLedgerIdentity(identity: Identity) {
  (Actor.agentOf(icpLedgerCanister) as HttpAgent).replaceIdentity(identity);
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

  const agent = new HttpAgent({
    host: process.env.NEXT_PUBLIC_IC_HOST || "http://localhost:4943",
    identity: currentIdentity
  });

  // Only fetch the root key in development
  if (process.env.NODE_ENV !== 'production') {
    await agent.fetchRootKey().catch(err => {
      console.warn('Unable to fetch root key. Check to ensure local replica is running');
      console.error(err);
    });
  }

  return Actor.createActor(idlFactory, {
    agent,
    canisterId,
  });
}
