const DFXWebPackConfig = require("./dfx.webpack.config")
DFXWebPackConfig.initCanisterIds()

const webpack = require("webpack")
const path = require("path")

// Make DFX_NETWORK available to Web Browser with default "local" if DFX_NETWORK is undefined
const EnvPlugin = new webpack.EnvironmentPlugin({
  DFX_NETWORK: "ic"
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_IC_HOST: "https://ic0.app",
    NEXT_PUBLIC_DEPLOYMENT_API_URL: "https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io",
    NEXT_PUBLIC_II_URL: "https://identity.ic0.app",
    NEXT_PUBLIC_INTERNET_IDENTITY_CANISTER_ID: "rdmx6-jaaaa-aaaaa-aaadq-cai",
    NEXT_PUBLIC_FACTORY_CANISTER_ID: "t2xwy-pyaaa-aaaar-qblaq-cai",
    NEXT_PUBLIC_ICP_LEDGER_CANISTER_CANISTER_ID: "ryjl3-tyaaa-aaaaa-aaaba-cai"
  },
  transpilePackages: ['@mui/material', '@mui/system', '@mui/icons-material', '@mui/private-theming'],
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Plugin
    config.plugins.push(EnvPlugin)

    config.resolve.alias = {
      ...config.resolve.alias,
      '@mui/material': '@mui/material/legacy',
      '@mui/system': '@mui/system/legacy',
      '@mui/icons-material': '@mui/icons-material/legacy',
      '@mui/private-theming': '@mui/private-theming/legacy',
      '@': path.resolve(__dirname, 'src'),
    };

    // Apply Webpack settings for ICP support
    config.resolve.fallback = {
      fs: false,
      path: false,
      assert: require.resolve("assert"),
      events: require.resolve("events"),
      stream: require.resolve("stream-browserify"),
      util: require.resolve("util")
    };

    // Important: return the modified config
    return config
  },
  // Explicitly use 'export' for static site generation
  output: "export",
  // Configure images for static export with custom loader
  images: {
    loader: 'custom',
    loaderFile: './my-loader.js',
  },
  // Add explicit export path map to ensure HTML files are generated
  exportPathMap: async function (
    defaultPathMap,
    { dev, dir, outDir, distDir, buildId }
  ) {
    return {
      '/': { page: '/' },
      '/admin': { page: '/admin' },
      '/factory': { page: '/factory' },
      '/listaddress': { page: '/listaddress' },
      '/markets': { page: '/markets' },
      '/404': { page: '/404' },
    };
  },
  // Disable TypeScript type checking in build
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // This is needed for static export
  trailingSlash: true,
}

module.exports = nextConfig
