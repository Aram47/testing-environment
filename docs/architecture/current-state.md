# Current State Architecture

## Purpose

Testing Environment Project is a full-stack platform for configuring Docker Compose based test environments, authoring API test suites through YAML or a visual flow builder, running integration test runs, and reviewing results, logs, reports, and realtime progress.

This document describes the codebase as it exists now. It does not describe the desired future state unless explicitly called out as a gap.

## Repository Shape

- `testing-environment-backend`: NestJS 10, TypeScript, Prisma 5, PostgreSQL, JWT auth, Socket.IO, js-yaml, Docker Compose runner.
- `testing-environment-frontend`: React 18, Vite, TypeScript, TanStack React Query, React Hook Form, Zod, Tailwind CSS, React Flow, Axios, Socket.IO client.
- Root `docker-compose.yml`: local full-stack runtime.
- `PROJECT_DOCUMENTATION.md`: broad product documentation, useful context but not always a substitute for source code.
- `docs/`: architecture and implementation documents added by this audit.

The current git worktree already contains unrelated uncommitted changes. This audit treats them as existing user work.

## Backend Module Structure

The backend is already organized as a NestJS modular monolith through `AppModule`.

Current modules:

- `AuthModule`: registration, login, JWT validation.
- `UsersModule`: current user read endpoint.
- `CompaniesModule`: company profile and updates.
- `SubscriptionsModule`: plan limits, usage, plan changes.
- `ProjectsModule`: project CRUD and project ownership.
- `EnvironmentConfigsModule`: Docker Compose environment storage and visual config compiler.
- `SecretsModule`: project secret storage and encryption.
- `TestSuitesModule`: YAML/visual suite storage and visual flow compiler.
- `TestRunsModule`: REST API for creating, listing, reading, and cancelling runs.
- `RunnerModule`: in-process runner orchestration, Docker Compose management, healthchecks, HTTP step execution, assertions, variables, YAML parsing.
- `ReportsModule`: JSON report and runner log reads.
- `RealtimeModule`: Socket.IO gateway and event emission.
- `DashboardModule`: dashboard summary.
- `CommonModule`: guards, decorators, pagination, project access checks.
- `PrismaModule`: Prisma client lifecycle.

The current boundaries are pragmatic and mostly domain-oriented, but data access is still service-local through `PrismaService` rather than repository abstractions.

## Prisma Schema And Migrations

The source of truth is PostgreSQL through `testing-environment-backend/prisma/schema.prisma`.

Current enums:

- `UserRole`: `OWNER`, `ADMIN`, `DEVELOPER`, `VIEWER`.
- `SubscriptionPlanName`: `FREE`, `PRO`, `BUSINESS`, `ENTERPRISE`.
- `EnvironmentConfigType`: `DOCKER_COMPOSE`.
- `TestRunStatus`: durable run lifecycle from `CREATED` and `QUEUED` through runner phases
  (`PREPARING_WORKSPACE`, `VALIDATING_ENVIRONMENT`, `PULLING_IMAGES`,
  `STARTING_ENVIRONMENT`, `WAITING_FOR_HEALTHCHECK`, `EXECUTING_TESTS`,
  `COLLECTING_ARTIFACTS`, `CLEANING_UP`) to terminal states `PASSED`, `TEST_FAILED`,
  `INFRA_FAILED`, `TIMED_OUT`, or `CANCELLED`.
- `TestRunFailureCategory`: `TEST_ASSERTION`, `ENVIRONMENT_VALIDATION`, `IMAGE_PULL`,
  `CONTAINER_START`, `HEALTHCHECK`, `NETWORK`, `TIMEOUT`, `CANCELLED`, `INTERNAL`.
- `TestResultStatus`: `PASSED`, `FAILED`.
- `RunnerLogSource`: `SYSTEM`, `DOCKER`, `TEST`, `ERROR`.

Current core models:

- `Company`, `User`, `SubscriptionPlan`.
- `Project`.
- `EnvironmentConfig`: one mutable config per project, with `composeYaml`, `backendTestYaml`, and optional `visualConfig`.
- `Secret`.
- `TestSuite`: mutable suite rows with `yamlContent` and optional `visualFlow`.
- `TestRun`: run status, counters, timing, error message, related results and logs.
- `TestResult`: one persisted row per executed step/test case, including request and response body JSON.
- `RunnerLog`: one row per stored runner log message.

Current migrations:

- `20260701191600_init`
- `20260702120000_add_test_suite_visual_flow`
- `20260702123000_add_environment_visual_config`
- `20260703120000_add_test_step_result_fields`

