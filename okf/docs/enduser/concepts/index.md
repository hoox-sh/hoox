# docs/enduser/concepts

# Concepts

* [ai-risk-manager.mdx](ai-risk-manager.md) - description: "How the agent-worker runs configurable cron checks (1–1440 minutes) to calculate trailing stops, evaluate max daily drawdowns, and govern a multi-provider fallback…
* [cloudflare-services.mdx](cloudflare-services.md) - description: "How D1 edge-SQLite, KV, R2, Queues, Durable Objects, Vectorize, and Browser Rendering power our distributed edge monorepo.".
* [Product ecosystem](ecosystem.md) - description: "HOOX, PYNE, PyneTS, AXIS, pyne-worker, and pyne-agent-worker — what each surface does.".
* [⚡ Edge-First Architecture](edge-architecture.md) - description: "Why V8 isolates and Cloudflare Workers cut order-path latency versus a single VPS.".
* [how-hoox-works.mdx](how-hoox-works.md) - description: "High-level overview of the pipeline turning a trade signal into an executed edge order.".
* [🔒 Idempotency & Durable Objects](idempotency.md) - description: "Two-phase Durable Object reserve/commit/release so webhook retries cannot double-dispatch orders.".
* [📊 Signals & Trade Spec](signals-and-trades.md) - description: "Webhook JSON schema, CEX/DEX venue names, test trading, and D1 ledger columns.".
