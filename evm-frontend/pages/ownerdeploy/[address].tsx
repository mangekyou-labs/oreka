import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import OwnerDeploy from '../../src/components/OwnerDeploy';
import { useAuth } from '../../src/context/AuthContext';

const OwnerDeployPage: React.FC = () => {
  const router = useRouter();
  const { address } = router.query;
  const { isConnected, walletAddress, connectWallet } = useAuth();

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

  if (!isConnected || !address) {
    return <div>Loading...</div>;
  }

  return (
    <OwnerDeploy address={address as string} />
  );
};

export default OwnerDeployPage; 