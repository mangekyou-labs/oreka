// Define constants for the strike price
import { ethers } from 'ethers';

// Use BigNumber to avoid precision issues with large numbers
export const STRIKE_PRICE_DECIMALS = 8;
export const STRIKE_PRICE_MULTIPLIER = ethers.BigNumber.from(10).pow(STRIKE_PRICE_DECIMALS);
