import "../../styles/fonts.css";
import "../../styles/globals.css";
import type { AppProps } from "next/app";
import { ChakraProvider } from "@chakra-ui/react";
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from "../themes/theme";
import muiTheme from "../themes/muiTheme";
import MainLayout from "../layouts";
import { Provider } from "react-redux";
import store from "../reduxs/store";
import Head from "next/head";
import dynamic from 'next/dynamic';

// Client-side only wrapper for React Router
const ClientSideRouterProvider = dynamic(
  () => import('../components/ClientSideRouterProvider'),
  { ssr: false }
);

function MyApp({ Component, pageProps }: AppProps) {
  const AnyComponent = Component as any;

  return (
    <Provider store={store}>
      <ChakraProvider theme={theme}>
        <MuiThemeProvider theme={muiTheme}>
          <CssBaseline />
          <ClientSideRouterProvider>
            <Head>
              <meta charSet="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </Head>
            <MainLayout>
              <AnyComponent {...pageProps} />
            </MainLayout>
          </ClientSideRouterProvider>
        </MuiThemeProvider>
      </ChakraProvider>
    </Provider>
  );
}

export default MyApp;
