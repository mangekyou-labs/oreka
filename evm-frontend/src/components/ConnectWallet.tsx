import { Button, ButtonProps, useToast } from "@chakra-ui/react";
import { ethers, providers } from "ethers";
import React from "react";

declare global {
  interface Window {
    ethereum: providers.ExternalProvider;
  }
}

interface IProps {
  setWalletAddress?: (address: string) => void;
  setBalance?: (balance: string) => void;
  setIsWalletConnected?: (isConnected: boolean) => void;
}

const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function ConnectWallet({ 
  setWalletAddress, 
  setBalance, 
  setIsWalletConnected
}: IProps) {
  const toast = useToast();

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        const balanceWei = await provider.getBalance(address);
        const balanceEth = parseFloat(ethers.utils.formatEther(balanceWei));
        
        setWalletAddress?.(address);
        setBalance?.(balanceEth.toString());
        setIsWalletConnected?.(true);
        
        toast({
          title: "Wallet connected successfully!",
          description: `Address: ${shortenAddress(address)}`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (error: any) {
        console.error("Failed to connect wallet:", error);
        toast({
          title: "Failed to connect wallet",
          description: error.message || "Please make sure MetaMask is installed and unlocked.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    } else {
      toast({
        title: "MetaMask not detected",
        description: "Please install MetaMask to use this feature.",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
    }
  };

}
