const config = require('./config')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const _ = require('lodash')
const { argv } = require('yargs')

const { paths } = config
const { __DEV__, __TEST__ } = config.compiler_globals

const webpackConfig = {
  name: 'client',
  target: 'web',
  devtool: config.compiler_devtool,
  resolve: {
    root: paths.base(),
    alias: {
      'semantic-ui-react': paths.src('index.js'),
    },
  },
  module: {},
}

// ------------------------------------
// Entry Points
// ------------------------------------

const webpackHotPath = `${config.compiler_public_path}__webpack_hmr`

const webpackHotMiddlewareEntry = `webpack-hot-middleware/client?${_.map({
  path: webpackHotPath,   // The path which the middleware is serving the event stream on
  timeout: 2000,          // The time to wait after a disconnection before attempting to reconnect
  overlay: true,          // Set to false to disable the DOM-based client-side overlay.
  reload: true,           // Set to true to auto-reload the page when webpack gets stuck.
  noInfo: false,          // Set to true to disable informational console logging.
  quiet: false,           // Set to true to disable all console logging.
}, (val, key) => `&${key}=${val}`).join('')}`

const APP_ENTRY = paths.docsSrc('index.js')

webpackConfig.entry = __DEV__ ? {
  app: [
    webpackHotMiddlewareEntry,
    APP_ENTRY,
  ],
  vendor: [
    webpackHotMiddlewareEntry,
    ...config.compiler_vendor,
  ],
} : {
  app: APP_ENTRY,
  vendor: config.compiler_vendor,
}

// ------------------------------------
// Bundle Output
// ------------------------------------
webpackConfig.output = {
  filename: `[name].[${config.compiler_hash_type}].js`,
  path: config.compiler_output_path,
  publicPath: config.compiler_public_path,
  pathinfo: true,
}

// ------------------------------------
// Plugins
// ------------------------------------
webpackConfig.plugins = [
  new webpack.DefinePlugin(config.compiler_globals),
  new webpack.DllReferencePlugin({
    context: paths.base('node_modules'),
    manifest: require(paths.base('dll/vendor-manifest.json')),
  }),
  new HtmlWebpackPlugin({
    template: paths.docsSrc('index.ejs'),
    hash: false,
    filename: 'index.html',
    inject: 'body',
    minify: {
      collapseWhitespace: true,
    },
    versions: {
      babel: require('babel-standalone/package.json').version,
      sui: require('semantic-ui-css/package.json').version,
      suir: require('./package.json').version,
      faker: require('faker/package.json').version,
      lodash: require('lodash/package.json').version,
      react: require('react/package.json').version,
      reactDOM: require('react-dom/package.json').version,
      jsBeautify: require('js-beautify/package.json').version,
    },
  }),
]

if (__DEV__) {
  webpackConfig.plugins.push(
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoErrorsPlugin()
  )
} else if (!__TEST__) {
  webpackConfig.plugins.push(
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        unused: true,
        dead_code: true,
        warnings: false,
      },
    })
  )
}

// Don't split bundles during testing, since we only want import one bundle
if (!__TEST__) {
  webpackConfig.plugins.push(new webpack.optimize.CommonsChunkPlugin({
    names: ['vendor'],
  }))
}

// ------------------------------------
// No Parse
// ------------------------------------
webpackConfig.module.noParse = [
  /\.json$/,
]

// ------------------------------------
// Pre-Loaders
// ------------------------------------
webpackConfig.module.preLoaders = []

// ------------------------------------
// Loaders
// ------------------------------------
webpackConfig.module.loaders = [{
  //
  // Babel
  //
  test: /\.js$/,
  exclude: /node_modules/,
  loader: 'babel',
  query: {
    cacheDirectory: true,
  },
}, {
  //
  // JSON
  //
  test: /\.(json|.*rc)$/,
  loader: 'json',
}]

// ----------------------------------------
// Local Modules
// ----------------------------------------
// For faster builds in dev, rely on prebuilt libraries
// Local modules can still be enabled (ie for offline development)
// in TEST we need local modules because karma uses a different index.html (no CDNs)
if (__TEST__ || argv.localModules) {
  webpackConfig.module.loaders = [
    ...webpackConfig.module.loaders,
    {
      //
      // SASS
      //
      test: /\.s?css$/,
      loaders: ['style', 'css', 'sass'],
    }, {
      //
      // Files
      //
      test: /\.(eot|ttf|woff|woff2|svg|png)$/,
      loader: 'file',
    },
  ]
} else {
  // these are browser ready modules or aliased to empty
  // do not parse their source for faster builds
  webpackConfig.module.noParse = [
    ...webpackConfig.module.noParse,
    /faker/,
  ]

  // alias imports to empty
  webpackConfig.resolve.alias = Object.assign({}, webpackConfig.resolve.alias, {
    'semantic-ui-css/semantic.css': 'empty',
  })

  // find them on the window
  webpackConfig.externals = Object.assign({}, webpackConfig.externals, {
    faker: 'faker',
    'anchor-js': 'AnchorJS',
    'babel-standalone': 'Babel',
    react: 'React',
    'react-dom': 'ReactDOM',
    'react-dom/server': 'ReactDOMServer',
  })
}

module.exports = webpackConfig
