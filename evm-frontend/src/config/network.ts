import { ethers } from 'ethers';
export const networkConfig = {
  anvil: {
    chainId: 31337,
    name: 'anvil',
    ensAddress: null
  }
};

export const getProvider = () => {
  return new ethers.providers.Web3Provider(window.ethereum, {
    chainId: networkConfig.anvil.chainId,
    name: networkConfig.anvil.name,
    ensAddress: null
  });
}; 