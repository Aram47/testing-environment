# Implementation Roadmap

This roadmap breaks the target architecture into small pull-request-sized phases. Do not start the next large phase automatically; finish, verify, and report each phase first.

## Phase 0: Architecture Documentation And Baseline Verification

Scope:

- Add architecture and implementation docs.
- Record current-state gaps and target-state direction.
- Do not change runtime behavior.

Dependencies:

- Current source tree.

Database changes:

- None.

API changes:

- None.

Frontend changes:

- None.

Tests:

- Run `git diff --check`.
- Run configured backend lint/build/unit/e2e tests.
- Run configured frontend lint/build.
- Note that frontend tests are not configured.

Migration risks:

- None.

Rollback strategy:

- Revert docs-only commit.

## Phase 1: TestRun State Machine Service

Scope:

- Introduce a dedicated service for valid `TestRun` transitions.
- Keep existing statuses initially to reduce blast radius.
- Centralize transition checks for create, start, finish, fail, and cancel.
- Make repeated terminal transitions no-op or explicit errors according to one documented rule.
- Add tests for valid and invalid transitions.

Dependencies:

- Current `TestRunsService`.
- Current `RunnerOrchestratorService`.

Database changes:

- None for first PR.

API changes:

- None.

Frontend changes:

- None.

Tests:

- Unit tests for transition service.
- Race-oriented unit tests for duplicate start/finish attempts.
- Existing runner and test-run tests.

Migration risks:

- Low; behavior should be equivalent if transitions are mapped correctly.

Rollback strategy:

- Revert service extraction and call sites.

## Phase 2: Durable Cancellation Flag

Scope:

- Persist cancellation request on `TestRun`.
- Replace in-memory-only cancellation with database-backed checks.
- Keep the in-memory set only as an optimization if useful.
- Ensure cancel endpoint is idempotent for terminal or already cancelling runs.
- Avoid immediately marking active runs `CANCELLED` until worker cleanup has completed.

Dependencies:

- Phase 1 state transition service.

Database changes:

- Add cancellation metadata fields, for example `cancelRequestedAt` and optionally `cancelledByUserId`.

API changes:

- Keep `POST /projects/:projectId/test-runs/:runId/cancel`.
- Response may include cancellation metadata.

Frontend changes:

- No required UI change.
- Optionally show cancelling state later if exposed.

Tests:

- Service tests for idempotent cancellation.
- Runner tests proving cancellation survives service-level checks.
- Controller/e2e coverage for tenant ownership and role checks.
- Error handling tests for cancelling missing, foreign-tenant, and terminal runs.

Migration risks:

- Low additive migration.

Rollback strategy:

- Stop reading new fields, then drop fields in a later migration if needed.

## Phase 3: Immutable Environment And Suite Revisions

Scope:

- Add immutable revision tables.
- Create a revision when saving or before running.
- Keep editable `EnvironmentConfig` and `TestSuite` as current authoring records.
- Preserve manual YAML and visual authoring modes.

Dependencies:

- Stable compiler behavior.

Database changes:

- Add `EnvironmentConfigRevision`.
- Add `TestSuiteRevision`.
- Add content hash, compiled YAML, optional visual JSON, compiler version, author, timestamps.

API changes:

- Existing config and suite endpoints remain compatible.
- Optional response fields can expose latest revision metadata.

Frontend changes:

- None required for first revision PR.

Tests:

- Revision creation tests for YAML mode.
- Revision creation tests for visual mode.
- Compatibility tests for existing create/update behavior.

Migration risks:

- Medium; existing rows need a first revision or lazy revision creation at first run.

Rollback strategy:

- Keep existing mutable fields as source of truth until cutover is complete.
- Revert code to mutable reads if revision path fails.

## Phase 4: Canonical Execution Plan

Scope:

- Build a canonical plan from immutable revisions before enqueue/start.
- Store plan JSON and hash.
- Runner reads the plan instead of mutable project config and suites.
- Keep parser/compiler internals simple and versioned.

