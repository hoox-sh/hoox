# docs/enduser/guides

# Concepts

* [AXIS and HOOX](axis-and-hoox.md) - description: "AXIS evaluates Pine on a chart. HOOX executes orders. Connecting them is optional and goes through pyne-worker, not the PWA.".
* [🗄️ Database Operations](database-ops.md) - description: "Apply the D1 schema, run tracking migrations, query the ledger, and export backups with hoox db.".
* [🚀 Deploying to Production](deploy-workers.md) - description: "Deploy the worker mesh and dashboard with hoox deploy all --auto, then bind Telegram and KV.".
* [dex-spot-swaps.mdx](dex-spot-swaps.md) - description: "Route Uniswap V3 (Ethereum, Arbitrum) and Jupiter Swap V2 (Solana) through trade-worker signals. Setup, secrets, pair syntax, and test-flag limits.".
* [local-development.mdx](local-development.md) - description: "How to run, hot-reload, and test Hoox workers locally using native wrangler runtimes or Docker Compose containers.".
* [manage-infra.mdx](manage-infra.md) - description: "How to provision and manage Cloudflare® D1 databases, KV namespaces, R2 buckets, Queues, and Vectorize indexes using hoox infra.".
* [📈 Monitoring Operations](monitor-trading.md) - description: "Probe worker health, toggle the kill switch, inspect trades and queues, and tail edge logs.".
* [PYNE live trading](pyne-live-trading.md) - description: "Bar-close cron: PYNE strategy events become HOOX WebhookPayloads on trade-worker. Alerts are a separate webhook path.".
* [🛠️ Self-Healing & Repair](repair.md) - description: "Diagnose empty submodules, missing secrets, and broken bindings with hoox repair.".
* [screenshots.mdx](screenshots.md) - description: "Screenshots and short GIFs of the HOOX CLI, TUI, and dashboard — every primary view, command group, and page.".
* [secrets-security.mdx](secrets-security.md) - description: "How to manage encrypted Cloudflare® Worker Secrets, secure Zero Trust service boundaries, and configure edge firewalls and IP allowlists.".
* [test-trading.mdx](test-trading.md) - description: "Run sandbox orders with test: true — per-exchange support, dedicated secrets, D1 isolation, dashboard, and agent safety.".
* [tui.mdx](tui.md) - description: "Master reference for the full-screen terminal operations cockpit, keyboard shortcuts, view registries, and resilience engines.".
