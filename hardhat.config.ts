import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import { configVariable, defineConfig } from 'hardhat/config';

/// Hardhat requires a `0x`-prefixed private key, but wallets and key managers hand out bare
/// 64-character hex about as often as prefixed. Normalizing here beats making anyone edit a
/// secrets file, and the failure it prevents ("invalid private key") does not say what is wrong.
///
/// Read directly rather than through `configVariable` because that defers resolution and cannot
/// be transformed. If the variable is absent the array is empty, so local commands still work
/// and only the networks that need a signer complain.
function deployerAccounts(): string[] {
  const key = process.env.PRIVATE_KEY?.trim();
  if (key === undefined || key === '') return [];
  return [key.startsWith('0x') ? key : `0x${key}`];
}

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
        settings: {
          // The optimizer is on by default, not just in production. Unoptimized `NoxCompute`
          // is ~30 KB, past the Spurious Dragon limit, so the local demo could not deploy the
          // real protocol contract without it — and testing against the real one is the point.
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
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
    // The node `pnpm run node` starts, which the web app talks to. Separate from
    // `hardhatMainnet` because that one is in-process and disappears with the script.
    localhost: {
      type: 'http',
      chainType: 'l1',
      url: 'http://127.0.0.1:8545',
    },
    sepolia: {
      type: 'http',
      chainType: 'l1',
      url: configVariable('SEPOLIA_RPC_URL'),
      accounts: deployerAccounts(),
    },
  },
});
