import React, { useEffect } from 'react';
import Owner from '../src/components/Owner';
import { useAuth } from '../src/context/AuthContext';
import { useRouter } from 'next/router';

const OwnerPage = () => {
  const { isConnected, walletAddress, connectWallet } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const autoConnect = async () => {
      if (!isConnected) {
        try {
          await connectWallet();
        } catch (error) {
          console.error("Auto connect failed:", error);
          router.push('/listaddress');
        }
      }
    };
    autoConnect();
  }, []);

  if (!isConnected) {
    return <div>Connecting wallet...</div>;
  }

  return <Owner address={walletAddress} />;
};

export default OwnerPage;