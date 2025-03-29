import { Flex, Box } from "@chakra-ui/react";
import { ReactNode } from "react";
import { useWindowSize } from "../hooks/useWindowSize";
import Header from "./Header";

export interface IProps {
  children: ReactNode;
}
export default function MainLayout({ children }: IProps) {
  const { height } = useWindowSize();
  return (
    <Box w="100%" bg="rgba(0,0,0, 0.9)" minH={height}>
      {/* Header is outside the main container to span full width */}
      <Header />

      <Flex
        w="100%"
        maxW="1440px"
        margin="0px auto"
        flexDirection="column"
        alignItems="center"
        justifyContent="flex-start"
        px={{ base: "20px", md: "40px" }}
        py="20px"
        minH={height * 0.6}
        mt={{ base: '20px', lg: "56px" }}
      >
        {children}
      </Flex>
    </Box>
  )
}