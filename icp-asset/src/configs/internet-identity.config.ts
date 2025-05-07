/**
 * Configuration for Internet Identity integration
 * This file centralizes all settings related to II authentication
 */

export const II_CONFIG = {
    // Canister ID for Internet Identity
    CANISTER_ID: 'rdmx6-jaaaa-aaaaa-aaadq-cai',

    // URLs for different environments
    URLS: {
        // Production URL for II
        PRODUCTION: process.env.NEXT_PUBLIC_II_URL || 'https://identity.ic0.app',

        // Local development URL (uses localhost with canister ID)
        DEVELOPMENT: `http://${process.env.NEXT_PUBLIC_INTERNET_IDENTITY_CANISTER_ID || 'rdmx6-jaaaa-aaaaa-aaadq-cai'}.localhost:4943`,
    },

    // Special settings for handling II delegations in production
    PRODUCTION_SETTINGS: {
        // Always fetch root key for II canister even in production
        FETCH_ROOT_KEY: true,

        // Host to use for agent when interacting with II in production
        HOST: 'https://ic0.app',

        // Default max time to live for delegations (30 days in nanoseconds)
        MAX_DELEGATION_TIME: BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000),
    },

    // Auth client configuration
    AUTH_CLIENT_OPTIONS: {
        idleOptions: {
            // Longer timeout for production (30 minutes)
            idleTimeout: 1000 * 60 * 30,
            // Disable idle timeout in production
            disableIdle: process.env.NODE_ENV === 'production',
        }
    },
};

/**
 * Get the appropriate Internet Identity URL for the current environment
 * @returns The II URL to use
 */
export function getInternetIdentityUrl(): string {
    return process.env.NODE_ENV === 'production'
        ? II_CONFIG.URLS.PRODUCTION
        : II_CONFIG.URLS.DEVELOPMENT;
}

/**
 * Check if a canister ID is the Internet Identity canister
 * @param canisterId The canister ID to check
 * @returns True if the canister is Internet Identity
 */
export function isInternetIdentityCanister(canisterId: string): boolean {
    return canisterId === II_CONFIG.CANISTER_ID;
} 