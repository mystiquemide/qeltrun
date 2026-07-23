'use client';

import { useState } from 'react';
import type { WalletClient } from 'viem';

import type { Address, Deployment } from '@/lib/config';
import { registerVendorViaSafe } from '@/lib/safe-admin';
import { Button, Field, Note, Region } from './primitives';

/**
 * The Treasury Safe's own admin surface: registering a vendor.
 *
 * `registerVendor` is owner-only on chain, so this panel only ever renders for a wallet the
 * console has already confirmed is a Safe owner (`useIsSafeOwner`, checked by the caller). The
 * form can never register a vendor for anyone else - it only ever signs as the connected wallet,
 * and the contract enforces the rest. This replaces running `scripts/setup-demo-vendor-sepolia.ts`
 * by hand: the same action, from the browser, without a terminal or an exported private key.
 */
export function AdminPanel({
  deployment,
  walletClient,
  onRegistered,
}: {
  deployment: Deployment;
  walletClient: WalletClient | undefined;
  onRegistered: () => void;
}) {
  const [label, setLabel] = useState('');
  const [payoutWallet, setPayoutWallet] = useState('');
  const [approver, setApprover] = useState('');
  const [treasuryReviewer, setTreasuryReviewer] = useState('');
  const [riskReviewer, setRiskReviewer] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const safeAddress = deployment.treasurySafe;
  const canSubmit =
    safeAddress !== undefined &&
    walletClient !== undefined &&
    label.trim() !== '' &&
    isAddress(payoutWallet) &&
    isAddress(approver) &&
    isAddress(treasuryReviewer) &&
    isAddress(riskReviewer) &&
    !busy;

  const submit = async () => {
    if (safeAddress === undefined || walletClient === undefined) return;
    setBusy(true);
    setResult(null);
    try {
      const hash = await registerVendorViaSafe({
        safeAddress,
        firewallAddress: deployment.firewall,
        vendorLabel: label.trim(),
        payoutWallet: payoutWallet as Address,
        approver: approver as Address,
        treasuryReviewer: treasuryReviewer as Address,
        riskReviewer: riskReviewer as Address,
        walletClient,
      });
      setResult({ tone: 'ok', text: `Registered. ${hash}` });
      setLabel('');
      setPayoutWallet('');
      setApprover('');
      setTreasuryReviewer('');
      setRiskReviewer('');
      onRegistered();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResult({ tone: 'error', text: message.split('\n')[0] ?? 'Registration failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Region
      title="Treasury admin"
      aside={
        <span className="rounded border border-[var(--color-nox)]/40 bg-[var(--color-nox)]/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-nox)]">
          Safe owner
        </span>
      }
    >
      <Note>
        This wallet owns the Treasury Safe, so it can register a new vendor directly - the same
        action <code className="ledger">scripts/setup-demo-vendor-sepolia.ts</code> performs from
        a terminal, run here as a Safe transaction instead.
      </Note>

      <div className="mt-3 space-y-2.5">
        <TextField label="Vendor label" value={label} onChange={setLabel} placeholder="vendor:acme-logistics" />
        <TextField label="Payout wallet" value={payoutWallet} onChange={setPayoutWallet} placeholder="0x..." mono />
        <TextField label="Approver" value={approver} onChange={setApprover} placeholder="0x..." mono />
        <TextField
          label="Treasury reviewer"
          value={treasuryReviewer}
          onChange={setTreasuryReviewer}
          placeholder="0x..."
          mono
        />
        <TextField label="Risk reviewer" value={riskReviewer} onChange={setRiskReviewer} placeholder="0x..." mono />
      </div>

      <div className="mt-3">
        <Button onClick={submit} busy={busy} disabled={!canSubmit} tone="primary">
          Register vendor
        </Button>
      </div>

      {result !== null && (
        <Note>
          <span style={{ color: result.tone === 'ok' ? 'var(--color-approved)' : 'var(--color-blocked)' }}>
            {result.text}
          </span>
        </Note>
      )}
    </Region>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  mono?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className={`w-full max-w-[260px] rounded border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-2 py-1 text-right text-[12px] text-[var(--color-ink)] outline-none focus:border-[var(--color-nox)] ${mono ? 'tnum' : ''}`}
      />
    </Field>
  );
}

function isAddress(value: string): value is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}
