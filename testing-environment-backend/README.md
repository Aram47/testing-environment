# Backend Test Runner

Production-oriented MVP backend for a SaaS platform that lets companies define projects, store Docker Compose test environments, run YAML API test suites, and inspect live progress and reports.

## Stack

- Nest.js + TypeScript
- PostgreSQL + Prisma
- JWT authentication
- bcrypt password hashing
- class-validator/class-transformer DTO validation
- WebSocket live run updates
- Redis + BullMQ durable test run queue
- Dedicated Docker Compose runner worker via Node.js `child_process`
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

3. Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
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

6. In a separate shell, start the runner worker:

```bash
npm run build
npm run start:worker
```

Swagger docs are available at `http://localhost:3000/docs`.

The API process creates `TestRun` rows and enqueues BullMQ jobs. The worker process claims jobs from Redis and executes Docker Compose test runs. Docker socket access is required only for the worker runtime.

## Queue and worker configuration

- `REDIS_URL`: Redis connection string, default `redis://localhost:6379`.
- `TEST_RUN_QUEUE_CONCURRENCY`: worker concurrency, default `1`.
- `TEST_RUN_STALLED_INTERVAL_MS`: BullMQ stalled job check interval, default `30000`.
- `TEST_RUN_MAX_STALLED_COUNT`: maximum stalled recoveries before failure, default `1`.
- `TEST_RUN_RUNNER_ID`: optional stable worker identifier; defaults to hostname and process id.
- `TEST_RUN_LEASE_DURATION_MS`: execution lease duration, default `60000`.
- `TEST_RUN_HEARTBEAT_INTERVAL_MS`: worker heartbeat interval, default `15000`.
- `TEST_RUN_CANCELLATION_POLL_INTERVAL_MS`: persisted cancellation polling interval, default `1000`.
- `TEST_RUN_JANITOR_INTERVAL_MS`: orphaned run recovery interval, default `30000`.

Readiness endpoints:

- `GET /health/live`
- `GET /health/ready` checks PostgreSQL and Redis.

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

The MVP runner executes Docker Compose locally from the dedicated worker process. It rejects privileged containers, host networking, Docker socket mounts, and obvious root host mounts.

This is only a local MVP guardrail. A production SaaS must run untrusted customer workloads in isolated VMs, ephemeral workers, or self-hosted runners with strong sandboxing and resource quotas.

## Verification

```bash
npx prisma validate
npm run lint
npm run test
npm run test:e2e
npm run build
```
