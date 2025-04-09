import { ethers } from 'ethers';
import { format } from 'date-fns';

export const createIntermediatePoints = (timestamp: number, endTime: number) => {
  const points = [];
  const interval = (endTime - timestamp) / 10; // Create 10 intermediate points

  for (let i = 1; i <= 10; i++) {
    points.push({
      timestamp: timestamp + interval * i,
      // Add other properties as needed
    });
  }

  return points;
};

// Define and export the function
export const getProviderAndSigner = async () => {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();
  return { provider, signer };
}; 

export const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return format(date, 'MM/dd/yyyy HH:mm:ss');
};