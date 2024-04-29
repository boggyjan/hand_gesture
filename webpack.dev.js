const { merge } = require('webpack-merge')
const common = require('./webpack.common.js')
const path = require('path')
const webpack = require('webpack')
const { VueLoaderPlugin } = require('vue-loader')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = merge(common, {
  mode: 'development',

  output: {
    publicPath: '/'
  },

  devtool: 'inline-source-map',

  devServer: {
    allowedHosts: 'all',
    client: {
      logging: 'info',
    },
    static: {
      directory: path.resolve('static'),
    },
    compress: true,
    port: 9000,
    // devMiddleware: {
    //   index: true,
    //   mimeTypes: { phtml: 'text/html' },
    //   publicPath: '/publicPathForDevServe',
    //   serverSideRender: true,
    //   writeToDisk: true,
    // }
  }
})
