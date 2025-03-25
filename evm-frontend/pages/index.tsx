import type { NextPage } from "next";
import Head from "next/head";
import UpDownContainer from "../src/views/plays/UpDownContainer";
import Owner from "../src/components/Owner";
import { useAuth } from "../src/context/AuthContext";
import { useEffect } from "react";
import { useRouter } from "next/router";

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
          router.push('/listaddress');
        }
      }
    };
    autoConnect();
  }, []);

  if (!isConnected) {
    return <div>Connecting wallet...</div>;
  }

  return (
    <>
      <Owner address={walletAddress} />
    </>
  );
};

export default Home;
