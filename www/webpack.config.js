const path = require('path');
const webpack = require('webpack');

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
        extensions: ['.ts']
    },
    externals: [
        "cordova",
        "cordova/exec"
    ],
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: 'spotify-oauth.min.js',
        library: 'spotifyAuth',
        libraryTarget: 'commonjs'
    }
};