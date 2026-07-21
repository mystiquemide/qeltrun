import { execFileSync } from 'node:child_process';
import { existsSync, globSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASELINE = join(process.cwd(), 'slither-v2-baseline.json');
const TARGETS = [
  'contracts/QeltrunPayoutFirewallV2.sol',
  'contracts/integrations/QeltrunSafePayoutModule.sol',
];

type Finding = { target: string; check: string; id: string; description: string };

function solcPath(): string {
  const [found] = globSync(
    `${process.env.HOME}/.cache/hardhat-nodejs/compilers-v3/linux-amd64/solc-linux-amd64-v0.8.35*`,
  );
  if (found === undefined) throw new Error('SOLC_NOT_FOUND: run `pnpm run compile`.');
  return found;
}

function scan(target: string): Finding[] {
  let raw: string;
  try {
    raw = execFileSync('slither', [target, '--solc', solcPath(), '--json', '-'], {
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
    results?: { detectors?: Array<{ check: string; id: string; description: string }> };
  };
  return (parsed.results?.detectors ?? []).map((finding) => ({
    target,
    check: finding.check,
    id: finding.id,
    description: finding.description.trim().split('\n')[0] ?? '',
  }));
}

const findings = TARGETS.flatMap(scan).sort((a, b) => a.id.localeCompare(b.id));

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify(findings, null, 2)}\n`, 'utf8');
  console.log(`Recorded ${findings.length} reviewed v2 finding(s).`);
  process.exit(0);
}

if (!existsSync(BASELINE)) throw new Error('NO_V2_BASELINE: run the update command after review.');
const accepted = JSON.parse(readFileSync(BASELINE, 'utf8')) as Finding[];
const acceptedIds = new Set(accepted.map(({ id }) => id));
const currentIds = new Set(findings.map(({ id }) => id));
const added = findings.filter(({ id }) => !acceptedIds.has(id));
const removed = accepted.filter(({ id }) => !currentIds.has(id));

for (const finding of accepted.filter(({ id }) => currentIds.has(id))) {
  console.log(`accepted  ${finding.check}: ${finding.description}`);
}
if (added.length === 0 && removed.length === 0) {
  console.log(`Slither matches the v2 baseline (${accepted.length} finding(s)).`);
  process.exit(0);
}
for (const finding of added) console.error(`NEW   ${finding.check}: ${finding.description}`);
for (const finding of removed) console.error(`GONE  ${finding.check}: ${finding.description}`);
process.exit(1);
