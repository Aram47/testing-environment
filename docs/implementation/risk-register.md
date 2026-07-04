# Risk Register

## Risk Matrix

Severity:

- Critical: can cause tenant data exposure, arbitrary host compromise, or unrecoverable execution corruption.
- High: can lose runs, break reproducibility, or create major operational incidents.
- Medium: can create degraded UX, scaling limits, or difficult support cases.
- Low: localized issue with straightforward workaround.

Likelihood:

- High: likely under normal use or growth.
- Medium: plausible under load, failure, or common configuration.
- Low: uncommon or requires specific conditions.

## R1: In-Process Fire-And-Forget Execution

Severity: High

Likelihood: High

Current state:

- `TestRunsService.create()` creates a run and calls `runner.start(run.id)`.
- Execution runs in the API process without BullMQ/Redis.

Impact:

- API process crash can leave runs stuck in `PENDING` or `RUNNING`.
- No retry, stalled job recovery, or operational queue visibility.

Mitigation:

- Introduce durable TestRun state transitions.
- Add BullMQ/Redis queue.
- Move execution to a separate runner worker.
- Add idempotent job enqueue and database-backed run claim.

Owner area:

- `test-runs`, `runner`.

## R2: Cancellation Is In Memory

Severity: High

Likelihood: High

Current state:

- Cancellation uses `Set<string>` inside `RunnerOrchestratorService`.
- Cancel endpoint directly updates run to `CANCELLED`.

Impact:

- Cancellation is lost on process restart.
- Separate worker process cannot observe API-process memory.
- Run status can show cancelled while underlying work is still stopping.

Mitigation:

- Persist cancellation request in PostgreSQL.
- Add `CANCELLING` lifecycle state.
- Worker checks durable cancellation before and during long operations.
- Mark final `CANCELLED` only after cleanup completes or a recovery job records cleanup failure.

Owner area:

- `test-runs`, `runner`.

## R3: Mutable Environment And Suite Inputs

Severity: High

Likelihood: High

Current state:

- `EnvironmentConfig` and `TestSuite` rows are mutable.
- `TestRun` does not reference immutable revisions.

Impact:

- Runs are not fully reproducible.
- Reports cannot prove exactly which config and suite content were executed after later edits.

Mitigation:

- Add immutable environment and suite revisions.
- Create and attach revisions before run enqueue.
- Build canonical execution plan from revisions.

Owner area:

- `environment-configs`, `test-suites`, `test-runs`.

## R4: No Canonical Execution Plan

Severity: High

Likelihood: Medium

Current state:

- Runner loads project aggregate and parses YAML during execution.

Impact:

- Execution contract is implicit.
- Future worker/agent boundaries will be harder to secure and test.
- Reported execution can drift from authoring data.

Mitigation:

- Persist versioned execution plan JSON and hash.
- Make runner consume the plan.

Owner area:

- `test-runs`, `runner`.

## R5: Docker Compose Security Is MVP-Level

Severity: Critical

Likelihood: Medium

Current state:

- Validation rejects a small set of dangerous settings.
- Code comment explicitly states hosted SaaS must not run untrusted customer containers on a shared Docker host.

Impact:

- Malicious or accidental Compose configuration can compromise host or neighboring workloads.
- Docker socket mounted into backend container increases host-level risk.

Mitigation:

- Introduce versioned Docker Compose security policy.
- Run hosted untrusted workloads in isolated VMs or customer-hosted agents.
- Restrict builds, host mounts, capabilities, devices, host namespaces, and network modes.

Owner area:

- `runner`, deployment.

## R6: Logs And Response Bodies In PostgreSQL

Severity: High

Likelihood: Medium

Current state:

- `RunnerLog` stores messages in PostgreSQL.
- `TestResult` stores `requestBody` and `responseBody` JSON.
- Docker logs are truncated to the last `20000` characters before insertion.

Impact:

- Large payloads can inflate database size.
- Reports and run detail queries can become slow.
- Retention and deletion are hard to manage.

Mitigation:

- Add artifact storage abstraction.
- Store large bodies/logs outside PostgreSQL.
- Keep metadata, hashes, summaries, and retention timestamps in PostgreSQL.

Owner area:

- `reports`, `runner`, storage.

## R7: Realtime Events Are Not Sequenced Or Replayable

Severity: Medium

Likelihood: High

Current state:

- Socket.IO emits live `runner.event` messages with generated timestamp.
- Events are not persisted and have no sequence.

Impact:

- Reconnected clients can miss events.
- Timeline ordering depends on live delivery.
- Debugging progress gaps is difficult.

Mitigation:

- Add persisted `TestRunEvent` table.
- Assign per-run sequence numbers.
- Add REST endpoint to fetch events since sequence.
- Enforce a unique `(testRunId, sequence)` constraint and idempotent event writes.

Owner area:

- `websocket`, `test-runs`, frontend run detail.

## R8: Tenant Ownership Must Remain Exhaustive

Severity: Critical

Likelihood: Medium

Current state:

- Project-scoped services generally use `ProjectAccessService`.
- WebSocket subscription checks run ownership through project company.
- New endpoints can accidentally bypass ownership if not routed through project checks.

