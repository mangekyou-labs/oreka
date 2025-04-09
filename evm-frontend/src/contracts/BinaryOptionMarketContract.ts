// import { useEffect, useState } from 'react';
import { ethers, Contract } from "ethers";
import { ILatestRound, IBidResult } from "../types";
import { OPTION_SIDE } from "./types";
// import { BaseInterface } from "./interfaces";
// import BINARY_OPTION_MARKET_ABI from "./abis/BinaryOptionMarketABI.json";
// import ContractABI from "./abis/BinaryOptionMarketABI.json";
// import ContractBalance from '../components/Contractbalance';

const ABI = [
  "function bid(uint8 side) public payable",
  "function startTrading() external",
  "function expireMarket() external",
  "function resolveMarket() external",
  "function claimReward() external",
  "function setStrikePrice(uint _strikePrice) external",
  "function checkRewardsAvailable() public view returns (bool)",
  "function positions() public view returns (uint long, uint short)",
  "function currentPhase() public view returns (uint8)",
  "function oracleDetails() public view returns (uint strikePrice, string finalPrice)"
];

interface ILatestRound {
  answer: string;
  decimals: number;
}

export class BinaryOptionMarketContract {
  private _contract: Contract;
  
  constructor(contractAddress: string, provider: ethers.providers.Web3Provider) {
    this._contract = new Contract(contractAddress, ABI, provider.getSigner());
  }

  latestRoundDataAsync = async (): Promise<ILatestRound> => {
    try {
      const rs = await this._contract.latestRoundData();
      const decimals = await this._contract.decimals();

      return {
        answer: rs.answer,
        decimals: decimals,
      };
    } catch (error) {
      console.error("Error fetching latest round data:", error);
      throw error;
    }
  };

  bid = async (side: OPTION_SIDE, ethAmount: string): Promise<IBidResult> => {
    try {
      const tx = await this._contract.bid(side, { 
        value: ethers.utils.parseEther(ethAmount) 
      });
      const receipt = await tx.wait();
      return receipt;
    } catch (error) {
      console.error("Error placing a bid: ", error);
      throw new Error("Failed to place a bid. Please try again.");
    }
  };

  claimReward = async (): Promise<void> => {
    try {
      const tx = await this._contract.claimReward();
      await tx.wait();
      console.log("Rewards claimed successfully!");
    } catch (error) {
      console.error("Error claiming rewards: ", error);
      throw new Error("Failed to claim rewards. Please try again.");
    }
  };

  startTrading = async (): Promise<void> => {
    try {
      const tx = await this._contract.startTrading();
      await tx.wait();
      console.log("Trading started successfully!");
    } catch (error) {
      console.error("Error starting trading: ", error);
      throw new Error("Failed to start trading. Please try again.");
    }
  };

  checkRewardsAvailable = async (): Promise<boolean> => {
    try {
      return await this._contract.checkRewardsAvailable();
    } catch (error) {
      console.error("Error checking rewards availability: ", error);
      throw new Error("Failed to check rewards. Please try again.");
    }
  };

  getPositions = async (): Promise<{long: string, short: string}> => {
    try {
      const positions = await this._contract.positions();
      return {
        long: ethers.utils.formatEther(positions.long),
        short: ethers.utils.formatEther(positions.short)
      };
    } catch (error) {
      console.error("Error getting positions: ", error);
      throw new Error("Failed to get positions. Please try again.");
    }
  };

  getCurrentPhase = async (): Promise<number> => {
    try {
      return await this._contract.currentPhase();
    } catch (error) {
      console.error("Error getting current phase: ", error);
      throw new Error("Failed to get current phase. Please try again.");
    }
  };

  getOracleDetails = async (): Promise<{strikePrice: string, finalPrice: string}> => {
    try {
      const details = await this._contract.oracleDetails();
      return {
        strikePrice: ethers.utils.formatUnits(details.strikePrice, 0),
        finalPrice: details.finalPrice
      };
    } catch (error) {
      console.error("Error getting oracle details: ", error);
      throw new Error("Failed to get oracle details. Please try again.");
    }
  };
}
  

  

  
  

  

  

