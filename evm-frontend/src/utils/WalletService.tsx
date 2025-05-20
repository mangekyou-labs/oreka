import { ethers } from "ethers";

// connect wallet and get info
export const connectToMetaMask = async () => {
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const account = accounts[0]; 
      return account; 
    } catch (error) {
      console.error("User rejected the request:", error);
      throw new Error("MetaMask connection rejected");
    }
  } else {
    alert("Please install MetaMask!");
    throw new Error("MetaMask not installed");
  }
};

export const fetchBalance = async (address) => {
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const balanceInWei = await provider.getBalance(address); 
    const balanceInEther = ethers.utils.formatEther(balanceInWei); 
    return balanceInEther; 
  } catch (error) {
    console.error("Error fetching balance:", error);
    throw new Error("Error fetching balance");
  }
};