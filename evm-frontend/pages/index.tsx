import type { NextPage } from "next";

import { useAuth } from "../src/context/AuthContext";
import { useEffect } from "react";
import { useRouter } from "next/router";
import ListAddressOwner from "../src/components/ListAddressOwner";

export const getServerSideProps = async (context) => {
  return {
    redirect: {
      destination: '/listaddress/1',
      permanent: false, 
    },
  };
};

const Home: NextPage = () => {
  const { isConnected, walletAddress, connectWallet } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const autoConnect = async () => {
      if (!isConnected) {
        try {
          await connectWallet();
        } catch (error) {
          console.error("Auto connect failed:", error);
          router.push('/listaddress/1');
        }
      }
    };
    autoConnect();
  }, [connectWallet, isConnected, router]);

  if (!isConnected) {
    return <div>Connecting wallet...</div>;
  }

  return (
    <>
      <ListAddressOwner ownerAddress={walletAddress} page={1} />
    </>
  );
};

export default Home;
