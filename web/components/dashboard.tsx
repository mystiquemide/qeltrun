'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect, usePublicClient, useWalletClient, useWriteContract } from 'wagmi';

import { ActionLog, type LogEntry, type LogTone } from './action-log';
import { GateCard, type GateReason } from './gate-card';
import { StateRail, type RailStep } from './state-rail';
import { Button, Field, Mono, Panel, Tag, truncate } from './primitives';
import { approvalTransportFor, type SealedApproval } from '@/lib/approvals';
import {
  deploymentFor,
  deployments,
  explorerAddressUrl,
  explorerTxUrl,
  hardhatLocal,
  isLocalChain,
  type Address,
  type Hex,
  type SupportedChainId,
} from '@/lib/config';
import { FIREWALL_ABI } from '@/lib/firewall-abi';
import {
  statusFrom,
  useDerivedRequestId,
  useGate,
  useNoxComputeAddress,
  useRequest,
  useVendorView,
} from '@/lib/use-firewall';

/// The destination the demo tries to pay. Deliberately not the vendor's registered wallet:
/// this is the address an attacker would have put on a fraudulent invoice.
const PROPOSED_WALLET = '0x2222222222222222222222222222222222222222' as Address;
const NONCE = 1n;

const DEFAULT_CHAIN_ID = Number(Object.keys(deployments)[0] ?? hardhatLocal.id) as SupportedChainId;

