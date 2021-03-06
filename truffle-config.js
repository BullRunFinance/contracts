/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * trufflesuite.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

 const HDWalletProvider = require('@truffle/hdwallet-provider');
 const fs = require('fs');

 const { mnemonic, bscscanApiKey, polygonscanApiKey, ftmscanApiKey, etherscanKey, infuraKey } = require('./.secrets.json');

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */
  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    bscscan: bscscanApiKey,
    ftmscan: ftmscanApiKey,
    polygonscan: polygonscanApiKey
  },
  networks: {
    development: {
     host: "127.0.0.1",     // Localhost (default: none)
     port: 9545,            // Standard Ethereum port (default: none)
     network_id: "*"       // Any network (default: none)
    },
    bsc_testnet: {
      provider: () => new HDWalletProvider(mnemonic, `https://data-seed-prebsc-1-s1.binance.org:8545`),
      network_id: 97,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      apiKey: bscscanApiKey
    },
    bsc_mainnet: {
      provider: () => new HDWalletProvider(mnemonic, `https://bsc-dataseed1.binance.org`),
      network_id: 56,
      confirmations: 5,
      timeoutBlocks: 200,
      skipDryRun: true,
      apiKey: bscscanApiKey
    },
    polygon_testnet: {
      provider: () => new HDWalletProvider(mnemonic, `https://polygon-mumbai.infura.io/v3/` + infuraKey),
      network_id: 80001,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true
    },
    polygon_mainnet: {
      provider: () => new HDWalletProvider(mnemonic, `https://polygon-mainnet.infura.io/v3/` + infuraKey),
      network_id: 137,
      gasPrice: "40000000000",
      timeoutBlocks: 200,
      skipDryRun: true,
      apiKey: polygonscanApiKey
    },
    fantom_mainnet: {
      provider: () => new HDWalletProvider(mnemonic, `https://rpcapi.fantom.network`),
      network_id: 250,
      timeoutBlocks: 200,
      skipDryRun: true,
      apiKey: ftmscanApiKey
    },
    fantom_testnet: {
      provider: () => new HDWalletProvider(mnemonic, `https://rpc.testnet.fantom.network`),
      network_id: 0xfa2,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: true
    },
  },

  // Configure your compilers
  compilers: {
    solc: {
        version: "0.8.4",    // Fetch exact version from solc-bin (default: truffle's version)
        settings: {          // See the solidity docs for advice about optimization and evmVersion
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
    }
  },
  db: {
    enabled: false
  }
};
