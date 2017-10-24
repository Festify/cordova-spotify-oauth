const TypeDocPlugin = require('typedoc-webpack-plugin');
const path = require('path');

module.exports = {
    entry: './spotify-oauth.ts',
    module: {
        rules: [{
            test: /(\.ts)/,
            exclude: /node_modules/,
            use: 'awesome-typescript-loader'
        }]
    },
    resolve: {
        extensions: ['.js', '.ts']
    },
    devtool: 'source-map',
    externals: [
        "cordova",
        "cordova/exec",
        "NativeStorage"
    ],
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: 'spotify-oauth.min.js',
        library: 'spotifyAuth',
        libraryTarget: 'commonjs'
    },
    plugins: [
        new TypeDocPlugin({
            excludeExternals: true,
            excludePrivate: true,
            ignoreCompilerErrors: true,
            name: "Cordova Spotify OAuth Plugin",
            mode: 'file',
            readme: 'none',
            target: 'ES6'
        }, './spotify-oauth.ts')
    ]
};