export function Dashboard() {
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  // Reading never needs a wallet. When one is connected we follow its chain; otherwise we read
  // whichever deployment is configured, so the dashboard is live before anyone clicks connect.
  const activeChainId = isConnected && walletChainId !== undefined ? walletChainId : DEFAULT_CHAIN_ID;
  const deployment = deploymentFor(activeChainId);
  const publicClient = usePublicClient({ chainId: deployment?.chainId });

  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [sealed, setSealed] = useState<SealedApproval | null>(null);

  const append = useCallback((text: string, tone: LogTone = 'info', href?: string) => {
    setLog((entries) => [
      ...entries,
      {
        id: entries.length,
        at: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        text,
        tone,
        ...(href !== undefined ? { href } : {}),
      },
    ]);
  }, []);

  const { vendor, isLoading: vendorLoading } = useVendorView(deployment);
  const gate = useGate(deployment, PROPOSED_WALLET);
  const noxCompute = useNoxComputeAddress(deployment);

  const { data: requestId } = useDerivedRequestId(
    deployment,
    vendor?.payoutWallet,
    PROPOSED_WALLET,
    address,
    NONCE,
  );
  const { data: request } = useRequest(deployment, requestId as Hex | undefined);
  const status = statusFrom((request as { status?: bigint } | undefined)?.status);

  const [allowed, reason] = (gate.data as readonly [boolean, string] | undefined) ?? [false, ''];
  const isApprover =
    address !== undefined &&
    vendor !== undefined &&
    address.toLowerCase() === vendor.approver.toLowerCase();
  const destinationCleared =
    vendor !== undefined && vendor.payoutWallet.toLowerCase() === PROPOSED_WALLET.toLowerCase();

  const transport = useMemo(
    () => approvalTransportFor(deployment?.chainId, walletClient),
    [deployment?.chainId, walletClient],
  );

  useEffect(() => {
    if (deployment === undefined) return;
    append(
      `Connected to ${isLocalChain(deployment.chainId) ? 'local Hardhat chain' : `chain ${deployment.chainId}`}, firewall ${truncate(deployment.firewall)}`,
    );
    // Deployment identity is stable for a session; this is a one-shot banner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployment?.firewall]);

  const run = useCallback(
    async (key: string, task: () => Promise<void>) => {
      setBusy(key);
      try {
        await task();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        append(message.split('\n')[0] ?? 'Action failed', 'error');
      } finally {
        setBusy(null);
      }
    },
    [append],
  );

  const txUrl = (hash: Hex) =>
    deployment === undefined ? undefined : explorerTxUrl(deployment.chainId, hash);

  const openRequest = () =>
    run('open', async () => {
      if (deployment === undefined) throw new Error('No deployment configured');
      append('Opening change request…');
      const hash = await writeContractAsync({
        abi: FIREWALL_ABI,
        address: deployment.firewall,
        functionName: 'openChangeRequest',
        args: [deployment.demoVendor.vendorId, PROPOSED_WALLET, NONCE],
        chainId: deployment.chainId,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      append('Change request opened. The gate does not move.', 'info', txUrl(hash));
      await gate.refetch();
    });

  const sealApproval = () =>
    run('seal', async () => {
      if (deployment === undefined || address === undefined) throw new Error('Connect a wallet');
      append(`Sealing approval through ${transport.label}…`, 'nox');

      // The handle must be minted for this contract and for the wallet that will send the
      // transaction; NoxCompute checks both against the firewall's `msg.sender`.
      const approval = await transport.seal({
        approver: address,
        applicationContract: deployment.firewall,
        approve: true,
      });
      setSealed(approval);
      append(`Handle ${truncate(approval.handle)} minted with a 137-byte input proof.`, 'nox');

      const hash = await writeContractAsync({
        abi: FIREWALL_ABI,
        address: deployment.firewall,
        functionName: 'sealApproval',
        args: [requestId as Hex, approval.handle, approval.handleProof],
        chainId: deployment.chainId,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      append('Approval sealed on chain. The bit is still opaque.', 'nox', txUrl(hash));
      await gate.refetch();
    });

  const settleApproval = () =>
    run('settle', async () => {
      if (deployment === undefined) throw new Error('No deployment configured');
      const handle =
        sealed?.handle ?? ((request as { sealedApproval?: Hex } | undefined)?.sealedApproval as Hex);
      if (handle === undefined) throw new Error('Nothing sealed for this request');

      append('Requesting a gateway-signed decryption proof…', 'nox');
      const revealed = await transport.reveal(handle);
      append(`Gateway signed a decryption proof for ${String(revealed.value)}.`, 'nox');

      const hash = await writeContractAsync({
        abi: FIREWALL_ABI,
        address: deployment.firewall,
        functionName: 'settleApproval',
        args: [requestId as Hex, revealed.decryptionProof],
        chainId: deployment.chainId,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      append(
        revealed.value
          ? 'Approval settled. Payout destination moved.'
          : 'Approval settled as rejected. Destination unchanged.',
        revealed.value ? 'allowed' : 'blocked',
        txUrl(hash),
      );
      await gate.refetch();
    });

  const steps: RailStep[] = [
    {
      label: 'Vendor registered',
      detail: vendor?.registered === true ? deployment?.demoVendor.label ?? '' : 'Not registered',
      status: vendor?.registered === true ? 'done' : 'pending',
    },
    {
      label: 'Destination change requested',
      detail:
        status === 'none' ? 'No request open for this destination' : 'Recorded on chain, gate unchanged',
      status: status === 'none' ? 'active' : 'done',
    },
    {
      label: 'Approval sealed inside the TEE',
      detail:
        status === 'sealed' || status === 'settled'
          ? 'Contract holds a Nox handle it cannot read'
          : 'Awaiting the registered approver',
      status: status === 'sealed' || status === 'settled' ? 'done' : status === 'pending' ? 'active' : 'pending',
    },
    {
      label: 'Payout attempted before approval',
      detail: allowed ? 'Passed once the destination cleared' : 'Blocked — APPROVAL_REQUIRED',
      status: allowed ? 'done' : 'blocked',
    },
    {
      label: 'Approval revealed by gateway proof',
      detail:
        status === 'settled'
          ? 'Decryption proof verified on chain'
          : 'Awaiting a gateway-signed decryption proof',
      status: status === 'settled' ? 'done' : status === 'sealed' ? 'active' : 'pending',
    },
    {
      label: 'Payout allowed',
      detail: destinationCleared ? 'Destination is now the vendor’s payout wallet' : 'Not yet cleared',
      status: destinationCleared ? 'done' : 'pending',
    },
  ];

  const injected = connectors[0];

  return (
    <main className="mx-auto max-w-[1240px] px-5 py-8">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">Qeltrun</h1>
          <p className="mt-0.5 text-[13px] text-[var(--color-ink-dim)]">
            Before funds move, prove the change.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {deployment !== undefined && (
            <Tag tone={isLocalChain(deployment.chainId) ? 'warning' : 'nox'}>
              {isLocalChain(deployment.chainId) ? 'Local chain' : `Chain ${deployment.chainId}`}
            </Tag>
          )}
          {isConnected && address !== undefined ? (
            <button
              type="button"
              onClick={() => disconnect()}
              className="ledger rounded border border-[var(--color-panel-border)] px-2.5 py-1.5 text-[12px] text-[var(--color-ink-dim)] hover:border-[var(--color-ink-muted)]"
            >
              {truncate(address, 6, 4)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => injected !== undefined && connect({ connector: injected })}
              disabled={injected === undefined}
              className="rounded border border-[var(--color-nox)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-nox)] hover:bg-[var(--color-nox)]/10 disabled:opacity-40"
            >
              Connect wallet
            </button>
          )}
        </div>
      </header>

      {deployment === undefined ? (
        <Panel title="Not configured">
          <p className="text-[13px] leading-relaxed text-[var(--color-ink-dim)]">
            No firewall deployment is configured for chain {activeChainId}. Run{' '}
            <span className="ledger">pnpm run node</span> and{' '}
            <span className="ledger">pnpm run setup:local</span> for the local chain, or set{' '}
            <span className="ledger">NEXT_PUBLIC_SEPOLIA_FIREWALL</span> for Sepolia.
          </p>
        </Panel>
      ) : (
        <>
          {!isConnected && (
            <p className="mb-4 text-[12px] text-[var(--color-ink-muted)]">
              Reading live on-chain state without a wallet. Connect the registered approver to seal
              an approval.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
            {/* Left: who is being paid, and by whose authority */}
            <div className="space-y-4">
              <Panel title="Vendor record">
                <Field label="Vendor">
                  <Mono value={deployment.demoVendor.label} />
                </Field>
                <Field label="Vendor id">
                  <Mono value={truncate(deployment.demoVendor.vendorId)} title={deployment.demoVendor.vendorId} />
                </Field>
                <Field label="Payout wallet" emphasis>
                  <Mono
                    value={truncate(vendor?.payoutWallet ?? '—', 12, 8)}
                    title={vendor?.payoutWallet}
                  />
                </Field>
                <Field label="Approver">
                  <Mono value={truncate(vendor?.approver ?? '—', 12, 8)} title={vendor?.approver} />
                </Field>
                <Field label="Registered">
                  <span className="text-[13px]">
                    {vendorLoading ? '…' : vendor?.registered === true ? 'yes' : 'no'}
                  </span>
                </Field>
              </Panel>

              <Panel title="Requested change">
                <Field label="Proposed wallet">
                  <Mono value={truncate(PROPOSED_WALLET, 12, 8)} title={PROPOSED_WALLET} />
                </Field>
                <Field label="Nonce">
                  <Mono value={String(NONCE)} />
                </Field>
                <Field label="Request id">
                  <Mono
                    value={requestId === undefined ? '—' : truncate(requestId as string)}
                    title={requestId as string | undefined}
                  />
                </Field>
                <Field label="Status">
                  <span className="ledger text-[13px]">{status}</span>
                </Field>
              </Panel>
            </div>

            {/* Centre: the verdict and how we got here */}
            <div className="space-y-4">
              <GateCard
                allowed={allowed}
                reason={reason as GateReason}
                destination={PROPOSED_WALLET}
                pending={gate.isLoading}
              />

              <Panel title="State rail">
                <StateRail steps={steps} />
              </Panel>

              <div className="grid gap-2.5 sm:grid-cols-3">
                <Button
                  onClick={openRequest}
                  busy={busy === 'open'}
                  disabled={!isConnected || status !== 'none' || busy !== null}
                >
                  Request change
                </Button>
                <Button
                  onClick={sealApproval}
                  busy={busy === 'seal'}
                  disabled={!isApprover || status !== 'pending' || busy !== null}
                  tone="primary"
                >
                  Seal approval
                </Button>
                <Button
                  onClick={settleApproval}
                  busy={busy === 'settle'}
                  disabled={status !== 'sealed' || busy !== null}
                  tone="primary"
                >
                  Reveal &amp; settle
                </Button>
              </div>

              {isConnected && !isApprover && status === 'pending' && (
                <p className="text-[12px] text-[var(--color-ink-muted)]">
                  Only {truncate(vendor?.approver ?? '', 10, 6)} can seal this vendor’s approvals.
                  Any other wallet is rejected on chain.
                </p>
              )}
            </div>

            {/* Right: the Nox evidence a reviewer would want to check */}
            <div className="space-y-4">
              <Panel
                title="Nox evidence"
                aside={<Tag tone="nox">{isLocalChain(deployment.chainId) ? 'Local gateway' : 'iExec Nox'}</Tag>}
              >
                <Field label="NoxCompute">
                  <Mono
                    value={truncate((noxCompute.data as string | undefined) ?? deployment.noxCompute, 12, 8)}
                    title={(noxCompute.data as string | undefined) ?? deployment.noxCompute}
                  />
                </Field>
                <Field label="Sealed handle">
                  <Mono
                    value={
                      sealed?.handle !== undefined
                        ? truncate(sealed.handle)
                        : status === 'sealed' || status === 'settled'
                          ? truncate(((request as { sealedApproval?: string } | undefined)?.sealedApproval ?? '—'))
                          : '—'
                    }
                    title={sealed?.handle}
                  />
                </Field>
                <Field label="Input proof">
                  <span className="ledger text-[13px]">
                    {sealed?.handleProof === undefined
                      ? '—'
                      : `${(sealed.handleProof.length - 2) / 2} bytes`}
                  </span>
                </Field>
                <Field label="Handle ACL">
                  <span className="text-[13px] text-[var(--color-ink-dim)]">
                    {status === 'sealed' || status === 'settled'
                      ? 'contract + approver, publicly decryptable'
                      : '—'}
                  </span>
                </Field>

                <p className="mt-3 border-t hairline pt-3 text-[12px] leading-relaxed text-[var(--color-ink-dim)]">
                  Nox is TEE-based confidential computing on Intel TDX. The contract stores a handle
                  it cannot read; only a gateway-signed decryption proof turns that handle into a
                  decision the gate acts on.
                </p>

                {explorerAddressUrl(deployment.chainId, deployment.firewall) !== undefined && (
                  <a
                    href={explorerAddressUrl(deployment.chainId, deployment.firewall)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-[12px] text-[var(--color-nox)] underline underline-offset-2"
                  >
                    Firewall on Etherscan
                  </a>
                )}
              </Panel>

              <Panel title="Action log">
                <ActionLog entries={log} />
              </Panel>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
