import { createHandleClient, createViemHandleClient, createEthersHandleClient } from '@iexec-nox/handle';
import type { ACL, Handle, HandleClient, HandleClientConfig, SolidityType } from '@iexec-nox/handle';

const exportedFactories = {
  createHandleClient: typeof createHandleClient,
  createViemHandleClient: typeof createViemHandleClient,
  createEthersHandleClient: typeof createEthersHandleClient,
};

const sepoliaConfig = {
  gatewayUrl: 'https://gateway-testnets.noxprotocol.dev',
  smartContractAddress: '0x24ef36ec5b626d7dcd09a98f3083c2758f0f77bf',
  subgraphUrl:
    'https://thegraph.ethereum-sepolia-testnet.noxprotocol.io/api/subgraphs/id/9CsccKwvgYFo72zZeU4k4wj2NEBLdWhVE3EUandgmzgo',
} satisfies HandleClientConfig;

const sampleHandle = '0x0000000000000000000000000000000000000000000000000000000000000000' as Handle<'bool'>;
const sampleType: SolidityType = 'bool';
const sampleAcl: ACL = { isPublic: false, admins: [], viewers: [] };

const methodNames = [
  'encryptInput',
  'decrypt',
  'viewACL',
  'publicDecrypt',
] satisfies Array<keyof HandleClient>;

console.log(
  JSON.stringify(
    {
      package: '@iexec-nox/handle',
      exportedFactories,
      sepoliaConfig,
      sampleType,
      sampleHandleBytes: sampleHandle.length,
      sampleAcl,
      handleClientMethods: methodNames,
    },
    null,
    2,
  ),
);
