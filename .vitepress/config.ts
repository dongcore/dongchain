import { defineConfig } from 'vitepress'

export default defineConfig({
  // Site metadata
  title: 'Dong Chain',
  description: 'Multi-task Layer-1 Blockchain for RWA & Gaming Digital Assets — Bitcoin-secured · RISC-V powered · EVM compatible',
  lang: 'en-US',

  // Custom domain: dongcore.com
  base: '/',

  // Head tags
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#f97316' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Dong Chain Docs' }],
    ['meta', { property: 'og:title', content: 'Dong Chain — Bitcoin-secured RISC-V Blockchain' }],
    ['meta', { property: 'og:description', content: 'Technical documentation for Dong Chain: RWA tokenization, gaming asset sovereignty, and cross-chain liquidity.' }],
    ['meta', { property: 'og:image', content: 'https://dongcore.com/og-image.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],

  // Theme configuration
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Dong Chain',

    // ── Top Navigation ──────────────────────────────────────────────────────
    nav: [
      { text: 'Home', link: '/' },
      {
        text: 'Architecture',
        link: '/docs/architecture/00-overview',
        activeMatch: '/docs/architecture/',
      },
      {
        text: 'Get Started',
        link: '/docs/getting-started/01-prerequisites',
        activeMatch: '/docs/getting-started/',
      },
      {
        text: 'Yellow Paper',
        link: '/yellow-paper/dong-chain-yellow-paper',
      },
      {
        text: 'Specs',
        items: [
          { text: 'PRD', link: '/specs/prd' },
          { text: 'SRS', link: '/specs/srs' },
        ],
      },
      {
        text: 'GitHub',
        link: 'https://github.com/dongcore/dongchain',
        target: '_blank',
      },
    ],

    // ── Sidebar ─────────────────────────────────────────────────────────────
    sidebar: {
      '/yellow-paper/': [
        {
          text: 'Yellow Paper',
          items: [
            { text: 'Full Specification', link: '/yellow-paper/dong-chain-yellow-paper' },
          ],
        },
      ],

      '/specs/': [
        {
          text: 'Specifications',
          items: [
            { text: 'Product Requirements (PRD)', link: '/specs/prd' },
            { text: 'Software Requirements (SRS)', link: '/specs/srs' },
          ],
        },
      ],

      '/docs/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'System Overview', link: '/docs/architecture/00-overview' },
            { text: 'Layer 0 — Bitcoin & OmniCore', link: '/docs/architecture/01-layer0-bitcoin' },
            { text: 'BitVM2 Bridge', link: '/docs/architecture/02-bitvm2-bridge' },
            { text: 'Substrate Parachain', link: '/docs/architecture/03-substrate-parachain' },
            { text: 'RISC-V Execution VM', link: '/docs/architecture/04-risc-v-vm' },
            { text: 'XCM Messaging', link: '/docs/architecture/05-xcm-messaging' },
            { text: 'Depository & Relay Protocol', link: '/docs/architecture/06-depository-relay' },
            { text: 'ZK Integration', link: '/docs/architecture/07-zk-integration' },
          ],
        },
      ],

      '/docs/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Prerequisites', link: '/docs/getting-started/01-prerequisites' },
            { text: 'Environment Setup', link: '/docs/getting-started/02-environment-setup' },
            { text: 'Node Setup', link: '/docs/getting-started/03-node-setup' },
            { text: 'Quickstart', link: '/docs/getting-started/04-quickstart' },
          ],
        },
      ],

      '/docs/components/': [
        {
          text: 'Components',
          items: [
            { text: 'OmniCore Node', link: '/docs/components/omnicore-node' },
            { text: 'pallet-revive (RISC-V VM)', link: '/docs/architecture/04-risc-v-vm' },
            { text: 'ERC-4337 Account Abstraction', link: '/docs/components/erc4337-account-abstraction' },
            { text: 'Depository Contract', link: '/docs/architecture/06-depository-relay' },
          ],
        },
      ],

      '/docs/smart-contracts/': [
        {
          text: 'Smart Contracts',
          items: [
            { text: 'Solidity → RISC-V', link: '/docs/smart-contracts/solidity-to-riscv' },
            { text: 'Token Standards', link: '/docs/smart-contracts/token-standards' },
            { text: 'Deployment Guide', link: '/docs/smart-contracts/deployment-guide' },
          ],
        },
      ],

      '/docs/use-cases/': [
        {
          text: 'Use Cases',
          items: [
            { text: 'RWA Tokenization', link: '/docs/use-cases/rwa-tokenization' },
            { text: 'Gaming Assets', link: '/docs/use-cases/gaming-assets' },
          ],
        },
      ],

      '/docs/security/': [
        {
          text: 'Security',
          items: [
            { text: 'Security Model', link: '/docs/security/security-model' },
            { text: 'Audit Checklist', link: '/docs/security/audit-checklist' },
          ],
        },
      ],
    },

    // ── Search ───────────────────────────────────────────────────────────────
    search: {
      provider: 'local',
    },

    // ── Social links ─────────────────────────────────────────────────────────
    socialLinks: [
      { icon: 'github', link: 'https://github.com/dongcore/dongchain' },
      { icon: 'twitter', link: 'https://twitter.com/dongcorechain' },
    ],

    // ── Footer ───────────────────────────────────────────────────────────────
    footer: {
      message: 'Released under the Apache 2.0 License.',
      copyright: 'Copyright © 2026 Dong Chain Contributors',
    },

    // ── Edit link ────────────────────────────────────────────────────────────
    editLink: {
      pattern: 'https://github.com/dongcore/dongchain/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    // ── Last updated ─────────────────────────────────────────────────────────
    lastUpdated: {
      text: 'Last updated',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    },

    // ── Carbon ads (optional, remove if not needed) ─────────────────────────
    // carbonAds: { code: '', placement: '' },
  },

  // Ignore dead links during build (fix incrementally)
  ignoreDeadLinks: true,

  // Markdown extensions
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    lineNumbers: true,
  },

  // Sitemap for SEO
  sitemap: {
    hostname: 'https://dongcore.com',
  },
})
