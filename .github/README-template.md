# README Template — HOOX Stack products

Canonical header + footer for the three main products (hoox, pyne, axis).
Replace `{{PLACEHOLDER}}` values per repo. Keep section order and wording
identical across products so the three READMEs stay symmetric.

---

## HEADER (insert after the H1 + one-liner, before repo-specific content)

```markdown
<div align="center">

  <!-- brand/tagline image, e.g. brand/png/tagline-*.png or docs/images/... -->

![{{TAGLINE_IMAGE_ALT}}]({{TAGLINE_IMAGE_PATH}})

  <!-- badge row: real badges only (shields.io flat-square + codecov) -->

{{BADGE_ROW}}

**Site:** {{SITE}} · **Docs:** {{DOCS}} · **Repo:** {{REPO}}

**Stack:** ⚡ [HOOX](https://github.com/hoox-sh/hoox) · 🐍 [PYNE](https://github.com/hoox-sh/pyne) · 📊 [AXIS](https://github.com/hoox-sh/axis)

  <!-- mark the current repo: 🐍 [**PYNE**](…) *(this repo)* -->

</div>
```

### Badge row recipes

```markdown
<!-- CI (per repo) -->

[![CI](https://img.shields.io/github/actions/workflow/status/hoox-sh/{{REPO}}/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/hoox-sh/{{REPO}}/actions/workflows/ci.yml)

<!-- Coverage -->

[![codecov](https://codecov.io/gh/hoox-sh/{{REPO}}/graph/badge.svg)](https://codecov.io/gh/hoox-sh/{{REPO}})

<!-- Language / runtime / platform (static, flat-square, logo) -->

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9%2B-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.4-000000?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776ab?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-edge-f38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

<!-- Packages -->

[![PyPI](https://img.shields.io/pypi/v/hoox-pyne?style=flat-square&logo=pypi&logoColor=white)](https://pypi.org/project/hoox-pyne/)
[![npm](https://img.shields.io/npm/v/{{NPM_PKG}}?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/{{NPM_PKG}})

<!-- License (dynamic where the LICENSE file is unambiguous) -->

[![License](https://img.shields.io/github/license/hoox-sh/{{REPO}}?style=flat-square)]({{LICENSE_LINK}})
```

---

## FOOTER (append at the very end of the README)

````markdown
---

## The HOOX Stack — all products & sister projects

