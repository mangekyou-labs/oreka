export enum Phase {
    Trading,
    Bidding,
    Maturity,
    Expiry
}

export enum Side {
  Long = "LONG",
  Short = "SHORT"
}

export interface PositionPoint {
  timestamp: number;
  longPercentage: number | null;
  shortPercentage: number | null;
  isMainPoint?: boolean;
  time?: number;
}

export interface PriceData {
  price: number;
  symbol: string;
  timestamp: number;
  time?: number;
  close?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface ChartOptions {
  timeRange: string;
  showPositions: boolean;
  showPrice: boolean;
}

export interface MarketDetails {
  owner: string;
  tradingPair: string;
  biddingStartTime: number;
  maturityTime: number;
  strikePrice: number;
  resolved: boolean;
  resolveTime: number;
  expired: boolean;
}

export interface PositionData {
  timestamp: number;
  longPercentage: number;
  shortPercentage: number;
  isVisible: boolean;
  isMainPoint?: boolean;
} 