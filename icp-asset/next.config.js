const DFXWebPackConfig = require("./dfx.webpack.config")
DFXWebPackConfig.initCanisterIds()

const webpack = require("webpack")
const path = require("path")

// Make DFX_NETWORK available to Web Browser with default "local" if DFX_NETWORK is undefined
const EnvPlugin = new webpack.EnvironmentPlugin({
  DFX_NETWORK: "local"
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_IC_HOST: process.env.NEXT_PUBLIC_IC_HOST || "http://localhost:4943",
    NEXT_PUBLIC_DEPLOYMENT_API_URL: process.env.NEXT_PUBLIC_DEPLOYMENT_API_URL || "http://localhost:3001/api/deploy"
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
  output: "export"
}

module.exports = nextConfig
