# DukaanVoice PK — ڈیجیٹل دکان کھاتہ و پوائنٹ آف سیل

An **offline-first, multilingual shop register and point-of-sale** for Pakistani
kiryana (neighbourhood grocery) shops — with an **on-device, open-source AI
accountant called Munshi AI** at its core.

Small shops run on thin margins, unreliable internet, and a bookkeeper who may not
read English fluently. DukaanVoice PK turns the counter into a fast, auditable
register *and* gives the owner an AI Munshi that understands Urdu, forecasts
stockouts, catches cash-desk mistakes, and quotes live wholesale rates — without
sending a single rupee of customer data to a server.

Built for **Hacktoberfest 2026 — "Side Hustle"**.

---

## Why open source is the whole point

| Closed-API alternative | What open gives us here |
|---|---|
| Per-query pricing on every shopkeeper message | **Gemma runs locally** via Ollama → ~Rs.0 marginal cost, a business that actually works on grocery margins |
| Customer names, credit ledgers and prices uploaded to a vendor | **Nothing leaves the laptop** — the register is IndexedDB, the model is local |
| One-size-fits-all model, can't specialise | **Swap or fine-tune** the model for a niche market / dialect |
| A black box you cannot inspect | The agent's tools and traces are **fully visible** (Agent Trace panel + Sentry) |

## Core register (nine areas)

Quick Sale · Dashboard · Products · Transactions · Udhaar Khata (customer credit) ·
Expenses · Cash Closing (Roznamcha) · Reports · **Munshi AI**.

Money is stored as integer **paise** (never floats). Sales follow a
draft → confirmed lifecycle; confirmed sales decrement stock exactly once; cash
closing excludes digital payments; COGS is reported separately from receipts.

## Munshi AI — the open-source AI layer

`src/lib/ai/munshi.ts` orchestrates a small set of **real tool calls** over the
shop ledger. An open-weight model *proposes*; a deterministic engine *disposes*,
so the maths is always reproducible and the app never blocks on the network.

| Tool | Answers |
|---|---|
| `inventory_query` | low stock, stock levels |
| `sales_summary` | today / all-time confirmed sales |
| `udhaar_query` | outstanding customer credit |
| `mandi_rates` | live wholesale commodity rates |
| `demand_forecast` | 7-day demand + reorder quantity per product |
| `anomaly_scan` | cash-drawer & expense outliers |
| `draft_bill` | turns free text ("2 kg atta") into a confirmable bill |

Every run produces a **trace** (intent → each tool → latency) shown in the UI and
forwarded to Sentry when configured.

## Open-source AI & partner technology used

| Layer | Choice | Where |
|---|---|---|
| Open-weight model | **Google Gemma** via local **Ollama** (heuristic fallback offline) | `src/lib/ai/gemma.ts` |
| Tabular foundation model | **TabPFN** (Prior Labs) for forecasting + anomaly detection | `src/lib/ai/tabpfn.ts` |
| Live grounding | **SerpApi** wholesale / mandi rates | `src/lib/ai/serpapi.ts` |
| Multilingual voice | **ElevenLabs** TTS (+ browser Web Speech fallback) | `src/lib/ai/elevenlabs.ts` |
| Agent tracing | **Sentry** spans, with an offline in-app trace viewer | `src/lib/ai/telemetry.ts` |
| Agent orchestration | **Mastra** (open-source) — same tools, any model router; deterministic fallback | `src/lib/ai/mastra-agent.ts` |
| Hosting | **Render** blueprint | `render.yaml` |
| CI | **GitHub Actions** — lint → test → build on every push | `.github/workflows/ci.yml` |

## Architecture

```
Browser (offline-first)                 Next.js server (AI routes)
┌──────────────────────────┐            ┌─────────────────────────────┐
│ React 19 UI + AppShell   │  POST      │ /api/ai/munshi  → Munshi AI │
│ IndexedDB ledger (db.ts) │ ─────────► │   ├─ Gemma (Ollama, local)  │
│ Munshi AI page           │            │   ├─ TabPFN forecast/anomaly│
└──────────────────────────┘            │   ├─ SerpApi mandi rates    │
                                        │   └─ telemetry → Sentry     │
                                        ├─────────────────────────────┤
                                        │ /api/ai/mastra → Mastra     │
                                        │   agent over the same tools │
                                        └─────────────────────────────┘
```

The client sends its ledger snapshot with each agent request — the server holds no
database, so shop data stays wherever the shop is.

## Getting started

```bash
cd dukaanvoice
npm install
npm run dev        # http://localhost:3000
```

Everything works with **zero configuration**. To enable the optional partner
capabilities, copy `.env.example` → `.env.local` and fill in what you have:

```bash
# Fully local, best experience:
ollama pull gemma2:2b && ollama serve      # Gemma for free-text understanding
```

## Testing

Unit/integration tests run with [Vitest](https://vitest.dev/) (React Testing
Library + happy-dom). Test **files execute in parallel** worker processes; tests
within a file run in declaration order.

```bash
npm test            # single run
npm run test:watch  # watch mode
```

Layout:

- `src/lib/__tests__/` — money/cash-drawer math (`financial`), seed integrity
  (`seed`), cart reducer (`store`), **and the Munshi agent** (`munshi`).
- `src/app/__tests__/` — Quick Sale flows and a smoke test that every area renders.

`vitest.config.mts` pins `TZ=Asia/Karachi` so business-date assertions are stable.

## Deploy on Render

1. Push to GitHub.
2. Render → **New → Blueprint** → pick the repo (uses `render.yaml`).
3. Optionally set the partner keys in the dashboard. Blank keys are fine — the app
   runs offline.

## Side-by-side comparison harness

With the dev server running, open
[http://localhost:3000/compare.html](http://localhost:3000/compare.html) for a
split-view harness (pages grid, dev vs prod, local vs reference).

## License

MIT (see repository for details).
