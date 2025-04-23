import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState('');

  /**
   * Khởi tạo ví từ localStorage nếu có
   */
  useEffect(() => {
    const initWallet = async () => {
      const saved = localStorage.getItem('walletAddress');
      if (typeof window.ethereum !== 'undefined' && saved) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.listAccounts();
        const matched = accounts.find(a => a.toLowerCase() === saved.toLowerCase());

        if (matched) {
          setWalletAddress(matched);
          setIsConnected(true);
          const bal = await provider.getBalance(matched);
          setBalance(ethers.utils.formatEther(bal));
        } else {
          localStorage.removeItem('walletAddress');
        }
      }
    };
    initWallet();
  }, []);

  /**
   * Lắng nghe sự thay đổi tài khoản MetaMask
   */
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      const ethereum = window.ethereum as any;

      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          const newAddress = accounts[0];
          setWalletAddress(newAddress);
          setIsConnected(true);
          localStorage.setItem('walletAddress', newAddress);

          const provider = new ethers.providers.Web3Provider(ethereum);
          const bal = await provider.getBalance(newAddress);
          setBalance(ethers.utils.formatEther(bal));
        }
      };

      ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        if (typeof ethereum.removeListener === 'function') {
          ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, []);

  /**
   * Kết nối MetaMask
   */
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        const bal = await provider.getBalance(address);

        setWalletAddress(address);
        setBalance(ethers.utils.formatEther(bal));
        setIsConnected(true);
        localStorage.setItem('walletAddress', address);
      } catch (err) {
        console.error('Connect error:', err);
      }
    } else {
      alert("Please install MetaMask to use this DApp.");
    }
  };

  /**
   * Ngắt kết nối ví
   */
  const disconnectWallet = () => {
    setWalletAddress('');
    setBalance('');
    setIsConnected(false);
    localStorage.removeItem('walletAddress');
  };

  /**
   * Làm mới số dư
   */
  const refreshBalance = useCallback(async () => {
    if (walletAddress && typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const bal = await provider.getBalance(walletAddress);
        setBalance(ethers.utils.formatEther(bal));
      } catch (err) {
        console.error('Refresh balance error:', err);
      }
    }
  }, [walletAddress]);

  /**
   * Tự động cập nhật số dư mỗi block mới
   */
  useEffect(() => {
    if (isConnected && typeof window.ethereum !== 'undefined') {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      provider.on('block', refreshBalance);

      return () => {
        provider.removeAllListeners('block');
      };
    }
  }, [isConnected, refreshBalance]);

  return (
    <AuthContext.Provider
      value={{
        isConnected,
        walletAddress,
        balance,
        connectWallet,
        disconnectWallet,
        refreshBalance
      }}
    >
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
