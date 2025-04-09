import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface AuthContextType {
  isConnected: boolean;
  walletAddress: string;
  balance: string;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState('');

  // Kiểm tra trạng thái đăng nhập khi khởi động
  useEffect(() => {
    const checkConnection = async () => {
      const savedAddress = localStorage.getItem('walletAddress');
      if (savedAddress && window.ethereum) {
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const accounts = await provider.listAccounts();
          
          if (accounts[0] && accounts[0].toLowerCase() === savedAddress.toLowerCase()) {
            setWalletAddress(accounts[0]);
            setIsConnected(true);
            const balance = await provider.getBalance(accounts[0]);
            setBalance(ethers.utils.formatEther(balance));
          }
        } catch (error) {
          console.error("Failed to restore connection:", error);
          localStorage.removeItem('walletAddress');
        }
      }
    };

    checkConnection();
  }, []);

  // Theo dõi thay đổi tài khoản
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          localStorage.setItem('walletAddress', accounts[0]);
        } else {
          disconnectWallet();
        }
      };

      // Sử dụng type assertion để truy cập removeListener
      const ethereum = window.ethereum as any;
      ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        if (ethereum && typeof ethereum.removeListener === 'function') {
          ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, []);

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        const balance = await provider.getBalance(address);

        setWalletAddress(address);
        setBalance(ethers.utils.formatEther(balance));
        setIsConnected(true);
        localStorage.setItem('walletAddress', address);
      } catch (error) {
        console.error("Failed to connect wallet:", error);
      }
    }
  };

  const disconnectWallet = () => {
    setWalletAddress('');
    setBalance('');
    setIsConnected(false);
    localStorage.removeItem('walletAddress');
  };

  const refreshBalance = async () => {
    if (walletAddress && window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const balance = await provider.getBalance(walletAddress);
        setBalance(ethers.utils.formatEther(balance));
      } catch (error) {
        console.error("Failed to refresh balance:", error);
      }
    }
  };

  // Thêm useEffect để lắng nghe block mới
  useEffect(() => {
    if (isConnected && window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      provider.on("block", refreshBalance);

      return () => {
        provider.removeAllListeners("block");
      };
    }
  }, [isConnected, walletAddress]);

  return (
    <AuthContext.Provider value={{
      isConnected,
      walletAddress,
      balance,
      connectWallet,
      disconnectWallet,
      refreshBalance
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 