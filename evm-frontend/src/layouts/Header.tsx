import React, { useEffect, useState } from "react";
import { Flex, Text, HStack, Icon } from "@chakra-ui/react";
import { MdOutlineAccountBalanceWallet } from "react-icons/md";
import { ethers } from "ethers";

function Header({ walletAddress }: { walletAddress: string }) {
  const [balance, setBalance] = useState("0"); /// balance of wallet

  // get balance of wallet
  const fetchBalance = async (address: string) => {
    if (window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const balance = await provider.getBalance(address);
        setBalance(ethers.utils.formatEther(balance)); // revert wei in to eth
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    }
  };

  // call fetBalance when connect wallet
  useEffect(() => {
    if (walletAddress) {
      fetchBalance(walletAddress);
    }
  }, [walletAddress]); 

  return (
    <Flex
      w="100%"
      justifyContent="center"
      alignItems="center"
      direction="column"
    >
      {/* show wallet address and balance when connect wallet */}
      {walletAddress && (
        <HStack spacing="20px" mt="30px" align="center">
          <Flex
            align="center"
            p={2}
            bg="#000000"
            borderRadius="full"
            boxShadow="lg"
            pl={3}
          >
            <Icon as={MdOutlineAccountBalanceWallet as React.ElementType} boxSize={6} color="#FEDF56" />
            <Text ml={2} fontSize="md" color="#FEDF56">
              {balance} ETH
            </Text>
          </Flex>

          <Flex
            align="center"
            p={2}
            bg="#000000"
            borderRadius="full"
            boxShadow="lg"
            pl={3}
          >
            <Icon as={MdOutlineAccountBalanceWallet as React.ElementType} boxSize={6} color="#FEDF56" />
            <Text ml={2} fontSize="md" color="#FEDF56">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </Text>
          </Flex>
        </HStack>
      )}
    </Flex>
  );
}

export default Header;
