'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
  useWriteContract,
} from 'wagmi';

import { FIREWALL_V2_ABI } from '@qeltrun/abi';
import { signalTransportFor, type SealedSignal } from '@/lib/approvals';
import {
  DEFAULT_PROPOSED_WALLET,
  defaultChainId,
  deploymentFor,
  explorerTxUrl,
  isLocalChain,
  type Address,
  type Hex,
} from '@/lib/config';
import {
  roleFor,
  statusFrom,
  useAggregateHandle,
  useGate,
  useNoxComputeAddress,
  useOpenRequestId,
  usePaused,
  useRequest,
  useVendorView,
  useVerdictHandle,
  ROLE_LABELS,
} from '@/lib/use-firewall';
import { ActionLog, type LogEntry, type LogTone } from '@/components/action-log';
import { Button, Field, Mono, Note, Region, Tag, truncate } from './primitives';
import { Reviewers } from './reviewers';

const NONCE = 1n;
const ZERO_HANDLE = `0x${'0'.repeat(64)}` as Hex;

/// Copy for every gate verdict the contract can return, phrased the way an operator would want to
/// read it during an incident. `FIREWALL_PAUSED` is new in v2 and the old console had no entry
/// for it, so it would have rendered a bare reason code.
const GATE_COPY: Record<string, { headline: string; detail: string }> = {
  DESTINATION_UNCHANGED: {
    headline: 'Payout allowed',
    detail: 'This address is the one this vendor is currently cleared to be paid at.',
  },
  APPROVAL_REQUIRED: {
    headline: 'Payout blocked',
    detail:
      'This address is not the one the vendor is cleared for. Moving it takes three sealed reviewer positions and a settled verdict.',
  },
  VENDOR_NOT_REGISTERED: {
    headline: 'Payout blocked',
    detail: 'This vendor is not registered with the firewall, so no address is cleared.',
  },
  ZERO_DESTINATION: {
    headline: 'Payout blocked',
    detail: 'The destination is the zero address.',
  },
  FIREWALL_PAUSED: {
    headline: 'Payout blocked',
    detail: 'The firewall is halted. Nothing settles and no payment clears until it resumes.',
  },
};