Impact:

- Cross-tenant data exposure.

Mitigation:

- Require ownership checks for every resource ID endpoint.
- Add tests for forbidden cross-company access.
- Prefer nested queries that include tenant/company criteria.
- Include artifacts and event history endpoints in the same ownership test matrix.

Owner area:

- All API modules.

## R9: Role-Based Permissions Are Coarse

Severity: Medium

Likelihood: Medium

Current state:

- `RolesGuard` checks route-level roles.
- Project-level ABAC policies are not centralized beyond company ownership.

Impact:

- Permission rules can drift by controller.
- Future granular permissions will be hard to audit.

Mitigation:

- Keep `RolesGuard` for baseline RBAC.
- Add a small policy service for project actions before adding complex permission behavior.

Owner area:

- `common`, all controllers.

## R10: JWT Defaults And Token Lifecycle

Severity: Medium

Likelihood: Medium

Current state:

- JWT secret falls back to development default.
- Access token expiry defaults to `15m`.
- No refresh token rotation or revocation strategy exists.

Impact:

- Misconfigured production deployment can use weak default secret.
- Users must re-login after expiry.
- Token compromise response is limited.

Mitigation:

- Fail production startup without `JWT_SECRET`.
- Add refresh token rotation when product requires longer sessions.
- Document token revocation approach.

Owner area:

- `auth`, deployment config.

## R11: Frontend/Backend Contract Drift

Severity: Medium

Likelihood: High

Current state:

- Frontend adapters normalize old and new names for environment config, test suites, and test run counters.
- Backend DTO response contracts are not fully formalized.

Impact:

- Removing adapters or changing response shape can silently break UI.
- Swagger may not fully represent runtime responses.

Mitigation:

- Preserve adapters during migration.
- Add API contract tests or generated types later.
- Update Swagger DTOs when response shape changes.

Owner area:

- Frontend `api`, backend controllers/DTOs.

## R12: Frontend Editor Complexity

Severity: Medium

Likelihood: Medium

Current state:

- `FlowSuiteEditor` and `EnvironmentEditor` contain substantial state and UI logic.
- Frontend tests are not configured.

Impact:

- Regressions in visual authoring can be missed.
- Components may become difficult to evolve safely.

Mitigation:

- Add frontend test framework.
- Cover API adapters and critical editor flows.
- Extract focused components only when behavior changes justify it.

Owner area:

- Frontend `features/environment`, `features/test-suites`.

## R13: CI Is Missing

Severity: Medium

Likelihood: High

Current state:

- No CI workflow files were found.
- Checks are available as npm scripts but not automated.

Impact:

- Regressions can enter branches without consistent validation.

Mitigation:

- Add CI workflow for backend lint/build/test/e2e and frontend lint/build/tests when configured.
- Add migration validation.

Owner area:

- Repository operations.

## R14: Subscription Limits And Worker Concurrency

Severity: Medium

Likelihood: Medium

Current state:

- `SubscriptionsService.assertCanStartRun` gates run creation.
- Execution itself is not queued, so concurrency is bounded by process behavior rather than a queue scheduler.

Impact:

- Race conditions can allow more concurrent runs than plan limits.
- API process can be overloaded by simultaneous execution.

Mitigation:

- Enforce concurrency at queue claim time.
- Use database transactions or locks for active run counts.
- Configure BullMQ worker concurrency per deployment.

Owner area:

- `subscriptions`, `test-runs`, queue worker.

## R14A: Missing Idempotency For Unsafe Mutations

Severity: Medium

Likelihood: Medium

Current state:

- Run creation and queue enqueue do not use client idempotency keys.
- Runner event/result writes are not modeled as idempotent operations.

Impact:

- Client retries can create duplicate runs.
- Worker retries can duplicate events or results unless guarded by future constraints.

Mitigation:

- Use `testRunId` as queue job ID.
- Add optional idempotency keys for unsafe API mutations where clients retry.
- Add unique constraints for event sequence and stable step result identity after execution plans exist.

Owner area:

- `test-runs`, `runner`, API layer.

## R15: Report Retention Not Enforced

Severity: Medium

Likelihood: Medium

Current state:

- Subscription plans include `reportRetentionDays`.
- No audited retention job was found for pruning reports/logs/artifacts.

Impact:

- Storage grows indefinitely.
- Plan retention promises may not be enforced.

Mitigation:

- Add scheduled retention job after artifact metadata exists.
- Delete or archive logs/results/artifacts according to plan.

Owner area:

- `reports`, `subscriptions`, storage.

## R16: Docker Workspace Cleanup Can Fail

Severity: Medium

Likelihood: Medium

Current state:

- Runner attempts `docker compose down -v` and `rm(workspace, { recursive: true, force: true })` in `finally`.
- Failures are logged but not represented as durable cleanup tasks.

Impact:

- Orphaned containers, volumes, or workspace files can accumulate.

Mitigation:

- Add cleanup state and retryable cleanup jobs.
- Label Docker Compose resources by test run ID.
- Add periodic janitor for stale resources.

Owner area:

- `runner`, worker operations.
