# Sanctions Screening API

A container-ready sanctions screening API and dashboard for Coolify. The app serves a React dashboard and JSON API from one Express server, with Postgres storage through Drizzle ORM.

## Coolify Deployment

Use the included `Dockerfile` for a single app container, or `docker-compose.yml` if you want Coolify to run Postgres beside the app.

Required environment variable:

```bash
DATABASE_URL=postgresql://postgres:postgres@db:5432/sanctions
PRIVATE_LISTS_DIR=/app/private-lists
```

Coolify settings:

- Exposed port: `3000`
- Health check path: `/health`
- Build command: handled by Dockerfile
- Start command: handled by Dockerfile

If you use the included Compose file, Postgres loads `db/init.sql` on first startup to create the tables and seed the list metadata.

Private CSV lists are read from `PRIVATE_LISTS_DIR`. With the included Compose file, place them in:

```txt
private-lists/extremistas.csv
private-lists/wsl.csv
private-lists/scams.csv
private-lists/malware.csv
private-lists/hackers.csv
```

The `private-lists/` folder is ignored by Git and mounted read-only into the app container.

## Local Docker Run

```bash
docker compose up --build
```

Open `http://localhost:3000`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Container health check |
| `GET` | `/api/sanctions/check` | Search entities and crypto addresses |
| `GET` | `/api/sanctions/crypto` | Check a blockchain address |
| `GET` | `/api/sanctions/lists` | Get list status and statistics |
| `POST` | `/api/sanctions/sync` | Sync sanctions lists from public XML sources |

## Sync

The Sync button and `POST /api/sanctions/sync` run the same XML ingestion logic from the original Netlify functions, plus OpenSanctions datasets including `PEP OpenSanctions`. The server also runs a weekly sync every Sunday at 02:00.
