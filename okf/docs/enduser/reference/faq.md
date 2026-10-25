---
type: "Document"
title: "❓ Frequently Asked Questions (FAQ)"
description: "description: \"Install, secrets, DEX spots, testnet, deploy, and troubleshooting answers for Hoox 0.15.x.\"."
resource: "docs/enduser/reference/faq.mdx"
tags: [doc, docs, enduser, reference]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T15:19:17Z
sources:
  - id: tree
    resource: "docs/enduser/reference/faq.mdx"
    title: "docs/enduser/reference/faq.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/enduser/reference/faq.mdx`.

# Outline

* 🏁 Getting Started
  * Q: How do I clone the repository correctly?
  * Q: What are the minimum system requirements?
  * Q: How do I install and bootstrap?
  * Q: Can I use Hoox for free?
  * Q: Do I need to know Solidity or blockchain development?
  * Q: Can I drive Hoox from an editor / agent?
* 🔑 Credentials & Secrets
  * Q: Where do I get my Cloudflare® API token?
  * Q: How do I create exchange API keys?
  * Q: Are my API keys safe?
  * Q: How do I paper-trade / use exchange testnets?
  * Q: How do I swap on Uniswap or Jupiter?
  * Q: Can I rotate API keys without downtime?
* ⚡ Deployment & Configuration
  * Q: What's the difference between hoox deploy all and deploying individual workers?
  * Q: Why does my first deploy take longer than subsequent ones?
  * Q: How do I change the exchange routing?
  * Q: What happens when I toggle the kill switch on?
* 🐛 Troubleshooting
  * Q: I get "409 Conflict" errors. What's wrong?
  * Q: My webhooks work locally but fail in production. Why?
  * Q: How do I check what's happening inside my workers?
  * Q: What should I do if hoox repair check fails?
* 🧠 AI & Advanced Features
  * Q: Do I need AI providers for basic trading?
  * Q: Which AI provider is best?
  * Q: What does the agent-worker cron do exactly?
* 📦 Infrastructure
  * Q: What data is stored in D1 vs KV vs R2?
  * Q: How does Hoox handle exchange downtime?
  * Q: Is multi-tenant isolation on by default?
  * Q: Can I use a custom domain?
* 📋 Comparisons
  * Q: Why edge workers instead of a VPS?
  * Q: Why Cloudflare over AWS Lambda@Edge?
