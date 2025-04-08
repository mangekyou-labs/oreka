/**
 * Market phase enumerations
 */
export enum Phase {
    Trading,
    Bidding,
    Maturity,
    Expiry
}

/**
 * API result type for service calls
 */
export type ApiResult<T> = {
    ok: boolean;
    data?: T;
    err: string | null;
}; 