Important gaps:

- No immutable environment revisions.
- No immutable suite revisions.
- `TestRun` does not reference execution snapshots or a canonical execution plan.
- Cancellation and queue state are not durable.
- Large response bodies and logs can still pressure PostgreSQL despite Docker logs being truncated before insertion.

## REST API Surface

Current protected resource endpoints are nested under projects where needed:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /users/me`
- `GET /companies/me`
- `PATCH /companies/me`
- `GET /subscriptions/plans`
- `PATCH /subscriptions/current`
- `GET /dashboard`
- `POST /projects`
- `GET /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `DELETE /projects/:id`
- `POST /projects/:projectId/environment-config`
- `GET /projects/:projectId/environment-config`
- `POST /projects/:projectId/environment-config/compile`
- `PATCH /projects/:projectId/environment-config`
- `POST /projects/:projectId/secrets`
- `GET /projects/:projectId/secrets`
- `DELETE /projects/:projectId/secrets/:secretId`
- `POST /projects/:projectId/test-suites`
- `GET /projects/:projectId/test-suites`
- `POST /projects/:projectId/test-suites/compile-flow`
- `GET /projects/:projectId/test-suites/:suiteId`
- `PATCH /projects/:projectId/test-suites/:suiteId`
- `DELETE /projects/:projectId/test-suites/:suiteId`
- `POST /projects/:projectId/test-runs`
- `GET /projects/:projectId/test-runs`
- `GET /projects/:projectId/test-runs/:runId`
- `POST /projects/:projectId/test-runs/:runId/cancel`
- `GET /projects/:projectId/test-runs/:runId/report`
- `GET /projects/:projectId/test-runs/:runId/logs`

Swagger decorators are present at controller/tag level, but DTO response contracts are not a complete typed OpenAPI contract for all returned shapes.

## Authentication And Authorization

Authentication:

- JWT access tokens are issued by `AuthService`.
- Passwords are hashed with bcrypt.
- `JwtStrategy` validates token identity against the current `User` row.
- Default development secret is `dev-secret-change-me` if `JWT_SECRET` is not configured.
- No refresh token rotation exists yet.

Authorization:

- `JwtAuthGuard` protects authenticated endpoints.
- `RolesGuard` enforces route-level `@Roles`.
- `ProjectAccessService.getProjectOrThrow(projectId, companyId)` checks tenant ownership for project-scoped flows.
- WebSocket subscription checks that the run belongs to the connecting user's company.

Tenant isolation is mostly enforced for project-nested endpoints, but this should remain a first-class audit item for every new resource ID endpoint.

## Error Handling

Current API error handling:

- `main.ts` registers a global `ValidationPipe` with whitelist, transform, and unknown-field rejection.
- `HttpExceptionFilter` provides a shared HTTP error response shape.
- Services generally throw Nest exceptions such as `NotFoundException`, `ForbiddenException`, `UnauthorizedException`, `ConflictException`, and `BadRequestException`.
- Runner execution stores structured lifecycle state, error logs, status reason, and failure category.

Important gaps:

- Runner errors now include `failureCategory`, but deeper platform error codes and metrics are still limited.
- Docker Compose failures can include large command output in exception messages.
- Worker failures are durable, but the original HTTP request still only observes asynchronous completion later.
- E2E coverage for error response shape and cross-tenant denial is limited.

## TestRun Lifecycle

Current lifecycle:

1. `POST /projects/:projectId/test-runs` calls `TestRunsService.create`.
2. The service validates project ownership and subscription limits.
3. It creates a `TestRun` row with `CREATED`.
4. It enqueues a BullMQ job and marks the run `QUEUED`.
5. The worker claims the job and marks the run `CLAIMED`.
6. The runner loads the run with project, environment config, and test suites.
7. It creates a local workspace.
8. It advances through durable phase statuses.
9. It writes Docker Compose, backend-test YAML, and suite YAML files.
10. It validates and starts Docker Compose.
11. It waits for healthcheck.
12. It executes suites and steps.
13. It stores `TestResult` rows.
14. It stores truncated Docker logs in `RunnerLog`.
15. It marks the run `PASSED`, `TEST_FAILED`, `INFRA_FAILED`, `TIMED_OUT`, or `CANCELLED`.
16. It stops Docker Compose and removes the workspace.

Important gaps:

- Worker crash recovery exists for queued jobs, but claimed/in-flight recovery still needs stronger lease handling.
- No idempotency key exists for run creation.
- Concurrent run creation can still race against subscription/concurrency limits because there is no database lock around active run capacity.
- Run execution reads mutable project config and mutable test suites at start time.

