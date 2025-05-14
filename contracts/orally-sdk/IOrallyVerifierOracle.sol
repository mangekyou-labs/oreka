// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import {OrallyStructs} from "./OrallyStructs.sol";

/**
 * @title IOrallyVerifierOracle
 * @notice Interface for the OrallyVerifierOracle contract.
 * This interface defines the required functions for verifying and handling
 * data feeds, specifically focusing on functionality related to price feeds
 * and custom data verification processes.
 */
interface IOrallyVerifierOracle {
    // Events to notify about changes in reporter status or data updates
    event ReporterAdded(address indexed reporter);
    event ReporterRemoved(address indexed reporter);
    event PriceFeedSaved(string indexed pairId, uint256 price, uint256 decimals, uint256 timestamp);
    event CustomNumberSaved(string indexed feedId, uint256 value, uint256 decimals);
    event CustomStringSaved(string indexed feedId, string value);

    // Price Feeds

    /**
     * @notice Gets the price feed data for a given pair ID.
     * @param pairId The unique identifier for the currency pair.
     * @return The price feed data for the given pair ID.
     */
    function getPriceFeed(string memory pairId) external view returns (OrallyStructs.PriceFeed memory);

    /**
     * @notice Verifies the integrity and authenticity of price feed data, then returns it (if fee paid with API key / allowed domain).
     * @param _data The packed byte array containing the price feed and its signature.
     * @return Tuple of pair ID, price, decimals, and timestamp if the verification is successful.
     */
    function verifyPriceFeed(bytes memory _data) external view returns (OrallyStructs.PriceFeed memory);

    /**
     * @notice Verifies, caches, and returns the details of a price feed (if fee paid with API key / allowed domain).
     * Caching is performed to store the most recent and valid data.
     * @param _data The packed data containing the price feed and its signature.
     * @return Tuple of pair ID, price, decimals, and timestamp.
     */
    function updatePriceFeed(bytes memory _data) external returns (OrallyStructs.PriceFeed memory);

    // --------------------------------------------------------------
    // Custom Numbers

    /**
     * @notice Gets the custom number data for a given feed ID.
     * @param _feedId The unique identifier for the custom number feed.
     * @return The custom number data for the given feed ID.
     */
    function getCustomNumber(string memory _feedId) external view returns (OrallyStructs.CustomNumber memory);

    /**
     * @notice Verifies and returns custom numerical data from provided packed data.
     * @param data The packed data containing custom numerical information and its signature.
     * @return Tuple containing the feed ID, numerical value, and decimals.
     */
    function verifyCustomNumber(bytes memory data) external view returns (OrallyStructs.CustomNumber memory);

    /**
     * @notice Verifies, caches, and returns the details of a custom number feed (if fee paid with API key / allowed domain).
     * Caching is performed to store the most recent and valid data.
     * @param _data The packed data containing the custom number feed and its signature.
     * @return Tuple of feed ID, numerical value, and decimals.
     */
    function updateCustomNumber(bytes memory _data) external returns (OrallyStructs.CustomNumber memory);

    // --------------------------------------------------------------
    // Custom Strings

    /**
     * @notice Gets the custom string data for a given feed ID.
     * @param _feedId The unique identifier for the custom string feed.
     * @return The custom string data for the given feed ID.
     */
    function getCustomString(string memory _feedId) external view returns (OrallyStructs.CustomString memory);

    /**
     * @notice Verifies and returns custom string data from provided packed data.
     * @param data The packed data containing custom string information and its signature.
     * @return Tuple containing the feed ID and the string value.
     */
    function verifyCustomString(bytes memory data) external view returns (OrallyStructs.CustomString memory);

    /**
     * @notice Verifies, caches, and returns the details of a custom string feed (if fee paid with API key / allowed domain).
     * Caching is performed to store the most recent and valid data.
     * @param _data The packed data containing the custom string feed and its signature.
     * @return Tuple of feed ID and the string value.
     */
    function updateCustomString(bytes memory _data) external returns (OrallyStructs.CustomString memory);

    // --------------------------------------------------------------

    /**
     * @notice Verifies and returns the details of a chain data feed from provided feed.
     * @param _chainData The packed data containing the chain data feed and its signature.
     * @return Tuple of chainData and metaData if the verification is successful.
     */
    function verifyReadContractData(bytes memory _chainData) external view returns (bytes memory, bytes memory);

    /**
    * @notice Verifies and returns the details of a chain data feed from provided feed.
     * @param _chainData The packed data containing the chain data feed and its signature.
     * @return Tuple of chainData and metaData if the verification is successful.
     */
    function verifyReadLogsData(bytes memory _chainData) external view returns (bytes memory, bytes memory);

    // Reporters

    /**
     * @notice Checks if an address is an authorized reporter.
     * @param _reporter The address to check.
     * @return bool Returns true if the address is authorized to submit data.
     */
    function isReporter(address _reporter) external view returns (bool);
}
