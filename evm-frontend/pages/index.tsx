import type { NextPage } from "next";
import Head from "next/head";
import UpDownContainer from "../src/views/plays/UpDownContainer";
import Owner from "../src/components/Owner";

const Home: NextPage = () => {
  return (
    <>
      <Owner address="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" />
    </>
  );
};

export default Home;