export function Console() {
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  // Reading never needs a wallet. With one connected we follow its chain; otherwise we read the
  // configured deployment, so the console is live before anyone clicks connect.
  const activeChainId = isConnected && walletChainId !== undefined ? walletChainId : defaultChainId();
  const deployment = deploymentFor(activeChainId);
  const publicClient = usePublicClient({ chainId: deployment?.chainId });

  const PROPOSED = deployment?.proposedWallet ?? DEFAULT_PROPOSED_WALLET;

  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [sealed, setSealed] = useState<SealedSignal[]>([]);
  const [waiting, setWaiting] = useState<string | null>(null);

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
  const gate = useGate(deployment, PROPOSED);
  const noxCompute = useNoxComputeAddress(deployment);
  const { data: paused } = usePaused(deployment);

  const { data: requestId } = useDerivedRequestId(
    deployment,
    vendor?.payoutWallet,
    PROPOSED,
    address,
    NONCE,
    vendor?.approverEpoch,
  );
  const rid = requestId as Hex | undefined;

  const { data: request } = useRequest(deployment, rid);
  const { data: verdictHandle } = useVerdictHandle(deployment, rid);
  const { data: aggregateHandle } = useAggregateHandle(deployment, rid);

  const status = statusFrom((request as { status?: number } | undefined)?.status);
  const signalCount = Number((request as { signalCount?: number } | undefined)?.signalCount ?? 0);
  const [allowed, reason] = (gate.data as readonly [boolean, string] | undefined) ?? [false, ''];

  const role = roleFor(vendor, address);
  const transport = useMemo(
    () => signalTransportFor(deployment?.chainId, walletClient),
    [deployment?.chainId, walletClient],
  );

  const wrongChain = isConnected && deployment === undefined;

  useEffect(() => {
    if (deployment === undefined) return;
    append(
      `Reading chain ${deployment.chainId}, firewall ${truncate(deployment.firewall)}`,
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
        // Wallet rejections are a normal user action, not a failure worth shouting about.
        const rejected = /User rejected|user denied|4001/i.test(message);
        append(rejected ? 'Cancelled in wallet.' : message.split('\n')[0] ?? 'Action failed', rejected ? 'info' : 'error');
      } finally {
        setBusy(null);
        setWaiting(null);
      }
    },
    [append],
  );

  const txUrl = (hash: Hex) =>
    deployment === undefined ? undefined : explorerTxUrl(deployment.chainId, hash);

  const openRequest = () =>
    run('open', async () => {
      if (deployment === undefined) throw new Error('No deployment configured');
      append('Opening a destination change request');
      const hash = await writeContractAsync({
        abi: FIREWALL_V2_ABI,
        address: deployment.firewall,
        functionName: 'openChangeRequest',
        args: [deployment.demoVendor.vendorId, PROPOSED, NONCE],
        chainId: deployment.chainId,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      append('Request open. The gate has not moved.', 'info', txUrl(hash));
      await gate.refetch();
    });

  const submitSignal = (approve: boolean) =>
    run('signal', async () => {
      if (deployment === undefined || address === undefined) throw new Error('Connect a wallet');
      if (rid === undefined) throw new Error('No request to sign');

      append(`Sealing a private position through ${transport.label}`, 'nox');
      const s = await transport.sealSignal({
        reviewer: address,
        applicationContract: deployment.firewall,
        approve,
      });
      setSealed((prev) => [...prev.filter((p) => p.handle !== s.handle), s]);
      append(`Handle ${truncate(s.handle)} minted. Nobody can read it, including the contract.`, 'nox');

      const hash = await writeContractAsync({
        abi: FIREWALL_V2_ABI,
        address: deployment.firewall,
        functionName: 'submitPrivateSignal',
        args: [rid, s.handle, s.handleProof],
        chainId: deployment.chainId,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      append('Position sealed on chain.', 'nox', txUrl(hash));
      await gate.refetch();
    });

  const settle = () =>
    run('settle', async () => {
      if (deployment === undefined) throw new Error('No deployment configured');
      if (rid === undefined) throw new Error('No request to settle');
      const handle = verdictHandle as Hex | undefined;
      if (handle === undefined || handle === ZERO_HANDLE) {
        throw new Error('No verdict sealed yet. All three positions are needed first.');
      }

      append('Asking the gateway to decrypt the verdict', 'nox');
      const revealed = await transport.revealVerdict(
        handle,
        sealed.map((s) => s.handle),
        {
          onRetry: (attempt, attempts) => {
            // The gateway resolves ACL from a subgraph and computes confidentially, so it can
            // refuse for about a minute after sealing. Saying so beats looking frozen.
            setWaiting(`Waiting for the gateway to index the verdict, attempt ${attempt} of ${attempts}`);
          },
        },
      );
      setWaiting(null);
      append(`Gateway signed a decryption proof for ${String(revealed.value)}.`, 'nox');

      const hash = await writeContractAsync({
        abi: FIREWALL_V2_ABI,
        address: deployment.firewall,
        functionName: 'settleApproval',
        args: [rid, revealed.decryptionProof],
        chainId: deployment.chainId,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      append(
        revealed.value
          ? 'Settled. The payout address moved.'
          : 'Settled as refused. The payout address did not move.',
        revealed.value ? 'allowed' : 'blocked',
        txUrl(hash),
      );
      await gate.refetch();
    });

  const copy = GATE_COPY[reason] ?? {
    headline: allowed ? 'Payout allowed' : 'Payout blocked',
    detail: reason === '' ? 'Reading the gate.' : reason,
  };
  const accent = allowed ? 'var(--color-approved)' : 'var(--color-blocked)';
  const gatePending = gate.isLoading || deployment === undefined;

  const injected = connectors[0];
  const canSignal = role !== undefined && status === 'collecting' && busy === null;

  return (
    <main className="mx-auto max-w-[1240px] px-5 py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-[13px] text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">
            Qeltrun
          </Link>
          <h1 className="mt-1 text-[19px] font-semibold tracking-tight">Console</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {paused === true && <Tag tone="warning">halted</Tag>}
          {deployment !== undefined && (
            <Tag tone={isLocalChain(deployment.chainId) ? 'warning' : 'nox'}>
              {isLocalChain(deployment.chainId) ? 'local chain' : `chain ${deployment.chainId}`}
            </Tag>
          )}
          {role !== undefined && <Tag tone="approved">{ROLE_LABELS[role]}</Tag>}
          {isConnected && address !== undefined ? (
            <button
              type="button"
              onClick={() => disconnect()}
              className="ledger rounded-md border border-[var(--color-panel-border)] px-2.5 py-1.5 text-[12px] text-[var(--color-ink-dim)] hover:border-[var(--color-ink-muted)]"
            >
              {truncate(address, 6, 4)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => injected !== undefined && connect({ connector: injected })}
              disabled={injected === undefined}
              className="rounded-md border border-[var(--color-nox)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-nox)] hover:bg-[var(--color-nox)]/10 disabled:opacity-40"
            >
              Connect wallet
            </button>
          )}
        </div>
      </header>

      {wrongChain ? (
        <div className="rounded-md border border-[var(--color-warning)]/40 p-5">
          <p className="text-[14px] text-[var(--color-warning)]">
            No Qeltrun deployment on chain {activeChainId}.
          </p>
          <Note>
            Switch to a configured network to read the gate. Nothing here is simulated, so there is
            nothing to show for a chain the firewall is not on.
          </Note>
          <button
            type="button"
            onClick={() => switchChain({ chainId: defaultChainId() })}
            className="mt-4 rounded-md border border-[var(--color-nox)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-nox)] hover:bg-[var(--color-nox)]/10"
          >
            Switch network
          </button>
        </div>
      ) : deployment === undefined ? (
        <div className="rounded-md border border-[var(--color-panel-border)] p-5">
          <p className="text-[14px]">No deployment configured for chain {activeChainId}.</p>
          <Note>
            Run <span className="ledger">pnpm run node</span> and{' '}
            <span className="ledger">pnpm run setup:local</span> for a local chain, or set{' '}
            <span className="ledger">NEXT_PUBLIC_SEPOLIA_FIREWALL_V2</span>.
          </Note>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
          {/* Left: who is being paid, and by whose authority */}
          <div className="space-y-10">
            <Region title="Vendor">
              <Field label="Name">
                <Mono value={deployment.demoVendor.label} />
              </Field>
              <Field label="Cleared address" emphasis>
                <Mono
                  value={vendor === undefined ? 'reading' : truncate(vendor.payoutWallet, 10, 8)}
                  title={vendor?.payoutWallet}
                />
              </Field>
              <Field label="Registered">
                <span className="text-[13px]">
                  {vendorLoading ? 'reading' : vendor?.registered === true ? 'yes' : 'no'}
                </span>
              </Field>
              <Field label="Approver epoch">
                <Mono value={vendor === undefined ? 'reading' : String(vendor.approverEpoch)} />
              </Field>
            </Region>

            <Region
              title="Reviewers"
              aside={
                <span className="ledger text-[11px] text-[var(--color-ink-muted)]">
                  {rid === undefined ? '' : `${signalCount} of 3`}
                </span>
              }
            >
              <Reviewers
                deployment={deployment}
                vendor={vendor}
                requestId={rid}
                connected={address}
                connectedRole={role}
              />
              {isConnected && role === undefined && (
                <Note>
                  This wallet holds none of the three seats, so it cannot seal a position. It can
                  still open a request and settle one, because settlement is permissionless.
                </Note>
              )}
            </Region>
          </div>

          {/* Centre: the verdict and the actions */}
          <div className="space-y-10">
            <section
              className="rounded-md border p-6"
              style={{ borderColor: gatePending ? 'var(--color-panel-border)' : accent }}
              aria-live="polite"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2 w-2 rounded-full ${gatePending ? 'pulse-live' : ''}`}
                  style={{ background: gatePending ? 'var(--color-ink-muted)' : accent }}
                />
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-dim)]">
                  Payout gate
                </span>
              </div>

              <p
                className="mt-3 text-[26px] font-semibold leading-tight tracking-tight"
                style={{ color: gatePending ? 'var(--color-ink-muted)' : accent }}
              >
                {gatePending ? 'Reading gate' : copy.headline}
              </p>
              <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-[var(--color-ink-dim)]">
                {copy.detail}
              </p>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-[var(--color-divider)] pt-3">
                <span className="text-[12px] text-[var(--color-ink-muted)]">Address tested</span>
                <Mono value={truncate(PROPOSED, 12, 8)} title={PROPOSED} />
                <span className="ledger text-[11px] text-[var(--color-ink-muted)]">{reason}</span>
              </div>
            </section>

            <Region title="Actions">
              <div className="space-y-2.5">
                <Button
                  onClick={openRequest}
                  busy={busy === 'open'}
                  disabled={!isConnected || status !== 'none' || busy !== null || paused === true}
                >
                  Request the change
                </Button>

                <div className="grid grid-cols-2 gap-2.5">
                  <Button onClick={() => submitSignal(true)} busy={busy === 'signal'} disabled={!canSignal} tone="primary">
                    Seal approve
                  </Button>
                  <Button onClick={() => submitSignal(false)} busy={busy === 'signal'} disabled={!canSignal}>
                    Seal refuse
                  </Button>
                </div>

                <Button
                  onClick={settle}
                  busy={busy === 'settle'}
                  disabled={status !== 'sealed' || busy !== null || paused === true}
                  tone="primary"
                >
                  Reveal and settle
                </Button>
              </div>

              {waiting !== null && (
                <p className="mt-3 text-[12px] text-[var(--color-nox)]">{waiting}</p>
              )}

              {paused === true && (
                <Note>
                  The firewall is halted, so opening and settling are both refused on chain. This is
                  the owner stopping the system, and it still cannot approve anything.
                </Note>
              )}

              {!isConnected && (
                <Note>
                  Reading live chain state without a wallet. Connect one of the three reviewers to
                  seal a position.
                </Note>
              )}

              {isConnected && status === 'collecting' && role === undefined && (
                <Note>
                  Only the three reviewers above can seal a position on this request. Any other
                  wallet is refused on chain.
                </Note>
              )}
            </Region>
          </div>

          {/* Right: the Nox evidence and the log */}
          <div className="space-y-10">
            <Region
              title="Nox evidence"
              aside={
                <Tag tone="nox">{isLocalChain(deployment.chainId) ? 'local gateway' : 'iExec Nox'}</Tag>
              }
            >
              <Field label="NoxCompute">
                <Mono
                  value={truncate((noxCompute.data as string | undefined) ?? deployment.noxCompute, 10, 6)}
                  title={(noxCompute.data as string | undefined) ?? deployment.noxCompute}
                />
              </Field>
              <Field label="Positions sealed">
                <Mono value={rid === undefined ? 'needs a wallet' : `${signalCount} of 3`} />
              </Field>
              <Field label="Aggregate">
                <span className="ledger text-[13px] text-[var(--color-ink-dim)]">
                  {handleState(rid, aggregateHandle as Hex | undefined, 'sealed')}
                </span>
              </Field>
              <Field label="Verdict">
                <span
                  className="ledger text-[13px]"
                  style={{
                    color:
                      isSet(verdictHandle as Hex | undefined)
                        ? 'var(--color-nox)'
                        : 'var(--color-ink-dim)',
                  }}
                >
                  {handleState(rid, verdictHandle as Hex | undefined, 'public')}
                </span>
              </Field>

              <p className="mt-4 border-t border-[var(--color-divider)] pt-3 text-[12px] leading-relaxed text-[var(--color-ink-dim)]">
                Each position is encrypted to the contract. It adds them up without being able to
                read them, and makes only the final verdict decryptable.
              </p>
            </Region>

            <Region title="Activity">
              <ActionLog entries={log} />
            </Region>
          </div>
        </div>
      )}
    </main>
  );
}

function isSet(handle: Hex | undefined): boolean {
  return handle !== undefined && handle !== ZERO_HANDLE;
}

/**
 * Handles read as `not yet` until they exist, then as their truncated value.
 *
 * Without a request id there is nothing to look up, so this says so rather than `reading`.
 * Reporting a permanent unknown as a temporary one is the same mistake the v1 console avoided
 * for request ids, and it says the console is busy when it is actually just uninformed.
 */
function handleState(requestId: Hex | undefined, handle: Hex | undefined, when: string): string {
  if (requestId === undefined) return 'needs a wallet';
  if (handle === undefined) return 'reading';
  if (handle === ZERO_HANDLE) return 'not yet';
  return `${truncate(handle, 8, 6)} ${when}`;
}
