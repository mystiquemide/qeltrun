import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import { configVariable, defineConfig } from 'hardhat/config';

export default defineConfig({
  plugins: [hardhatEthers],
  paths: {
    sources: 'contracts',
    tests: {
      solidity: 'test/solidity',
    },
  },
  solidity: {
    profiles: {
      default: {
        version: '0.8.35',
      },
      production: {
        version: '0.8.35',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: 'edr-simulated',
      chainType: 'l1',
      // The demo script places the real NoxCompute on the local chain so the Nox path is
      // genuine rather than mocked. Unoptimized it is ~30 KB, past the Spurious Dragon limit.
      // Local development only; nothing here affects the Sepolia deployment.
      allowUnlimitedContractSize: true,
    },
    sepolia: {
      type: 'http',
      chainType: 'l1',
      url: configVariable('SEPOLIA_RPC_URL'),
      accounts: [configVariable('PRIVATE_KEY')],
    },
  },
});
