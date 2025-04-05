// ... existing code ...
// Call the deploy function with the updated parameter order:
// name, price, expiry, type, pair
const result = await factoryService.deployMarket(
    marketNameTrimmed,        // name: Text
    strikePriceNum,           // price: Float64
    expiryTimestamp,          // expiry: Int (as BigInt)
    BigInt(marketTypeNum),    // type: Nat (as BigInt)
    tradingPair               // pair: Text
);

console.log("Deploy result:", result);
// ... existing code ...