# Backend (Neon + SQLite)

This backend exposes UPSC function endpoints compatible with `.../functions/v1/*`.

## Tech
- Hono + Node runtime
- Neon PostgreSQL (primary DB)
- SQLite (local cache and request logs)
- Gemini API for AI generation

## Setup
1. Copy `.env.example` to `.env`
2. Fill:
   - `GEMINI_API_KEY`
   - `NEON_DATABASE_URL`
3. Install and run:

```bash
cd backend
npm install
npm run migrate
npm run dev
```

Backend starts at `http://localhost:8787`.
Neon connection check: `http://localhost:8787/health/neon`

## Routes
- `POST /functions/v1/ai-chat`
- `POST /functions/v1/generate-prelims-questions`
- `POST /functions/v1/mains-question`
- `POST /functions/v1/map-questions`
- `POST /functions/v1/mind-map-generator`
- `POST /functions/v1/optional-professor`
- `POST /functions/v1/pyq-analysis`
- `POST /functions/v1/upsc-notes-slides`
- `POST /functions/v1/generate-current-affairs`
- `POST /functions/v1/daily-intel-report`
- `POST /functions/v1/check-subscription`
- `POST /functions/v1/create-subscription`
- `POST /functions/v1/verify-subscription`
- `POST /functions/v1/admin-stats`
