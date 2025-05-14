import React, { useEffect, useState } from "react";
import { Flex, Text, HStack, Icon } from "@chakra-ui/react";
import { MdOutlineAccountBalanceWallet } from "react-icons/md";
import { ethers } from "ethers";

function Header({ walletAddress }: { walletAddress: string }) {
  const [balance, setBalance] = useState("0"); // Số dư của ví

  // Hàm để lấy số dư của địa chỉ ví
  const fetchBalance = async (address: string) => {
    if (window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const balance = await provider.getBalance(address);
        setBalance(ethers.utils.formatEther(balance)); // Chuyển đổi từ wei sang ETH
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    }
  };

  // Gọi hàm lấy số dư khi ví được kết nối
  useEffect(() => {
    if (walletAddress) {
      fetchBalance(walletAddress);
    }
  }, [walletAddress]); // Chạy lại khi địa chỉ ví thay đổi

  return (
    <Flex
      w="100%"
      justifyContent="center"
      alignItems="center"
      direction="column"
    >
      {/* Hiển thị số dư và địa chỉ ví nếu đã kết nối */}
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
