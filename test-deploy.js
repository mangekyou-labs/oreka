// Create a simple test script
const { FactoryApiService } = require('./icp-asset/src/service/FactoryService');

async function testDeployMarket() {
    const factoryService = new FactoryApiService();

    // Test with exactly the same parameters that worked in the CLI
    console.log("Testing deployMarket with correct parameter types...");
    const result = await factoryService.deployMarket(
        "Test Market",                // Text
        100.0,                       // Float64
        3600,                        // Int
        10,                          // Nat
        "BTC-USD"                    // Text
    );

    console.log("Deploy result:", result);
}

testDeployMarket().catch(console.error); 