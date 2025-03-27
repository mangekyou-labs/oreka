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

    // Important: return the modified config
    return config
  },
  output: "export"
}

module.exports = nextConfig
