# Backend Test Runner

Production-oriented MVP backend for a SaaS platform that lets companies define projects, store Docker Compose test environments, run YAML API test suites, and inspect live progress and reports.

## Stack

- Nest.js + TypeScript
- PostgreSQL + Prisma
- JWT authentication
- bcrypt password hashing
- class-validator/class-transformer DTO validation
- WebSocket live run updates
- Local Docker Compose runner via Node.js `child_process`
- YAML API test execution with native `fetch`

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env:

```bash
cp .env.example .env
```

Generate a 32-byte base64 secret key for `SECRET_ENCRYPTION_KEY`:

```bash
openssl rand -base64 32
```

3. Start PostgreSQL:

```bash
docker compose up -d postgres
```

4. Apply Prisma migration and seed plans:

```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

5. Start API:

```bash
npm run start:dev
```

Swagger docs are available at `http://localhost:3000/docs`.

## Core API

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /companies/me`
- `PATCH /companies/me`
- `POST /projects`
- `GET /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `DELETE /projects/:id`
- `POST /projects/:projectId/environment-config`
- `GET /projects/:projectId/environment-config`
- `PATCH /projects/:projectId/environment-config`
- `POST /projects/:projectId/secrets`
- `GET /projects/:projectId/secrets`
- `DELETE /projects/:projectId/secrets/:secretId`
- `POST /projects/:projectId/test-suites`
- `GET /projects/:projectId/test-suites`
- `GET /projects/:projectId/test-suites/:suiteId`
- `PATCH /projects/:projectId/test-suites/:suiteId`
- `DELETE /projects/:projectId/test-suites/:suiteId`
- `POST /projects/:projectId/test-runs`
- `GET /projects/:projectId/test-runs`
- `GET /projects/:projectId/test-runs/:runId`
- `POST /projects/:projectId/test-runs/:runId/cancel`
- `GET /projects/:projectId/test-runs/:runId/report`
- `GET /projects/:projectId/test-runs/:runId/logs`

## WebSocket

Connect to namespace `/runs` with JWT in `auth.token` or `Authorization: Bearer <token>`, then subscribe:

```json
{ "event": "subscribe", "data": { "testRunId": "<run-id>" } }
```

Server emits `runner.event` with:

- `run.started`
- `environment.starting`
- `environment.ready`
- `test.started`
- `test.passed`
- `test.failed`
- `logs.updated`
- `environment.stopping`
- `run.finished`

## Runner safety notes

The MVP runner executes Docker Compose locally. It rejects privileged containers, host networking, Docker socket mounts, and obvious root host mounts.

This is only a local MVP guardrail. A production SaaS must run untrusted customer workloads in isolated VMs, ephemeral workers, or self-hosted runners with strong sandboxing and resource quotas.

## Verification

```bash
npx prisma validate
npm run lint
npm run test
npm run test:e2e
npm run build
```
