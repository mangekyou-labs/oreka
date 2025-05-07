// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./orally-sdk/IOrallyVerifierOracle.sol";
import "./orally-sdk/OrallyStructs.sol";

contract YourDappContract {
    IOrallyVerifierOracle oracle;

    constructor(address orallyVerifierOracleAddress) {
        oracle = IOrallyVerifierOracle(orallyVerifierOracleAddress);
    }

    // price data from
    // https://tysiw-qaaaa-aaaak-qcikq-cai.icp0.io/get_xrc_data_with_proof?id=DOGE/SHIB&bytes=true&api_key={YOUR_API_KEY}
    function interact(
        bytes memory priceFeedData
    ) public view returns (OrallyStructs.PriceFeed memory) {
        // Verify the price feed data and get the price, decimals, and timestamp.
        OrallyStructs.PriceFeed memory priceFeed = oracle.verifyPriceFeed(
            priceFeedData
        );

        // priceFeed.price is the price of DOGE/SHIB
        // priceFeed.decimals is the number of decimals in the price
        // priceFeed.timestamp is the timestamp when price feed was aggregated

        return priceFeed;
    }

    // -- or --

    // with cache
    // https://tysiw-qaaaa-aaaak-qcikq-cai.icp0.io/get_xrc_data_with_proof?id=DOGE/SHIB&bytes=true&API_KEY={YOUR_API_KEY}
    /*
    function interact(
        bytes memory priceFeedData
    ) public returns (OrallyStructs.PriceFeed memory) {
        // Verify the price feed data and get the price, decimals, and timestamp.
        oracle.updatePriceFeed(priceFeedData);

        // Get the price feed data from the cache.
        OrallyStructs.PriceFeed memory priceFeed = oracle.getPriceFeed(
            "DOGE/SHIB"
        );

        // priceFeed.price is the price of DOGE/SHIB
        // priceFeed.decimals is the number of decimals in the price
        // priceFeed.timestamp is the timestamp when price feed was aggregated

        return priceFeed;
    }
    */

    // -- or --

    // without API key
    // https://tysiw-qaaaa-aaaak-qcikq-cai.icp0.io/get_xrc_data_with_proof?id=DOGE/SHIB&bytes=true
    /*
    function interact(
        bytes memory priceFeedData
    ) public payable returns (OrallyStructs.PriceFeed memory) {
        // Get the update fee for the price feed data.
        uint256 fee = oracle.getUpdateFee(priceFeedData);
        // Verify the price feed data and get the price, decimals, and timestamp.
        OrallyStructs.PriceFeed memory priceFeed = oracle
            .verifyPriceFeedWithFee{value: fee}(priceFeedData);
        // if this price feed will be needed for later usage you can use `updatePriceFeedWithFee` instead (+90k to gas) and access as `oracle.getPriceFeed("DOGE/SHIB")`

        // priceFeed.price is the price of DOGE/SHIB
        // priceFeed.decimals is the number of decimals in the price
        // priceFeed.timestamp is the timestamp when price feed was aggregated

        return priceFeed;
    }
    */

    // -- or verifying chain data example --

    // chain data from
    // https://tysiw-qaaaa-aaaak-qcikq-cai.icp0.io/read_contract_with_proof?chain_id=42161&function_signature="function balanceOf(address account) external view returns (uint256)"&contract_addr=0xA533f744B179F2431f5395978e391107DC76e103&method=balanceOf&params=(0x654DFF41D51c230FA400205A633101C5C1f1969C)&bytes=true
    function getSideChainUserTokenBalance(
        bytes calldata chainData
    ) public view returns (uint256) {
        // Verify the chain data and get the balance of the user.
        (bytes memory dataBytes, bytes memory metaBytes) = oracle
            .verifyReadContractData(chainData);
        // `verifyReadContractDataWithFee` for paying fee in the same transaction instead of API key

        uint256 balance = abi.decode(dataBytes, (uint256));
        OrallyStructs.ReadContractMetadata memory meta = abi.decode(
            metaBytes,
            (OrallyStructs.ReadContractMetadata)
        );

        // balance is the balance of the user of the requested token
        // meta.chainId is the chain id of the side chain
        // meta.contractAddr is the address of the contract on the side chain
        // meta.method is the method that was called on the contract
        // meta.params is the parameters that were passed to the method

        return balance;
    }
}
