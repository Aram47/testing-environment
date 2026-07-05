# Backend Test Runner

Backend Test Runner is a local web platform for configuring an isolated Docker Compose test environment, creating API test flows, running them, and reviewing results from the browser.

The main idea is simple: users work with forms, visual flows, or raw YAML in the UI, while the backend compiles an immutable execution plan for the runner.

## What The Platform Does

- Creates companies, users, and projects.
- Stores project environment configuration.
- Generates `docker-compose.test.yml` and `backend-test.yml` from configurable UI fields.
- Lets users create API test suites as visual request flows.
- Generates canonical execution plans and YAML exports from visual flows.
- Starts an isolated Docker Compose environment for every test run.
- Waits for the configured healthcheck.
- Executes API calls in order.
- Passes data between calls with saved response values and `{{ variable }}` interpolation.
- Stores test results, response bodies, runner logs, and run status.
- Supports light, dark, and system UI theme modes.

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, React Query, React Flow.
- Backend: NestJS, TypeScript, Prisma.
- Database: PostgreSQL.
- Queue: Redis + BullMQ for durable test run execution jobs.
- Runner: Docker Compose controlled by a dedicated runner worker through Docker socket.
- Realtime: Socket.IO events for test run progress.

## Repository Structure

```text
.
├── docker-compose.yml
├── testing-environment-backend
│   ├── prisma
│   └── src
└── testing-environment-frontend
    └── src
```

## Requirements

- Docker and Docker Compose.
- Node.js 22 if you want to run frontend/backend locally outside Docker.
- Access to `/var/run/docker.sock` for the `runner-worker` container.

## Quick Start With Docker

From the repository root:

```bash
docker compose up --build --force-recreate
```

Open:

```text
http://localhost
```

Useful service URLs:

```text
Frontend: http://localhost
Backend:  http://localhost:3000
Swagger:  http://localhost:3000/docs
Postgres: localhost:5432
Redis:    localhost:6379
```

The `backend-api` container runs Prisma migrations and seeds subscription plans on startup. The API creates `TestRun` records and enqueues BullMQ jobs. The `runner-worker` container claims those jobs, runs Docker Compose, and persists progress/results in PostgreSQL.

Useful service commands:

```bash
docker compose up --build backend-api runner-worker redis postgres frontend
docker compose logs -f backend-api
docker compose logs -f runner-worker
```

`backend-api` intentionally does not mount `/var/run/docker.sock`. Only `runner-worker` has Docker socket access.

## First Login

1. Open `http://localhost/register`.
2. Create a user with company name.
3. After registration, the app opens the protected dashboard.

Password must be at least 8 characters.

## Core Workflow

The usual flow is:

1. Create a project.
2. Configure the test environment.
3. Create a test suite.
4. Start a test run.
5. Review results and logs.

## Create A Project

Go to `Projects` -> `New project`.

Example values for a simple local test:

```text
Name: HTTPBin Demo
Description: Demo project for validating the test runner
Base URL: http://host.docker.internal:8000
Main service name: api
Healthcheck path: /status/200
Expected status: 200
Timeout seconds: 60
```

On Linux, `host.docker.internal` may not be available by default. If the test service runs inside the runner's Docker Compose environment, prefer the service URL used by the runner, or expose the service port and use a host address reachable from the backend container.

## Environment Configuration

Open the project, then go to `Environment configuration`.

The page has two modes:

- `Config`: recommended form-based setup.
- `YAML`: legacy/manual YAML editing.

In `Config` mode, the frontend sends structured data to the backend. The backend compiles it into:

- `docker-compose.test.yml`
- `backend-test.yml`

The runner still uses those generated YAML files internally.

### Example Environment

Use this to test the platform without your own backend app.

Service:

```text
Service name: api
Image: kennethreitz/httpbin
Build context: empty
Dockerfile: empty
Command: empty
```

Ports:

```text
Host: 8000
Container: 80
```

Environment variables:

```text
empty
```

### Environment Secrets

Project secrets are stored encrypted and are never returned as plaintext after creation.
Use the project secrets API or UI-backed metadata selector, then reference secrets in YAML or visual
environment variables with:

```text
{{ secret.API_KEY }}
```

The visual environment editor supports three value modes:

- literal value;
- project secret, compiled as `{{ secret.KEY }}`;
- runtime variable, compiled as `{{ VARIABLE_NAME }}`.

Runner execution resolves only the secrets referenced by the selected immutable environment and suite
revisions. Logs, response bodies, reports, errors, and realtime events are masked before persistence or
publication. Large run outputs are stored as artifacts through the local filesystem adapter by default;
PostgreSQL keeps metadata, checksums, retention timestamps, result previews, and log chunk previews.

Secret encryption keys are versioned with:

```text
SECRET_ENCRYPTION_KEYS={"v1":"base64-32-byte-key","v2":"base64-32-byte-key"}
ACTIVE_SECRET_ENCRYPTION_KEY_VERSION=v2
```

`SECRET_ENCRYPTION_KEY` remains supported as the legacy `v1` fallback. Owners/admins can enqueue
resumable key rotation for their company secrets with `POST /secrets/key-rotations`.

Depends on:

```text
empty
```

App and healthcheck:

```text
Main API service: api
Base URL: http://host.docker.internal:8000
Healthcheck path: /status/200
Expected status: 200
Timeout seconds: 60
```

Run settings:

```text
Timeout minutes: 10
Cleanup environment after run: checked
```

Click `Validate`, then `Save configuration`.

### What The Backend Generates

The generated Docker Compose YAML will look roughly like this:

