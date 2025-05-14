// Map từ Chainlink price feed addresses sang trading pairs
export const CHAINLINK_PRICE_FEEDS_MAP = {
  "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43": "BTC/USD",
  "0x694AA176935721D5E4FAC081bf1f309aDC325306": "ETH/USD",
  "0xc59E3633BAAC79493d98e63626716e204A45EdF": "LINK/USD",
  "0xc0F82A46033b8BdBA4Bb0B0e28Bc2006F64355bC": "SNX/USD",
  "0xaaabb530434B0EeAAc9A42E25dbC6A22D7bE218E": "WSTETH/USD",
};

// Hàm chuyển đổi từ price feed address sang trading pair
export const getTradingPairFromPriceFeed = (priceFeedAddress: string): string => {
  return CHAINLINK_PRICE_FEEDS_MAP[priceFeedAddress] || "Unknown";
};

// Hàm chuyển đổi từ trading pair sang chart symbol format
export const getChartSymbolFromTradingPair = (tradingPair: string): string => {
  if (!tradingPair) return '';
  return tradingPair.replace('/', '-');
};

// Hàm chuyển đổi strikePrice từ blockchain format (integer) sang display format (float)
export const formatStrikePriceFromContract = (strikePriceInteger: string, multiplier: number = 100000000): string => {
  if (!strikePriceInteger) return "0";
  const price = parseInt(strikePriceInteger);
  return (price / multiplier).toFixed(2);
};

// Hàm chuyển đổi strikePrice từ display format (float) sang blockchain format (integer)
export const formatStrikePriceForContract = (strikePriceFloat: string, multiplier: number = 100000000): number => {
  if (!strikePriceFloat) return 0;
  const price = parseFloat(strikePriceFloat);
  return Math.round(price * multiplier);
}; 