import type { BaseContract, ContractTransactionResponse } from 'ethers';

import type { Address, Hex } from '../domain/types.js';

export interface FirewallV2Contract extends BaseContract {
  registerVendor(
    vendorId: Hex,
    payoutWallet: Address,
    approver: Address,
    treasuryReviewer: Address,
    riskReviewer: Address,
  ): Promise<ContractTransactionResponse>;
  noxComputeAddress(): Promise<string>;
  owner(): Promise<string>;
  transferOwnership(nextOwner: Address): Promise<ContractTransactionResponse>;
}

export function asFirewallV2(contract: BaseContract): FirewallV2Contract {
  return contract as unknown as FirewallV2Contract;
}