Everything under [github.com/hoox-sh](https://github.com/hoox-sh) — one open trading stack on [hoox.sh](https://hoox.sh):

```text
                    https://hoox.sh
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
         HOOX            PYNE           AXIS
    (edge execution)  (Pine engine)  (charting UI)
           │              │              │
           └──────────────┴──────────────┘
                    trade signals / eval API
```
````

**Main products**

| Product  | Role                                                                          | Repository                                      | Website                                                                  |
| -------- | ----------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| **HOOX** | Edge trading framework — signal validation & execution on Cloudflare® Workers | [hoox-sh/hoox](https://github.com/hoox-sh/hoox) | [hoox.sh](https://hoox.sh) · [docs](https://docs.hoox.sh)                |
| **PYNE** | Pine Script™ toolchain — grammar, AST, dual-engine runtime, LSP, Pro API      | [hoox-sh/pyne](https://github.com/hoox-sh/pyne) | [hoox.sh/pyne](https://hoox.sh/pyne) · [docs](https://hoox.sh/pyne/docs) |
| **AXIS** | Installable charting PWA — CEX OHLCV, drawings, on-chain overlays             | [hoox-sh/axis](https://github.com/hoox-sh/axis) | [hoox.sh/axis](https://hoox.sh/axis) · [docs](https://hoox.sh/axis/docs) |

<!-- mark the current repo row: **PYNE** *(this repo)* | … -->

**PYNE satellites**

| Project               | Role                                                                     | Repository                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PyneTS**            | TypeScript / Bun library (`@hoox-sh/pynets`) — parse, unparse, interpret | [hoox-sh/pynets](https://github.com/hoox-sh/pynets)                                                                                                              |
| **pyne-worker**       | Python Cloudflare® Worker — edge `POST /run`, cron, R2, alerts           | [hoox-sh/pyne-worker](https://github.com/hoox-sh/pyne-worker)                                                                                                    |
| **pyne-agent-worker** | Workers AI Pine agent — RAG + validate loop                              | [hoox-sh/pyne-agent-worker](https://github.com/hoox-sh/pyne-agent-worker)                                                                                        |
| **pyne-lsp**          | Language server `pyne-lsp` (in the PYNE tree)                            | [hoox-sh/pyne](https://github.com/hoox-sh/pyne) · [docs](https://hoox.sh/pyne/docs/lsp)                                                                          |
| **pyne-vscode**       | VS Code / Open VSX extension (in the PYNE tree)                          | [vscode-extension](https://github.com/hoox-sh/pyne/tree/main/vscode-extension) · [Marketplace](https://marketplace.visualstudio.com/items?itemName=hoox-sh.pyne) |

**AXIS satellites**

| Project                     | Role                                                               | Repository                                                                            |
| --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **axis-plugin-boilerplate** | Starter for source / stream / engine / dataset / component plugins | [hoox-sh/axis-plugin-boilerplate](https://github.com/hoox-sh/axis-plugin-boilerplate) |

**HOOX execution & ops plane**

| Worker                 | Role                                                     | Repository                                                                  |
| ---------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| **hoox-worker**        | Public gateway — webhooks, WAF, DO idempotency, dispatch | [hoox-sh/hoox-worker](https://github.com/hoox-sh/hoox-worker)               |
| **trade-worker**       | Multi-exchange execution — Binance, Bybit, MEXC          | [hoox-sh/trade-worker](https://github.com/hoox-sh/trade-worker)             |
| **agent-worker**       | AI risk manager — cron, trailing stops, kill switch      | [hoox-sh/agent-worker](https://github.com/hoox-sh/agent-worker)             |
| **d1-worker**          | D1 SQL proxy — balances, positions, settings             | [hoox-sh/d1-worker](https://github.com/hoox-sh/d1-worker)                   |
| **telegram-worker**    | Telegram alerts + RAG copilot                            | [hoox-sh/telegram-worker](https://github.com/hoox-sh/telegram-worker)       |
| **web3-wallet-worker** | On-chain wallet identity (ethers.js)                     | [hoox-sh/web3-wallet-worker](https://github.com/hoox-sh/web3-wallet-worker) |
| **email-worker**       | Mailgun ingress — natural language → trade signals       | [hoox-sh/email-worker](https://github.com/hoox-sh/email-worker)             |
| **analytics-worker**   | Analytics Engine fan-in — trades, signals, latency       | [hoox-sh/analytics-worker](https://github.com/hoox-sh/analytics-worker)     |
| **report-worker**      | Browser Rendering PDFs → R2, cron delivery               | [hoox-sh/report-worker](https://github.com/hoox-sh/report-worker)           |
| **dashboard**          | Next.js ops console (in the HOOX tree)                   | [hoox-sh/hoox](https://github.com/hoox-sh/hoox)                             |
| **pine-worker**        | Pine evaluator → trade events (private)                  | [hoox-sh/pine-worker](https://github.com/hoox-sh/pine-worker)               |

**Web**

| Project               | Role                                                 | Repository                                                                |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| **hoox-landing-page** | Marketing site source for [hoox.sh](https://hoox.sh) | [hoox-sh/hoox-landing-page](https://github.com/hoox-sh/hoox-landing-page) |

## Ethos

- **Independent & open** — no proprietary chart host, no closed data services; evaluation never depends on TradingView®.
- **Edge-first** — compute colocated with exchanges on Cloudflare's global network.
- **Local-first** — AXIS runs fully offline (Pyodide); PYNE runs on your machine; HOOX self-hosts on the free tier.
- **No vendor lock-in** — open core, self-hostable, exportable.
- **Batteries included** — CLIs, LSP, dashboards, docs, and one-click deploy buttons ship in the box.

> **Disclaimer.** _Pine Script™_ and _TradingView®_ are trademarks of [TradingView, Inc.](https://www.tradingview.com/); _Cloudflare®_ is a trademark of Cloudflare, Inc. The HOOX stack is **independent** and is not affiliated with, authorized by, sponsored by, or endorsed by either company. Educational and research use; trading involves substantial risk of loss — this is not financial advice.

⚡ **Powered by Cloudflare** — Workers · D1 · R2 · KV · Queues · Analytics Engine · Workers AI · Browser Rendering

## License

{{LICENSE}}

🔋 Batteries included.

```

---

## Per-repo values

| Placeholder | hoox | pyne | axis |
|---|---|---|---|
| Tagline image | `brand/png/tagline-distributed-by-design-github-1280x640-br-split-dark.png` | `brand/png/tagline-failure-is-local-github-1280x640-br-split-dark.png` | `docs/images/landing/axis-hero.png` |
| Site | hoox.sh | hoox.sh/pyne | hoox.sh/axis |
| Package | npm `@hoox-sh/hoox-cli` | PyPI `hoox-pyne` | npm `@hoox-sh/axis-cli` |
| License | Apache-2.0 (code, `LICENSE-CODE`) + CC BY 4.0 (docs/papers) | AGPL-3.0-or-later | AGPL-3.0-only |
```
