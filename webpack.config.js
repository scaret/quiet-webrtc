const path = require('path')

module.exports = {
    mode: "production",
    entry: {
        Quiet: "./src/entry.ts"
    },
    output: {
        devtoolNamespace: 'Quiet',
        path: path.join(__dirname, 'dist'),
            library: '[name]',
            libraryTarget: 'umd',
    },
    module: {
        rules: [
            {
                test: /\.ts?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.mp3|.webm$/,
                use: 'arraybuffer-loader',
                exclude: /node_modules/,
            },
        ]
    },
    devtool: 'source-map',
    resolve: {
        extensions: ['.ts', '.js' ],
    },
    plugins: [
    ],
}
