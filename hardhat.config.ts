import '@xyrusworx/hardhat-solidity-json';
import '@nomicfoundation/hardhat-toolbox';
import { HardhatUserConfig } from 'hardhat/config';
import '@openzeppelin/hardhat-upgrades';
import 'solidity-coverage';
import '@nomiclabs/hardhat-solhint';
import '@primitivefi/hardhat-dodoc';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    WanchainTestnet:{
      // url: "https://gwan-ssl.wandevs.org:46891",
      url: "http://192.168.1.179:8545",
      gasPrice:3e9,
      accounts: {
        mnemonic: "skill level pulse dune pattern rival used syrup inner first balance sad",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
      },
    }
  },
  gasReporter: {
    enabled: true,
  },
  dodoc: {
    runOnCompile: false,
    debugMode: true,
    outputDir: "./docgen",
    freshOutput: true,
  },
};

export default config;