Dependencies:

- Phase 3 revisions.

Database changes:

- Add `ExecutionPlan` or `TestRunExecutionPlan`.
- Add references from `TestRun` to plan and revisions.

API changes:

- Existing run endpoints remain compatible.
- Run detail may include plan metadata, not full large plan by default.

Frontend changes:

- None required initially.

Tests:

- Plan builder tests.
- Reproducibility test: editing suite after run creation does not change execution.
- Runner tests using plan input.

Migration risks:

- Medium; runner input changes from project aggregate to execution plan.

Rollback strategy:

- Feature flag runner plan consumption.
- Keep old mutable loading path during rollout.

## Phase 5: BullMQ Durable Queue

Scope:

- Add Redis and BullMQ.
- Enqueue test run execution jobs instead of fire-and-forget `runner.start()`.
- Make job ID idempotent by `testRunId`.
- Add worker processor inside the monolith first, behind a clear module boundary.
- Add database-backed run claim so duplicate jobs or retries cannot execute the same run twice.

Dependencies:

- Phase 1 state transitions.
- Prefer Phase 4 execution plan, but this can be introduced before full worker split if needed.

Database changes:

- Add queue metadata fields if needed: `queuedAt`, `workerId`, `attempt`.

API changes:

- `POST /test-runs` still returns a run.
- Status should become queued/pending-compatible for current frontend.

Frontend changes:

- No required first change.

Tests:

- Queue producer unit tests.
- Processor tests with mocked runner.
- Integration test for create-run enqueue path.
- Duplicate enqueue and duplicate worker claim tests.
- Subscription concurrency race tests.

Migration risks:

- Medium; requires Redis in local/dev/deploy environments.

Rollback strategy:

- Keep old direct start path behind feature flag until queue is stable.
- Keep queue metadata additive until the direct start path is fully removed.

## Phase 6: Separate Runner Worker Process

Scope:

- Move BullMQ processor into a separate worker entrypoint/process.
- Keep shared execution code in backend package or a small internal module.
- API process enqueues and reports state only.

Dependencies:

- Phase 5 BullMQ queue.

Database changes:

- Add worker heartbeat/lease fields if not already present.

API changes:

- None.

Frontend changes:

- None.

Tests:

- Worker bootstrap test where practical.
- Queue processor tests.
- Manual Docker Compose smoke test.

Migration risks:

- Medium-high operational risk: deployment now has API, worker, PostgreSQL, Redis.

Rollback strategy:

- Run processor in API process via feature flag if worker deployment fails.

## Phase 7: Docker Compose Security Policy V1

Scope:

- Replace MVP validation with a versioned policy service.
- Add deny/allow rules for dangerous Compose fields.
- Return clear validation errors.
- Keep policy strict but compatible with current examples.

Dependencies:

- Current Docker Compose manager.

Database changes:

- Optional: store policy version on execution plan/run.

API changes:

- Compile/save/run may return stricter validation errors.

Frontend changes:

- Show policy validation errors in environment editor.

Tests:

- Extensive unit tests for denied fields.
- Tests for allowed sample compose files.

Migration risks:

- Medium; existing user configs may become invalid.

Rollback strategy:

- Introduce warning mode first.
- Enforce after documentation and UI messaging are in place.

## Phase 8: Artifact Storage Abstraction

Scope:

- Introduce artifact storage service with local filesystem implementation.
- Store large Docker logs and response bodies as artifacts.
- Keep PostgreSQL metadata and small summaries.

Dependencies:

- Current reports/logs endpoints.

Database changes:

- Add `Artifact` table.
- Add optional artifact references from logs/results/reports.
- Include company/project/run ownership columns or relations needed for authorization checks.

API changes:

- Existing report/log endpoints remain compatible for normal UI use.
- Add artifact download endpoint if needed.
- Artifact download endpoint must authorize through the parent project/run, not by artifact ID alone.

