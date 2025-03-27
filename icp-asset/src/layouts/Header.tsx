import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  HStack,
  useColorModeValue,
  Container,
  useDisclosure,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
  VStack,
  Button,
  useBreakpointValue,
  Link as ChakraLink,
} from '@chakra-ui/react';
import { HamburgerIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/router';
import { AuthClient } from '@dfinity/auth-client';

export default function Header() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPrincipal, setUserPrincipal] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const isMobile = useBreakpointValue({ base: true, md: false });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authClient = await AuthClient.create();
        const authenticated = await authClient.isAuthenticated();
        setIsAuthenticated(authenticated);

        if (authenticated) {
          const identity = authClient.getIdentity();
          const principal = identity.getPrincipal().toString();
          setUserPrincipal(principal);
        }
      } catch (error) {
        console.error('Error checking authentication status:', error);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = async () => {
    try {
      const authClient = await AuthClient.create();

      authClient.login({
        identityProvider: process.env.NEXT_PUBLIC_II_URL ||
          (process.env.NODE_ENV !== "production"
            ? "http://localhost:4943?canisterId=rdmx6-jaaaa-aaaaa-aaadq-cai"
            : "https://identity.ic0.app"),
        onSuccess: () => {
          setIsAuthenticated(true);
          const identity = authClient.getIdentity();
          const principal = identity.getPrincipal().toString();
          setUserPrincipal(principal);
        },
      });
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const authClient = await AuthClient.create();
      await authClient.logout();
      setIsAuthenticated(false);
      setUserPrincipal(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navigateTo = (path: string) => {
    router.push(path);
  };

  const isActive = (path: string) => router.pathname === path;

  // Navigation items
  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Factory', path: '/factory' },
    { name: 'Markets', path: '/markets' },
  ];

  // Mobile drawer navigation
  const MobileNav = () => (
    <>
      <IconButton
        aria-label="Open menu"
        icon={<HamburgerIcon />}
        variant="ghost"
        color="white"
        onClick={onOpen}
        display={{ base: 'flex', md: 'none' }}
      />
      <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="xs">
        <DrawerOverlay backdropFilter="blur(10px)" bg="rgba(0, 0, 0, 0.3)" />
        <DrawerContent bg="#0a1647">
          <DrawerCloseButton color="white" />
          <DrawerHeader borderBottomWidth="1px" borderColor="rgba(255, 255, 255, 0.1)">
            <Text
              fontSize="xl"
              color="white"
              fontWeight="bold"
              bgGradient="linear(to-r, #4a63c8, #5a73d8, #6a83e8)"
              bgClip="text"
            >
              OREKA
            </Text>
          </DrawerHeader>
          <DrawerBody py={6}>
            <VStack spacing={4} align="stretch">
              {navItems.map((item) => (
                <Button
                  key={item.name}
                  variant="ghost"
                  justifyContent="flex-start"
                  h="48px"
                  color={isActive(item.path) ? "white" : "whiteAlpha.700"}
                  bgColor={isActive(item.path) ? "rgba(74, 99, 200, 0.2)" : "transparent"}
                  borderRadius="md"
                  px={4}
                  _hover={{ bgColor: "rgba(255, 255, 255, 0.05)", color: "white" }}
                  onClick={() => {
                    navigateTo(item.path);
                    onClose();
                  }}
                  leftIcon={
                    isActive(item.path) ? (
                      <Box w="3px" h="20px" bg="#4a63c8" borderRadius="full" position="absolute" left={0} />
                    ) : undefined
                  }
                >
                  {item.name}
                </Button>
              ))}

              <Box pt={4} mt={4} borderTopWidth="1px" borderColor="rgba(255, 255, 255, 0.1)">
                {isAuthenticated ? (
                  <VStack spacing={3} align="stretch">
                    <Text color="whiteAlpha.700" fontSize="sm" mb={1}>
                      Logged in as:
                    </Text>
                    <Text color="white" fontSize="sm" fontFamily="monospace" isTruncated>
                      {userPrincipal}
                    </Text>
                    <Button
                      colorScheme="blue"
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      mt={2}
                    >
                      Log Out
                    </Button>
                  </VStack>
                ) : (
                  <Button
                    colorScheme="blue"
                    size="md"
                    w="full"
                    onClick={handleLogin}
                    bg="rgba(74, 99, 200, 0.8)"
                    _hover={{ bg: "rgba(106, 131, 232, 0.8)" }}
                  >
                    Log In with Internet Identity
                  </Button>
                )}
              </Box>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );

  return (
    <Box
      bg="#0a1647"
      boxShadow="0 4px 20px rgba(0, 0, 0, 0.3)"
      zIndex={10}
      position="sticky"
      top={0}
      borderBottom="1px solid rgba(255, 255, 255, 0.05)"
    >
      <Container maxW="container.xl" py={4}>
        <Flex h={16} alignItems="center" justifyContent="space-between">
          {/* Logo */}
          <Box cursor="pointer" onClick={() => navigateTo('/')}>
            <Text
              fontSize="2xl"
              fontWeight="bold"
              color="white"
              bgGradient="linear(to-r, #4a63c8, #5a73d8, #6a83e8)"
              bgClip="text"
              letterSpacing="wider"
            >
              OREKA
            </Text>
          </Box>

          {/* Desktop Navigation */}
          <HStack spacing={6} display={{ base: 'none', md: 'flex' }}>
            {navItems.map((item) => (
              <Box
                key={item.name}
                position="relative"
                cursor="pointer"
                color={isActive(item.path) ? "white" : "whiteAlpha.700"}
                fontWeight={isActive(item.path) ? "semibold" : "normal"}
                _hover={{ color: "white" }}
                onClick={() => navigateTo(item.path)}
                transition="all 0.2s"
              >
                <Text>{item.name}</Text>
                {isActive(item.path) && (
                  <Box
                    position="absolute"
                    bottom="-16px"
                    left="0"
                    right="0"
                    height="3px"
                    bgGradient="linear(to-r, #4a63c8, #5a73d8)"
                    borderRadius="full"
                  />
                )}
              </Box>
            ))}
          </HStack>

          {/* Login/Identity Section */}
          <Flex alignItems="center">
            {isAuthenticated ? (
              <Menu>
                <MenuButton
                  as={Button}
                  size="sm"
                  variant="outline"
                  rightIcon={<ChevronDownIcon />}
                  display={{ base: 'none', md: 'flex' }}
                  colorScheme="blue"
                  color="white"
                  borderColor="rgba(255, 255, 255, 0.3)"
                  _hover={{
                    borderColor: "blue.400",
                    bg: "rgba(66, 153, 225, 0.1)"
                  }}
                  _active={{
                    borderColor: "blue.500",
                    bg: "rgba(66, 153, 225, 0.2)"
                  }}
                >
                  <Text fontSize="sm" maxW="150px" isTruncated>
                    {userPrincipal && `${userPrincipal.substring(0, 5)}...${userPrincipal.substring(userPrincipal.length - 3)}`}
                  </Text>
                </MenuButton>
                <MenuList bg="#0F1F3C" borderColor="rgba(255, 255, 255, 0.1)">
                  <MenuItem
                    bg="#0F1F3C"
                    color="white"
                    _hover={{ bg: "rgba(66, 153, 225, 0.2)" }}
                    onClick={handleLogout}
                  >
                    Log Out
                  </MenuItem>
                </MenuList>
              </Menu>
            ) : (
              <Button
                colorScheme="blue"
                size="sm"
                onClick={handleLogin}
                display={{ base: 'none', md: 'flex' }}
                bg="rgba(74, 99, 200, 0.8)"
                _hover={{ bg: "rgba(106, 131, 232, 0.8)" }}
              >
                Log In
              </Button>
            )}

            {/* Mobile Navigation */}
            <MobileNav />
          </Flex>
        </Flex>
      </Container>
    </Box>
  );
}