```yaml
services:
  api:
    image: kennethreitz/httpbin
    ports:
      - 8000:80
```

The generated backend test runtime YAML will look roughly like this:

```yaml
version: '1.0'
environment:
  type: docker_compose
  compose_file: ./docker-compose.test.yml
app:
  service: api
  base_url: http://host.docker.internal:8000
  healthcheck:
    path: /status/200
    expected_status: 200
    timeout_seconds: 60
tests:
  - ./tests/*.yml
run:
  timeout_minutes: 10
  cleanup: true
```

## Test Suites

Open the project, then go to `Test suites` -> `New test suite`.

The page has two modes:

- `Flow`: recommended visual API flow builder.
- `YAML`: legacy/manual YAML editing.

In `Flow` mode:

- Each node is one API request.
- Edges define execution order.
- The backend compiles the flow into a canonical execution plan and YAML export.
- The runner executes the canonical execution plan.

### Example Test Suite

Create three nodes.

Node 1:

```text
Name: Health check
Method: GET
Path: /status/200
Expected status: 200
```

Node 2:

```text
Name: Get request
Method: GET
Path: /get
Expected status: 200
```

JSON contains:

```json
{
  "url": "http://host.docker.internal:8000/get"
}
```

Node 3:

```text
Name: Post payload
Method: POST
Path: /post
Expected status: 200
```

JSON body:

```json
{
  "email": "test@example.com",
  "role": "admin"
}
```

JSON contains:

```json
{
  "json": {
    "email": "test@example.com",
    "role": "admin"
  }
}
```

Connect the nodes:

```text
Health check -> Get request -> Post payload
```

Click `Validate`, then `Save flow`.

## Passing Data Between API Calls

Nodes can save values from a response and use them in later nodes.

Example:

First request saves a token:

```text
Save variables:
access_token=$.access_token
```

Later request uses it:

```text
Header:
Authorization=Bearer {{ access_token }}
```

The backend runner interpolates `{{ access_token }}` before sending the later request.

Supported save paths currently use simple JSON paths like:

```text
$.id
$.access_token
$.user.email
```

## Running Tests

Open the project, then go to `Runs`.

Click the action to start a new run. The backend will:

1. Create an isolated workspace.
2. Write generated environment YAML files.
3. Load canonical test suite execution plans.
4. Start Docker Compose.
5. Wait for the healthcheck.
6. Execute test suites.
7. Store results.
8. Stop and clean up the Docker Compose environment.

## Reading Results

Open a run detail page to see:

- Run status and phase, including queued/claimed/preparation/environment/test execution states,
  terminal `PASSED`, `TEST_FAILED`, `INFRA_FAILED`, `TIMED_OUT`, and cancellation states.
- Total, passed, and failed tests.
- Individual test results.
- Request and response bodies.
- Error messages.
- Runner and Docker logs.

## Dark Mode

The UI supports:

- System theme.
- Light mode.
- Dark mode.

Use the theme button in the top bar. The preference is stored in browser local storage.

## Manual YAML Mode

Both Environment configuration and Test suites still support YAML mode.

Use YAML mode when:

- You need a Docker Compose feature not yet exposed in the configurable UI.
- You want to paste an existing test suite.
- You need to debug the generated YAML.

When a visual/configurable editor is used, backend-generated YAML is authoritative.

## Docker Notes

The root `docker-compose.yml` mounts:

```text
/var/run/docker.sock:/var/run/docker.sock
```

This is required because the backend container starts test environments through Docker Compose.

The runner workspace is mounted at:

```text
/tmp/backend-test-runner
```

Avoid deleting the database volume unless you intentionally want to reset all data:

```bash
docker compose down -v
```

For normal rebuilds, use:

```bash
docker compose up --build --force-recreate
```

If the browser still shows an old frontend bundle after rebuild, hard refresh the page or open an incognito window.

## Local Development

Frontend:

```bash
cd testing-environment-frontend
npm install
npm run dev
```

Backend:

```bash
cd testing-environment-backend
npm install
npx prisma generate
npm run start:dev
```

Backend checks:

```bash
cd testing-environment-backend
npm run lint
npm run build
npm test -- --runInBand
```

Frontend checks:

```bash
cd testing-environment-frontend
npm run lint
npm run build
```

## Common Problems

### I do not see new frontend changes after Docker rebuild

Run from the repository root:

```bash
docker compose up --build --force-recreate
```

Then hard refresh the browser.

Check that these containers are running:

```bash
docker compose ps
```

Expected containers:

```text
testing-env-frontend
testing-env-backend
testing-env-postgres
```

### Test run fails before executing tests

Check:

- Environment configuration exists.
- At least one test suite exists.
- Docker daemon is running.
- Backend container has access to `/var/run/docker.sock`.
- The healthcheck path returns the expected status.

### Healthcheck timeout

Check:

- `Base URL`
- `Healthcheck path`
- exposed ports
- Docker image startup time
- `Timeout seconds`

### All requests fail with connection errors

The backend runner sends HTTP requests from inside the backend container. Make sure the configured base URL is reachable from that container.

For the demo `httpbin` setup, use:

```text
http://host.docker.internal:8000
```

If your platform runs differently on Linux, use a reachable Docker network address or service URL.

## Current V1 Limitations

- Environment Config UI supports common Docker Compose fields, not the full Compose specification.
- Flow Builder supports dependency ordering, not conditional branches, loops, or parallel execution.
- JSON path support for saved variables is intentionally simple.
- Test suite `ExecutionPlan` is the source of truth for runtime execution; YAML is kept as import/export format and legacy fallback.