## RunnerOrchestratorService

`RunnerOrchestratorService` is the current execution coordinator.

Responsibilities:

- Load run, project, environment config, and suites.
- Create workspace under `RUNNER_WORKSPACE_ROOT` or `/tmp/backend-test-runner`.
- Persist lifecycle transitions.
- Write runtime YAML files.
- Delegate Docker Compose commands.
- Wait for healthcheck.
- Parse test suite YAML.
- Execute `apiRequest`, `wait`, and `pollUntil` steps.
- Interpolate variables.
- Evaluate status, JSON contains, and assertions.
- Save extracted response values into an in-memory variable store.
- Persist step results.
- Persist runner logs.
- Emit realtime events.
- Tear down workspace and Docker Compose.

This class currently mixes orchestration, state transitions, result persistence, cancellation checks, and realtime notification. It works for MVP scale, but the target state should separate durable job orchestration from step execution mechanics.

## Runner Start And Cancellation

Runner start:

- `TestRunsService.create()` creates a durable run and enqueues a BullMQ job.
- `TestRunQueueService` stores deterministic job IDs and enqueue timestamps.
- `TestRunQueueRecoveryService` re-enqueues recoverable `CREATED`/`QUEUED` runs.

Cancellation:

- `TestRunsService.cancel()` validates ownership and moves cancellable runs to `CANCEL_REQUESTED`.
- Queued jobs are removed and finalized as `CANCELLED` when possible.
- Worker polls persisted cancellation state and uses a per-run `AbortController`.
- HTTP requests, healthchecks, poll steps, waits, and Docker Compose startup observe cancellation.
- Worker renews an execution lease through heartbeat fields while the run is active.
- Expired active leases are recovered conservatively without automatically retrying potentially non-idempotent execution.

Gap: Docker cleanup can still fail at the host Docker daemon layer; cleanup errors are stored separately on the run.

## Docker Compose Manager

`DockerComposeManagerService` runs Docker CLI commands through `spawn('docker', args, { cwd })`.

Current commands:

- `docker compose -f docker-compose.test.yml up -d --build`
- `docker compose -f docker-compose.test.yml logs --no-color`
- `docker compose -f docker-compose.test.yml down -v`

Current validation rejects:

- Compose files without `services`.
- `privileged: true`.
- `network_mode: host`.
- Volumes whose source includes `/var/run/docker.sock`.
- Volumes whose source equals `/`.

Gap: this is an MVP guardrail, not a full policy for untrusted customer Docker Compose. It does not yet cover all dangerous capabilities, resource limits, image provenance, build restrictions, host path policy, network egress, secrets exposure, or sandboxed execution.

## WebSocket Event Model

Realtime uses Socket.IO namespace `/runs`.

Client flow:

1. Client connects with JWT through handshake auth or authorization header.
2. Gateway verifies JWT.
3. Client emits `subscribe` with `testRunId`.
4. Gateway confirms the run belongs to the user's company.
5. Server joins the client to a room named by test run ID.
6. Runner emits `runner.event`.

Current event types:

- `run.started`
- `environment.starting`
- `environment.ready`
- `test.started`
- `test.passed`
- `test.failed`
- `logs.updated`
- `environment.stopping`
- `run.finished`

Current message shape includes:

- `type`
- `testRunId`
- optional `payload`
- generated `message`
- generated `timestamp`

Gaps:

- No sequence number.
- No persisted event log.
- No replay after reconnect.
- No strict event schema version.

The current frontend correctly treats REST and React Query as source of truth and uses realtime events for live updates and query invalidation.

## EnvironmentConfig And TestSuite Storage

Environment configuration:

- Stored as one `EnvironmentConfig` per project.
- Supports manual YAML mode with `composeYaml` and `backendTestYaml`.
- Supports visual mode with `visualConfig`, compiled by backend into YAML.
- Updates use upsert by `projectId`.

Test suites:

- Stored as mutable `TestSuite` rows.
- Supports manual YAML mode via `yamlContent`.
- Supports visual mode via `visualFlow`, compiled by backend into `yamlContent`.

Gaps:

- Both are mutable.
- Test runs do not capture immutable revisions.
- There is no canonical execution plan table or artifact.

## Visual-To-YAML Compilers

`EnvironmentConfigCompilerService`:

- Validates environment visual config version `1.0`.
- Requires at least one service.
- Requires unique service names.
- Requires image or build context.
- Validates main service, base URL, and healthcheck path.
- Produces Docker Compose YAML and backend-test YAML.
- Emits warnings for dependencies on unknown services.

