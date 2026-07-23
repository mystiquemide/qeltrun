/**
 * The documentation tree.
 *
 * Grouped by the four Diátaxis categories: tutorials teach, how-to guides solve a task, reference
 * describes exact surfaces, and explanation builds understanding. The sidebar and the docs index
 * both read this one list, so they cannot fall out of step.
 */
export type DocsLink = { label: string; href: string };
export type DocsGroup = { title: string; kind: string; links: DocsLink[] };

export const DOCS_TREE: DocsGroup[] = [
  {
    title: 'Get started',
    kind: 'Tutorial',
    links: [
      { label: 'Overview', href: '/docs' },
      { label: 'Quickstart', href: '/docs/quickstart' },
      { label: 'Local development', href: '/docs/local-development' },
    ],
  },
  {
    title: 'Guides',
    kind: 'How-to',
    links: [
      { label: 'Deploy to Sepolia', href: '/docs/deploy-sepolia' },
      { label: 'Run the three-reviewer flow', href: '/docs/reviewer-flow' },
    ],
  },
  {
    title: 'Reference',
    kind: 'Reference',
    links: [
      { label: 'Firewall contract', href: '/docs/contracts' },
      { label: 'CLI commands', href: '/docs/cli' },
      { label: 'Configuration', href: '/docs/configuration' },
    ],
  },
  {
    title: 'Concepts',
    kind: 'Explanation',
    links: [
      { label: 'Confidential approval', href: '/docs/confidential-model' },
      { label: 'Architecture', href: '/docs/architecture' },
    ],
  },
];
