# Backend Test Runner Frontend

Production-oriented MVP frontend for configuring backend test environments, editing YAML suites, running tests, and viewing live reports.

## Stack

- React, TypeScript, Vite
- React Router
- TanStack Query
- Axios
- React Hook Form, Zod
- Tailwind CSS
- WebSocket client for live run events

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Set `VITE_API_URL` to your Nest.js API base URL and `VITE_WS_URL` to your WebSocket base URL.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run api:generate
npm run api:check
```

`api:generate` regenerates `src/generated/api/` from the backend OpenAPI spec.
`api:check` fails when generated client or `openapi.json` drift from backend DTOs.