`FlowSuiteCompilerService`:

- Validates flow version `1.0`.
- Validates suite name, nodes, edges, request fields, assertions, wait duration, poll timeout and interval.
- Supports legacy API nodes without `type`.
- Topologically sorts nodes by edges.
- Rejects cycles and edges to missing nodes.
- Emits warnings for duplicate saved variable names.
- Compiles `apiRequest`, `wait`, and `pollUntil` nodes to suite YAML.

The compiler tests are among the stronger areas of the current test suite.

## Logs And Reports Storage

Reports:

- `ReportsService.report()` returns the run with project and ordered results.
- Frontend downloads this as JSON.
- Report reads verify project ownership by checking the parent project and then reading a run scoped by `projectId`.

Logs:

- `ReportsService.logs()` returns ordered `RunnerLog` rows.
- Docker logs are truncated to the last `20000` characters before insertion.
- Log reads also verify the parent project before returning logs for the run.

Gaps:

- Logs and response bodies remain in PostgreSQL.
- No object storage abstraction exists.
- No artifact retention or pruning policy is implemented in code.
- No size limit exists for individual response bodies before storing JSON.

## Frontend API Layer

The frontend uses Axios through `apiClient`.

Current behavior:

- `VITE_API_URL` defaults to `/api`.
- JWT is read from `tokenStorage` and added as a Bearer token.
- `401` clears token and redirects to `/login`.

Important compatibility adapters:

- `environment-configs.api.ts` maps backend `composeYaml` to frontend `dockerComposeYaml`.
- `test-suites.api.ts` maps backend `yamlContent` to frontend `yaml`.
- `test-runs.api.ts` maps backend `passedTests` and `failedTests` to frontend `passed` and `failed`.
- Paginated and legacy array responses are normalized through `PaginatedResultAdapter`.

These adapters are important backward compatibility surfaces and should be preserved until frontend/backend contracts are intentionally consolidated.

## TestRunDetailPage

`TestRunDetailPage`:

- Reads run details through React Query.
- Reads logs through React Query.
- Creates a `TestRunEventsClient`.
- Subscribes to Socket.IO events for the current run.
- Appends live events to local timeline state.
- Invalidates logs on `logs.updated`.
- Invalidates run and logs on `run.finished`.
- Supports run again, cancel, and JSON report download.
- Shows progress, timeline, logs, results table, and details drawer.

Gap: realtime event history is local-only and starts at page subscription time.

## EnvironmentEditor

`EnvironmentEditor`:

- Supports `config` and `yaml` modes.
- Visual config mode edits services, ports, environment variables, dependencies, app healthcheck, and run settings.
- Calls backend compile endpoint before saving visual config.
- Shows generated YAML preview and compiler warnings.
- Manual YAML mode validates YAML client-side and saves raw YAML.

Compatibility detail: existing YAML-only configs open in YAML mode, and users can switch toward configurable setup.

## FlowSuiteEditor

`FlowSuiteEditor`:

- Uses `@xyflow/react`.
- Supports API, wait, and poll nodes.
- Maintains nodes, edges, selected node, YAML preview, warnings, validation errors, and compile state.
- Calls backend compile endpoint for validation and YAML generation.
- Provides node inspector forms, assertions, variable picker, save variables, and auto layout.

Potential frontend concerns:

- The component is large and could later be split into smaller OOP/SOLID-aligned units.
- No frontend test suite exists around editor behavior.

## Tests And CI

Backend scripts:

- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:e2e`

Frontend scripts:

- `npm run lint`
- `npm run build`
- `npm run preview`

Current tests found:

- Backend unit tests for assertions, Docker Compose validation, variable store, environment compiler, environment config service, flow compiler, test suites service, subscriptions service.
- Backend e2e test for auth login.
- No frontend test script is configured in `testing-environment-frontend/package.json`.

CI:

- No GitHub Actions, GitLab CI, or similar workflow files were found during this audit.
- Docker Compose files exist for local/runtime orchestration, not CI.

## Documentation Differences Found

The existing documentation broadly matches the product workflow, but source inspection found several production-readiness gaps that are not always obvious from product docs:

- Test runs are started in-process, not through a durable job queue.
- Cancellation is in memory, not persisted.
- Environment and suite data are mutable and not revisioned.
- Realtime has no sequence numbers or replay.
- Docker Compose security validation is partial and explicitly MVP-level.
- PostgreSQL stores logs/results directly; no artifact/object storage abstraction exists.
- Frontend has compatibility adapters that should be treated as part of the current API contract.
- CI workflow files are absent.
