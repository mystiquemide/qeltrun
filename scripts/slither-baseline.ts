/**
 * Run Slither and compare its findings against an explicitly accepted baseline.
 *
 * `pnpm run audit:slither` prints the findings and exits non-zero, which is correct for a human
 * reading the output but useless in CI: a job that always fails tells you nothing. This wrapper
 * makes the *set* of findings the thing under test. It exits 0 only when Slither reports exactly
 * the findings recorded in `slither-baseline.json`, so a genuinely new finding fails the build
 * while the three accepted ones (recorded in this baseline) stay visible rather than suppressed.
 *
 * Removing a finding also fails, on purpose — it means the baseline is now claiming something
 * about the contract that is no longer true and should be pruned along with the code change.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';

const BASELINE = join(process.cwd(), 'slither-baseline.json');
const TARGET = 'contracts/QeltrunPayoutFirewall.sol';

type Finding = { check: string; id: string; description: string };

/// Slither needs a real solc binary. Hardhat has already downloaded the exact version the
/// contracts pin, so reuse it rather than adding solc-select to the toolchain.
function solcPath(): string {
  const matches = globSync(
    `${process.env.HOME}/.cache/hardhat-nodejs/compilers-v3/linux-amd64/solc-linux-amd64-v0.8.35*`,
  );
  const found = matches[0];
  if (found === undefined) {
    throw new Error('SOLC_NOT_FOUND: run `pnpm run compile` first so Hardhat downloads solc.');
  }
  return found;
}

function runSlither(): Finding[] {
  let raw: string;
  try {
    // Slither exits non-zero whenever it finds anything, so a throw here is expected.
    raw = execFileSync('slither', [TARGET, '--solc', solcPath(), '--json', '-'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout;
    if (stdout === undefined || stdout.trim() === '') throw error;
    raw = stdout;
  }

  const parsed = JSON.parse(raw) as {
    success: boolean;
    results?: { detectors?: Array<{ check: string; id: string; description: string }> };
  };

  return (parsed.results?.detectors ?? [])
    .map((d) => ({ check: d.check, id: d.id, description: d.description.trim().split('\n')[0] ?? '' }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

const findings = runSlither();

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify(findings, null, 2)}\n`, 'utf8');
  console.log(`Recorded ${findings.length} accepted finding(s) in slither-baseline.json.`);
  console.log('Every entry must be a reviewed, accepted finding before this is committed.');
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  throw new Error('NO_BASELINE: run `pnpm run audit:slither:update` and justify each finding.');
}

const accepted = JSON.parse(readFileSync(BASELINE, 'utf8')) as Finding[];
const acceptedIds = new Set(accepted.map((f) => f.id));
const currentIds = new Set(findings.map((f) => f.id));

const added = findings.filter((f) => !acceptedIds.has(f.id));
const removed = accepted.filter((f) => !currentIds.has(f.id));

for (const finding of accepted.filter((f) => currentIds.has(f.id))) {
  console.log(`accepted  ${finding.check}: ${finding.description}`);
}

if (added.length === 0 && removed.length === 0) {
  console.log(`\nSlither matches the accepted baseline (${accepted.length} finding(s)).`);
  process.exit(0);
}

for (const finding of added) {
  console.error(`\nNEW       ${finding.check}: ${finding.description}`);
}
for (const finding of removed) {
  console.error(`\nGONE      ${finding.check}: ${finding.description}`);
}

console.error(
  added.length > 0
    ? '\nA finding appeared that has not been reviewed. Analyse it, then either fix it or ' +
        'record it as accepted with `pnpm run audit:slither:update`.'
    : '\nA baseline finding no longer reproduces. Prune it with ' +
        '`pnpm run audit:slither:update`.',
);
process.exit(1);