Frontend changes:

- Keep logs panel working.
- Add download/open artifact affordance only when artifact references exist.

Tests:

- Artifact service tests.
- Reports service tests for artifact-backed logs.
- Retention metadata tests.
- Cross-tenant artifact access denial tests.

Migration risks:

- Medium; old PostgreSQL rows and new artifacts must coexist.

Rollback strategy:

- Continue reading old inline fields.
- Write inline summaries until artifact path is trusted.

## Phase 9: Sequenced Realtime Events

Scope:

- Persist runner events with per-run sequence number.
- Emit Socket.IO messages from sequenced events.
- Add REST read path for events since sequence.
- Frontend reconnect can fetch missed events.

Dependencies:

- Phase 1 state machine.
- Prefer Phase 5/6 worker separation.

Database changes:

- Add `TestRunEvent` table with `sequence`, `type`, `payload`, `schemaVersion`.
- Add a unique constraint on `(testRunId, sequence)` and an idempotency key or `eventId`.

API changes:

- Add `GET /projects/:projectId/test-runs/:runId/events`.
- Socket.IO event payload gains `sequence` and `eventId`.

Frontend changes:

- Store last sequence per detail page session.
- On reconnect, fetch missed events before resubscribing or after connection resumes.

Tests:

- Event sequencing tests.
- Tenant ownership tests for event REST endpoint.
- Duplicate event write/idempotency tests.
- Frontend client tests once a frontend test framework exists.

Migration risks:

- Low-medium; old live-only behavior can coexist.

Rollback strategy:

- Keep emitting current live event shape while adding fields.

## Phase 10: Frontend Contract Consolidation And Tests

Scope:

- Add frontend test framework.
- Cover API adapters and critical run detail/editor flows.
- Gradually align frontend types with backend DTOs while preserving compatibility adapters.

Dependencies:

- Stable API contracts from prior phases.

Database changes:

- None.

API changes:

- None unless contract cleanup is explicitly scheduled.

Frontend changes:

- Add tests for `test-runs.api`, `test-suites.api`, `environment-configs.api`, `TestRunEventsClient`.
- Add component tests for `TestRunDetailPage`, `EnvironmentEditor`, `FlowSuiteEditor` where feasible.

Tests:

- New frontend unit/component test script.
- Existing frontend build and lint.

Migration risks:

- Low.

Rollback strategy:

- Remove test-only tooling if it blocks pipeline, without changing runtime code.

## Phase 11: CI Pipeline

Scope:

- Add CI workflow for backend and frontend checks.
- Include lint, build, unit tests, e2e tests where environment permits.
- Add migration validation.

Dependencies:

- Stable package scripts.

Database changes:

- None.

API changes:

- None.

Frontend changes:

- None.

Tests:

- CI runs backend lint/build/test/e2e.
- CI runs frontend lint/build/tests if configured.

Migration risks:

- Low; pipeline may reveal existing failures.

Rollback strategy:

- Temporarily mark flaky environment-dependent jobs as separate non-blocking jobs with tracked follow-up, not by disabling tests silently.

## Phase 12: Customer-Hosted Runner Agent Design Spike

Scope:

- Produce design and minimal proof of concept for a customer-hosted runner agent.
- Do not replace hosted runner path.
- Define agent registration, job claim, artifact upload, event upload, and cancellation protocol.

Dependencies:

- Durable queue, execution plan, artifacts, and event sequencing.

Database changes:

- Add runner agent registration tables only if moving beyond design spike.

API changes:

- Agent-only endpoints for registration, heartbeat, job claim, event/result upload.

Frontend changes:

- None for spike.

Tests:

- Contract tests for agent endpoints if implemented.

Migration risks:

- Medium security risk; agent credentials and tenant binding must be correct.

Rollback strategy:

- Keep feature behind disabled-by-default flag until production hardening is complete.
