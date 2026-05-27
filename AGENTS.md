# AGENTS.md

This document provides architecture and convention guidance for AI agents and developers working on this codebase.

## Project Overview

A serverless sanctions screening API and dashboard. The service ingests XML from public government sanctions lists (OFAC, UN, EU), stores them in a Postgres database, and exposes a JSON REST API for screening entities and blockchain addresses.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start (React 19, file-based routing) |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| Serverless Functions | Netlify Functions (.mts TypeScript) |
| Database | Netlify Database (Postgres) via Drizzle ORM beta |
| XML Parsing | fast-xml-parser |
| Deployment | Netlify |

## Directory Structure

```
├── db/
│   ├── schema.ts          # Drizzle ORM table definitions
│   └── index.ts           # Database client (neon-http driver)
├── netlify/
│   ├── database/
│   │   └── migrations/    # Auto-generated SQL migrations (do not edit manually)
│   └── functions/
│       ├── lib/
│       │   └── sync.ts    # Shared sync logic for all list sources
│       ├── sanctions-check.mts          # GET /api/sanctions/check
│       ├── sanctions-crypto.mts         # GET /api/sanctions/crypto
│       ├── sanctions-lists.mts          # GET /api/sanctions/lists
│       ├── sanctions-sync-background.mts # POST /api/sanctions/sync
│       └── sanctions-sync-scheduled.mts  # Scheduled weekly sync (cron)
├── src/
│   ├── routes/
│   │   ├── __root.tsx     # Root layout and HTML shell
│   │   └── index.tsx      # Main dashboard UI
│   └── styles.css         # Global styles (Tailwind import)
├── drizzle.config.ts      # Drizzle Kit configuration
└── netlify.toml           # Build config
```

## Database Schema

Three tables in Netlify Database (Postgres):

- **`sanctions_lists`** — Metadata for each sanctions list (name, source URL, last sync, counts, status)
- **`sanctions_entities`** — Individual and organizational entries from each list. Aliases and programs are stored as JSON arrays serialized to `text`.
- **`sanctions_crypto_addresses`** — Blockchain addresses linked to entities. Unique constraint on `(listId, address, network)`.

When changing the schema, always run `npx drizzle-kit generate` to produce a new migration file. Never edit migration files manually.

## Sync Architecture

All sync logic lives in `netlify/functions/lib/sync.ts`. Each list has its own parser function:
- `syncOFACSDN` — OFAC Specially Designated Nationals XML
- `syncOfacConsolidated` — OFAC broader consolidated list (same XML format as SDN)
- `syncUNConsolidated` — UN Security Council XML
- `syncEUConsolidated` — EU CFSP XML (different schema)

Sync strategy: **delete-and-reinsert** per list. Each sync deletes all existing rows for the list, then batch-inserts fresh data (batch size 200). This avoids complex upsert logic.

Crypto addresses are extracted from OFAC SDN entries with `idType` matching `"Digital Currency Address - *"`. The network symbol is normalized via `CRYPTO_NETWORK_MAP` in `sync.ts`.

## API Functions

All functions export a `config` object with `path` for routing. They:
- Accept CORS preflight (OPTIONS)
- Return `Content-Type: application/json`
- Do not require authentication (public screening API)

The background sync function (`sanctions-sync-background.mts`) is intentionally synchronous — it runs fully within Netlify's background function 15-minute limit.

## Frontend

Single-page React app at `/`. Uses `fetch()` to call the API functions. Three sections toggled via nav: Search, Lists, API Reference. No external state management library — plain `useState`/`useEffect`.

## Conventions

- **TypeScript strict mode** enabled
- **Imports**: use `.js` extension in function imports even for `.ts` source files (ESM requirement)
- **Drizzle queries**: always use the Drizzle query builder, never raw SQL
- **JSON columns**: stored as `text` with `JSON.stringify`/`JSON.parse` (Drizzle beta pgTable doesn't require jsonb for these simple arrays)
- **No authentication**: this is a public read API; sync endpoints should be protected in production with a secret header or Netlify Identity
