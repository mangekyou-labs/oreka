// Thêm mapping mặc định cho các địa chỉ contract và trading pairs
const DEFAULT_PAIRS: { [key: string]: { pair: string, symbol: string } } = {
    "0x5FbDB2315678afecb367f032d93F642f64180aa3": { pair: "BTC/USD", symbol: "BTCUSDT" },
    "0x6FbDB2315678afecb367f032d93F642f64180aa3": { pair: "ETH/USD", symbol: "ETHUSDT" },
    "0x7FbDB2315678afecb367f032d93F642f64180aa3": { pair: "ICP/USD", symbol: "ICPUSDT" }
};

export const CONTRACT_TRADING_PAIRS: { [key: string]: string } = {};

export const setContractTradingPair = (contractAddress: string, tradingPair: string) => {
    CONTRACT_TRADING_PAIRS[contractAddress] = tradingPair;

    localStorage.setItem('contractTradingPairs', JSON.stringify(CONTRACT_TRADING_PAIRS));
};

interface TradingPairInfo {
    pair: string;
    symbol: string;
}

// Cập nhật defaultPairs với địa chỉ lowercase
const defaultPairs: { [key: string]: TradingPairInfo } = {
    "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512": { pair: "BTC/USD", symbol: "BTCUSDT" },
    "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9": { pair: "ICP/USD", symbol: "ICPUSDT" },
    "0x5fcb8...5707": { pair: "ETH/USD", symbol: "ETHUSDT" }
};

export const getContractTradingPair = (contractAddress: string): string => {
    // Chuyển địa chỉ về lowercase để so sánh
    const normalizedAddress = contractAddress.toLowerCase();
    console.log('Getting trading pair for address:', normalizedAddress); // Debug

    // Đọc từ localStorage trước
    const savedInfo = localStorage.getItem(`tradingPair_${normalizedAddress}`);
    if (savedInfo) {
        const info: TradingPairInfo = JSON.parse(savedInfo);
        console.log('Found in localStorage:', info); // Debug
        return info.pair;
    }

    // Kiểm tra trong defaultPairs
    if (defaultPairs[normalizedAddress]) {
        console.log('Found in defaultPairs:', defaultPairs[normalizedAddress]); // Debug
        return defaultPairs[normalizedAddress].pair;
    }

    console.log('No trading pair found for address:', normalizedAddress); // Debug
    return 'Unknown';
};

export const getChartSymbol = (contractAddress: string): string => {
    // Đọc từ localStorage trước
    const savedInfo = localStorage.getItem(`tradingPair_${contractAddress}`);
    if (savedInfo) {
        const info: TradingPairInfo = JSON.parse(savedInfo);
        return info.symbol;
    }

    const symbol = defaultPairs[contractAddress]?.symbol;
    console.log('Getting chart symbol for:', contractAddress, 'Symbol:', symbol); // Debug
    return symbol || 'BTCUSDT';
};

import { ethers } from 'ethers';

// Mapeo de direcciones de Price Feed (lowercase) a pares de trading
export const CHAINLINK_PRICE_FEEDS_MAP: { [key: string]: string } = {
  "0x1b44f3514812d835eb1bdb0acb33d3fa3351ee43": "BTC/USD",
  "0x694aa176935721d5e4fac081bf1f309adc325306": "ETH/USD",
  "0xc59e3633baac79493d98e63626716e204a45edf": "LINK/USD", 
  "0xc0f82a46033b8bdba4bb0b0e28bc2006f64355bc": "SNX/USD",
  "0xaaabb530434b0eeaac9a42e25dbc6a22d7be218e": "WSTETH/USD",

};

// Helper para obtener el par de trading desde la dirección del feed
export const getTradingPairFromPriceFeed = (priceFeedAddress: string): string => {
  if (!priceFeedAddress || typeof priceFeedAddress !== 'string') {
    return "Unknown";
  }
  const normalizedAddress = priceFeedAddress.toLowerCase();
  return CHAINLINK_PRICE_FEEDS_MAP[normalizedAddress] || "Unknown";
}; 