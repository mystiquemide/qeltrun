/**
 * Verify the test counts quoted in the docs against the test sources.
 *
 * Numbers written by hand into prose drift the moment a test is added, and a doc that quietly
 * misstates its own coverage is the kind of small inaccuracy that makes a reviewer distrust the
 * larger claims around it. This counts the declarations and fails if any doc disagrees, so the
 * numbers are checked rather than trusted.
 *
 * Run by `pnpm run verify` and in CI.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

/// Solidity test entry points: forge runs `test*` functions, plus `invariant*` for invariant
/// runs. Helper functions and the handler contract's actions are deliberately excluded.
function countSolidityTests(file: string): number {
  const source = readFileSync(file, 'utf8');
  return (source.match(/^\s*function\s+(test|invariant)[A-Za-z0-9_]*\s*\(/gm) ?? []).length;
}

function countVitestTests(file: string): number {
  const source = readFileSync(file, 'utf8');
  return (source.match(/^\s*it\(/gm) ?? []).length;
}

const solidityFiles = globSync('test/solidity/*.t.sol', { cwd: root }).sort();
const vitestFiles = globSync('test/*.test.ts', { cwd: root }).sort();

const solidityCounts = new Map(solidityFiles.map((f) => [f, countSolidityTests(join(root, f))]));
const vitestTotal = vitestFiles.reduce((sum, f) => sum + countVitestTests(join(root, f)), 0);
const solidityTotal = [...solidityCounts.values()].reduce((sum, n) => sum + n, 0);

type Expectation = { doc: string; label: string; pattern: RegExp; expected: number };

const expectations: Expectation[] = [
  ...solidityFiles.map((file) => ({
    doc: 'README.md',
    label: file,
    // Matches the row `| `test/solidity/X.t.sol` | 19 | ... |`
    pattern: new RegExp(`\\|\\s*\`${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\`\\s*\\|\\s*(\\d+)\\s*\\|`),
    expected: solidityCounts.get(file) ?? 0,
  })),
  {
    doc: 'README.md',
    label: 'test/*.test.ts',
    pattern: /\|\s*`test\/\*\.test\.ts`\s*\|\s*(\d+)\s*\|/,
    expected: vitestTotal,
  },
  {
    doc: 'docs/TASKS.md',
    label: 'vitest total',
    pattern: /(\d+) vitest and \d+ Solidity tests are green/,
    expected: vitestTotal,
  },
  {
    doc: 'docs/TASKS.md',
    label: 'Solidity total',
    pattern: /\d+ vitest and (\d+) Solidity tests are green/,
    expected: solidityTotal,
  },
  {
    doc: 'docs/AUDIT.md',
    label: 'attack matrix',
    pattern: /QeltrunPayoutFirewall\.attack\.t\.sol`, (\d+) tests/,
    expected: solidityCounts.get('test/solidity/QeltrunPayoutFirewall.attack.t.sol') ?? 0,
  },
];

const sources = new Map<string, string>();
const failures: string[] = [];

for (const { doc, label, pattern, expected } of expectations) {
  let text = sources.get(doc);
  if (text === undefined) {
    text = readFileSync(join(root, doc), 'utf8');
    sources.set(doc, text);
  }

  const match = text.match(pattern);
  if (match === null) {
    failures.push(`${doc}: could not find the count for ${label}. Has the wording changed?`);
    continue;
  }

  const claimed = Number(match[1]);
  if (claimed !== expected) {
    failures.push(`${doc}: ${label} claims ${claimed}, sources have ${expected}.`);
  }
}

console.log(`Solidity tests: ${solidityTotal} across ${solidityFiles.length} file(s)`);
for (const [file, count] of solidityCounts) console.log(`  ${count.toString().padStart(3)}  ${file}`);
console.log(`Vitest tests:   ${vitestTotal} across ${vitestFiles.length} file(s)`);

if (failures.length > 0) {
  console.error('\nDocumented test counts are out of date:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('\nAll documented test counts match the sources.');
