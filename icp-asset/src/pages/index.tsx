import type { NextPage } from "next";
import Head from "next/head";
import Customer from "../components/Customer";
import Navbar from "../components/Navbar";

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Oreka Binary Options</title>
        <meta name="description" content="Decentralized binary options trading platform" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Navbar />
      <Customer />
    </>
  );
};

export default Home;
