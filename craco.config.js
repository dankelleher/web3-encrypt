const webpack = require('webpack')

module.exports = {
  webpack: {
    // Needed due to https://github.com/WalletConnect/walletconnect-monorepo/issues/584
    configure: (webpackConfig, { env, paths }) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        util: require.resolve(`util/`),
        url: require.resolve(`url/`),
        assert: require.resolve(`assert/`),
        crypto: require.resolve(`crypto-browserify`),
        os: require.resolve(`os-browserify/browser`),
        https: require.resolve(`https-browserify`),
        http: require.resolve(`stream-http`),
        stream: require.resolve(`stream-browserify`),
      }
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          process: "process/browser",
          Buffer: ['buffer', 'Buffer'],
        })
      )
      return webpackConfig;
    }
  },
}
