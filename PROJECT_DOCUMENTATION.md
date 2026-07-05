# Testing Environment Project - подробная документация

## 1. О чем этот проект

`Testing Environment Project` - это локальная full-stack платформа для настройки изолированного Docker Compose окружения, создания API test suites, запуска тестов и анализа результатов из браузера.

Проект решает задачу, когда команде нужно проверять backend-приложение не только отдельными unit/integration тестами, а сценариями, которые ближе к реальному пользовательскому или системному flow:

- поднять нужные сервисы через Docker Compose;
- дождаться готовности основного API через healthcheck;
- выполнить последовательность HTTP-запросов;
- передавать данные между шагами через сохраненные переменные;
- проверять статус-коды, JSON-фрагменты и assertions;
- видеть прогресс запуска в реальном времени;
- хранить результаты, логи и отчеты.

Главная продуктовая идея: пользователь работает с визуальными формами, flow builder или raw YAML в UI, а backend компилирует test suites в immutable `ExecutionPlan`; YAML остается форматом import/export и legacy compatibility.

### Основные пользователи

Потенциальные пользователи системы:

- backend-разработчик, которому нужно быстро описать API smoke/regression сценарии;
- QA engineer, который хочет собирать API-сценарии без ручного написания всего YAML;
- tech lead, которому нужно видеть историю тестовых прогонов по проектам;
- команда, которая тестирует сервисы локально или в self-hosted окружении.

### Основной пользовательский workflow

1. Пользователь регистрируется и создает компанию.
2. Пользователь создает проект.
3. В проекте настраивает test environment:
   - service list;
   - Docker image или build context;
   - ports;
   - environment variables;
   - dependencies;
   - app base URL;
   - healthcheck path/status/timeout;
   - run settings.
4. Backend компилирует visual config в:
   - `docker-compose.test.yml`;
   - `backend-test.yml`.
5. Пользователь создает test suite:
   - через visual flow builder;
   - или вручную через YAML.
6. Backend компилирует visual test flow или raw YAML в canonical execution plan и YAML export.
7. Пользователь запускает test run.
8. Backend:
   - создает изолированный workspace;
   - записывает runtime YAML-файлы окружения;
   - поднимает Docker Compose окружение;
   - ждет healthcheck;
   - выполняет test suites;
   - сохраняет результаты и логи;
   - отправляет realtime события во frontend.
9. Пользователь видит прогресс, timeline, logs, results table и details drawer.
10. Пользователь может скачать JSON report.

### Onboarding и первый успешный запуск

Новый пользователь после регистрации попадает в onboarding wizard. Wizard доступен также из sidebar через `Onboarding`.

Цель onboarding - привести пользователя к первому успешному test run за 10-15 минут:

1. заполнить project settings;
2. выбрать способ импорта окружения;
3. загрузить или вставить `docker-compose.yml`, выбрать template или указать уже запущенный API;
4. увидеть результат auto-detection;
5. подтвердить найденные services, ports, main service, base URL и security warnings;
6. сохранить project, environment revision и smoke test suite;
7. запустить первый run.

Backend анализирует Docker Compose статически через `js-yaml` и не запускает Compose во время import/analysis. Анализ возвращает services, images, build contexts, exposed ports, dependencies, environment variables, volumes, healthchecks, probable main service с confidence, probable base URL и security warnings.

Поддерживаемые templates:

- Node.js API + PostgreSQL;
- NestJS API + PostgreSQL + Redis;
- microservices readiness;
- existing remote API without Compose.

Для уже запущенного API используется `EnvironmentConfigType.EXTERNAL_URL`: runner пропускает Docker Compose lifecycle и выполняет healthcheck/test steps против `Project.baseUrl`.

Git repository import добавлен только как extension point. Git OAuth, repository cloning и полноценный импорт из репозитория не реализованы в этой фазе.

Onboarding progress хранится в PostgreSQL в `OnboardingSession`. Когда onboarding-created project впервые получает `PASSED` test run, backend записывает `timeToFirstSuccessfulRunMs` и экспортирует соответствующие Prometheus metrics.

### Технологический стек

Backend:

- NestJS 10;
- TypeScript;
- Prisma 5;
- PostgreSQL 16;
- Passport JWT;
- bcrypt;
- class-validator / class-transformer;
- Swagger;
- Socket.IO;
- js-yaml;
- Docker Compose через backend container и mounted Docker socket.

Frontend:

- React 18;
- Vite;
- TypeScript;
- Tailwind CSS;
- React Router;
- TanStack React Query;
- React Hook Form;
- Zod;
- Axios;
- Socket.IO client;
- React Flow (`@xyflow/react`);
- Lucide React icons;
- js-yaml.

Infrastructure:

- root `docker-compose.yml`;
- backend Dockerfile;
- frontend Dockerfile;
- nginx для production frontend;
- PostgreSQL volume;
- Docker socket mount для runner.

### Repository structure

```text
.
├── docker-compose.yml
├── README.md
├── PROJECT_DOCUMENTATION.md
├── testing-environment-backend
│   ├── prisma
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations
│   ├── src
│   │   ├── auth
│   │   ├── common
│   │   ├── companies
│   │   ├── dashboard
│   │   ├── environment-configs
│   │   ├── prisma
│   │   ├── projects
│   │   ├── reports
│   │   ├── runner
│   │   ├── secrets
│   │   ├── subscriptions
│   │   ├── test-runs
│   │   ├── test-suites
│   │   ├── users
│   │   ├── websocket
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── package.json
└── testing-environment-frontend
    ├── src
    │   ├── api
    │   ├── app
    │   ├── components
    │   ├── editors
    │   ├── features
    │   ├── forms
    │   ├── layout
    │   ├── lib
    │   ├── pages
    │   ├── routes
    │   ├── tables
    │   ├── types
    │   ├── main.tsx
    │   └── styles.css
    └── package.json
```

## 2. Backend ecosystem, architecture и подробная документация модулей

### Архитектурный стиль backend

Backend - это модульный монолит на NestJS.

Это правильный выбор для текущей стадии проекта:

- один deployable artifact;
- простая локальная разработка;
- явные NestJS-модули;
- единая PostgreSQL база;
- прямые синхронные HTTP endpoints;
- realtime слой только для прогресса test run;
- runner orchestration внутри backend процесса.

Проект пока не требует микросервисов. Доменные границы уже видны через модули, но физически система остается монолитом. Это соответствует KISS: меньше operational complexity, проще дебажить, проще развивать MVP.

### Backend application bootstrap

Файл: `testing-environment-backend/src/main.ts`

Backend bootstrap делает следующее:

- создает Nest application;
- включает CORS;
- подключает global `ValidationPipe`;
- включает `whitelist`, чтобы DTO принимали только описанные поля;
- включает `forbidNonWhitelisted`, чтобы неизвестные поля отклонялись;
- включает `transform`, чтобы query/body приводились к DTO-типам;
- регистрирует global `HttpExceptionFilter`;
- поднимает Swagger на `/docs`;
- запускает сервер на `PORT`, по умолчанию `3000`.

Это хороший baseline для API:

- DTO validation централизована;
- ошибка имеет единый формат;
- Swagger доступен для ручного исследования API;
- CORS включен для frontend/backend split.

### Backend module map

Файл: `testing-environment-backend/src/app.module.ts`

Root module подключает:

- `ConfigModule`;
- `PrismaModule`;
- `CommonModule`;
- `AuthModule`;
- `UsersModule`;
- `CompaniesModule`;
- `DashboardModule`;
- `SubscriptionsModule`;
- `ProjectsModule`;
- `EnvironmentConfigsModule`;
- `EnvironmentImportModule`;
- `OnboardingModule`;
- `SecretsModule`;
- `TestSuitesModule`;
- `TestRunsModule`;
- `RunnerModule`;
- `ReportsModule`;
- `RealtimeModule`.

Фактические bounded contexts:

- Identity and access: `auth`, `users`, `common/guards`, `common/decorators`;
- Organization/account: `companies`, `subscriptions`;
- Project configuration: `projects`, `environment-configs`, `secrets`;
- Test authoring: `test-suites`;
- Test execution: `test-runs`, `runner`;
- Observability/reporting: `reports`, `dashboard`, `websocket`.

### Data model

Файл: `testing-environment-backend/prisma/schema.prisma`

Основная база данных: PostgreSQL.

#### Enums

`UserRole`:

- `OWNER`;
- `ADMIN`;
- `DEVELOPER`;
- `VIEWER`.

Роли уже заложены, но текущая authorization модель в основном использует company/project ownership checks и `RolesGuard`, когда endpoint помечен `@Roles`.

`SubscriptionPlanName`:

- `FREE`;
- `PRO`;
- `BUSINESS`;
- `ENTERPRISE`.

`EnvironmentConfigType`:

- `DOCKER_COMPOSE`.

Сейчас поддерживается только Docker Compose. Enum оставляет возможность добавить другие типы runtime окружений.

`TestRunStatus`:

- `CREATED`;
- `QUEUED`;
- `CLAIMED`;
- `PREPARING_WORKSPACE`;
- `VALIDATING_ENVIRONMENT`;
- `PULLING_IMAGES`;
- `STARTING_ENVIRONMENT`;
- `WAITING_FOR_HEALTHCHECK`;
- `EXECUTING_TESTS`;
- `COLLECTING_ARTIFACTS`;
- `CLEANING_UP`;
- `PASSED`;
- `TEST_FAILED`;
- `INFRA_FAILED`;
- `TIMED_OUT`;
- `CANCEL_REQUESTED`;
- `CANCELLED`.

`TestRunFailureCategory`:

- `TEST_ASSERTION`;
- `ENVIRONMENT_VALIDATION`;
- `IMAGE_PULL`;
- `CONTAINER_START`;
- `HEALTHCHECK`;
- `NETWORK`;
- `TIMEOUT`;
- `CANCELLED`;
- `INTERNAL`.

`TestResultStatus`:

- `PASSED`;
- `FAILED`.

`RunnerLogSource`:

- `SYSTEM`;
- `DOCKER`;
- `TEST`;
- `ERROR`.

#### User

Пользователь принадлежит компании.

Поля:

- `id`;
- `email`;
- `passwordHash`;
- `firstName`;
- `lastName`;
- `role`;
- `companyId`;
- timestamps.

Важные детали:

- `email` уникален;
- связь с `Company` удаляется cascade;
- есть index по `companyId`.

#### Company

Компания является tenant boundary.

Поля:

- `id`;
- `name`;
- `subscriptionPlanId`;
- `users`;
- `projects`;
- timestamps.

Компания владеет пользователями и проектами. Большинство бизнес-операций ограничиваются `companyId`.

#### SubscriptionPlan

План подписки хранит лимиты:

- `maxProjects`;
- `maxRunsPerMonth`;
- `maxConcurrentRuns`;
- `maxRunnerMinutes`;
- `reportRetentionDays`.

Планы seed-ятся backend startup flow через Prisma seed.

#### Project

Проект - центральный aggregate для тестовой конфигурации.

Поля:

- `companyId`;
- `name`;
- `description`;
- `baseUrl`;
- `mainServiceName`;
- `healthcheckPath`;
- `healthcheckExpectedStatus`;
- `healthcheckTimeoutSeconds`;
- `environmentConfig`;
- `secrets`;
- `testSuites`;
- `testRuns`;
- timestamps.

Проект принадлежит компании. Все test suites, environment config, secrets и runs привязаны к project.

#### EnvironmentConfig

Хранит runtime конфигурацию проекта.

Поля:

- `projectId` unique;
- `type`;
- `composeYaml`;
- `backendTestYaml`;
- `visualConfig`;
- timestamps.

Система поддерживает два режима:

- visual config, который компилируется в YAML;
- manual YAML mode.

#### Secret

Хранит секреты проекта.

Поля:

- `projectId`;
- `key`;
- `encryptedValue`;
- timestamps.

Важные constraints:

- `@@unique([projectId, key])`;
- index по `projectId`.

#### TestSuite

Хранит тестовый набор.

Поля:

- `projectId`;
- `name`;
- `yamlContent`;
- `visualFlow`;
- timestamps.

Как и environment config, suite может быть создан из visual flow или вручную через YAML.

#### TestRun

Хранит один запуск тестов.

Поля:

- `projectId`;
- `status`;
- `startedAt`;
- `finishedAt`;
- `totalTests`;
- `passedTests`;
- `failedTests`;
- `durationMs`;
- `errorMessage`;
- `results`;
- `logs`;
- timestamps.

Indexes:

- `projectId`;
- `status`;
- `createdAt`.

#### TestResult

Хранит результат отдельного step/test case.

Поля:

- `testRunId`;
- `stepId`;
- `stepType`;
- `suiteName`;
- `testName`;
- `status`;
- `method`;
- `path`;
- `expectedStatus`;
- `actualStatus`;
- `attempts`;
- `durationMs`;
- `requestBody`;
- `responseBody`;
- `errorMessage`;
- `createdAt`.

Наличие `stepId` и `stepType` связывает result с visual flow node.

#### RunnerLog

Хранит logs запуска.

Поля:

- `testRunId`;
- `source`;
- `message`;
- `createdAt`.

### Authentication and authorization

#### AuthModule

Основные файлы:

- `auth.controller.ts`;
- `auth.service.ts`;
- `jwt.strategy.ts`;
- DTO: `register.dto.ts`, `login.dto.ts`.

Endpoints:

- `POST /auth/register`;
- `POST /auth/login`;
- `GET /auth/me`.

`AuthService.register`:

- проверяет уникальность email;
- ищет `FREE` subscription plan;
- хеширует password через bcrypt с cost `12`;
- в transaction создает company и owner user;
- возвращает access token и user без `passwordHash`.

`AuthService.login`:

- ищет user по lowercased email;
- сравнивает password через bcrypt;
- возвращает access token и safe user.

JWT payload:

- `sub`;
- `email`;
- `companyId`;
- `role`.

JWT expires через env `JWT_EXPIRES_IN`, default `15m`.

Текущая модель использует short-lived access token, но refresh token rotation пока отсутствует.

#### Common auth utilities

`JwtAuthGuard` защищает endpoints.

`CurrentUser` decorator достает authenticated user.

`RolesGuard` проверяет роли, если handler/class помечен `@Roles`.

`ProjectAccessService` централизует проверку:

- project exists;
- project belongs to current company.

Это важный security boundary, потому что project является tenant-owned ресурсом.

### Common module

Содержит reusable pieces:

- decorators;
- guards;
- filters;
- pagination DTO;
- shared interfaces;
- `ProjectAccessService`.

`HttpExceptionFilter` возвращает единый error response:

```json
{
  "statusCode": 400,
  "timestamp": "ISO_DATE",
  "path": "/request/path",
  "error": "message or object"
}
```

### PrismaModule

`PrismaService` является data access adapter поверх Prisma Client.

Сейчас repositories как отдельный слой не выделены. Сервисы напрямую используют `PrismaService`. Для текущего MVP это приемлемо и просто. Если бизнес-логика и queries станут сложнее, можно эволюционно выделить repositories по bounded contexts:

- `ProjectsRepository`;
- `TestRunsRepository`;
- `TestSuitesRepository`;
- `SubscriptionsRepository`.

### CompaniesModule

Endpoints:

- `GET /companies/me`;
- `PATCH /companies/me`.

Назначение:

- получение profile текущей company;
- обновление company name/settings;
- расчет members count;
- возврат subscription plan и usage.

Этот модуль представляет account-level настройки.

### SubscriptionsModule

Endpoints:

- `GET /subscriptions/plans`;
- `PATCH /subscriptions/current`.

`SubscriptionsService` отвечает за:

- список планов;
- смену плана;
- проверку лимитов перед созданием project;
- проверку лимитов перед запуском test run.

Проверяемые лимиты:

- количество проектов;
- количество runs в текущем месяце;
- количество concurrent runs.

Важная деталь: смена плана сейчас локальная и временная. В комментарии указано, что позже это должно подтверждаться через Stripe checkout/webhook state.

### ProjectsModule

Endpoints:

- `POST /projects`;
- `GET /projects`;
- `GET /projects/:id`;
- `PATCH /projects/:id`;
- `DELETE /projects/:id`.

`ProjectsService`:

- перед созданием вызывает `subscriptions.assertCanCreateProject`;
- list endpoint поддерживает pagination;
- все operations ограничены `companyId`;
- delete удаляет project, а связанные configs/suites/runs удаляются cascade через Prisma relations.

Project fields используются не только как metadata, но и как runner settings:

- `baseUrl`;
- `mainServiceName`;
- `healthcheckPath`;
- `healthcheckExpectedStatus`;
- `healthcheckTimeoutSeconds`.

### EnvironmentConfigsModule

Endpoints:

- `POST /projects/:projectId/environment-config`;
- `GET /projects/:projectId/environment-config`;
- `POST /projects/:projectId/environment-config/compile`;
- `PATCH /projects/:projectId/environment-config`.

Назначение:

- хранение Docker Compose test environment;
- поддержка manual YAML mode;
- поддержка visual config mode;
- компиляция visual config в YAML;
- валидация shape и базовых business constraints.

#### EnvironmentConfigCompilerService

Compiler принимает `EnvironmentVisualConfig`:

```ts
{
  version: '1.0',
  services: EnvironmentServiceConfig[],
  app: EnvironmentAppConfig,
  run: EnvironmentRunConfig
}
```

Validation:

- config должен быть object;
- version должен быть `1.0`;
- services должен быть непустым массивом;
- каждый service должен иметь name;
- service names должны быть уникальны;
- service должен иметь `image` или `buildContext`;
- `mainServiceName` должен совпадать с одним из services;
- `baseUrl` обязателен;
- `healthcheckPath` обязателен.

Warnings:

- service depends on unknown service.

Compiler генерирует:

- Docker Compose object with `services`;
- backend-test runtime YAML:

```yaml
version: '1.0'
environment:
  type: docker_compose
  compose_file: ./docker-compose.test.yml
app:
  service: MAIN_SERVICE
  base_url: BASE_URL
  healthcheck:
    path: HEALTHCHECK_PATH
    expected_status: 200
    timeout_seconds: 60
tests:
  - ./tests/*.yml
run:
  timeout_minutes: 10
  cleanup: true
```

### SecretsModule

Endpoints:

- `POST /projects/:projectId/secrets`;
- `GET /projects/:projectId/secrets`;
- `DELETE /projects/:projectId/secrets/:secretId`.

Назначение:

- управление project secrets;
- хранение encrypted value.

Есть `SecretCryptoService`, который отвечает за encryption/decryption. В модели данных сохраняется `encryptedValue`, то есть plaintext не должен храниться в базе.

Важно для production:

- env `SECRET_ENCRYPTION_KEY` должен быть сильным ключом;
- ключ не должен быть hardcoded;
- нужна стратегия rotation;
- list endpoint не должен возвращать plaintext secret values.

### TestSuitesModule

Endpoints:

- `POST /projects/:projectId/test-suites`;
- `GET /projects/:projectId/test-suites`;
- `POST /projects/:projectId/test-suites/compile-flow`;
- `POST /projects/:projectId/test-suites/import/preview`;
- `POST /projects/:projectId/test-suites/import/generate-flow`;
- `GET /projects/:projectId/test-suites/:suiteId`;
- `PATCH /projects/:projectId/test-suites/:suiteId`;
- `DELETE /projects/:projectId/test-suites/:suiteId`.

Назначение:

- CRUD для test suites;
- хранение RAW YAML suite;
- хранение visual flow;
- компиляция visual flow в canonical execution plan и YAML export.
- stateless API import preview/generate pipeline для OpenAPI, Postman, Bruno, cURL и manual requests.

API import не сохраняет и не публикует suite автоматически. Preview endpoint нормализует импортированные requests в `ImportedApiOperation`, показывает warnings, detected auth schemes и suggested secret references. Generate endpoint принимает выбранные operations и template, создаёт draft `FlowSuiteDefinition` и YAML preview через существующий compiler. Literal credentials заменяются на `{{ secret.KEY }}`, Bruno/Postman scripts/hooks не исполняются, external OpenAPI refs не загружаются по сети, destructive methods требуют explicit acknowledgement.

#### FlowSuiteCompilerService

Compiler принимает `FlowSuiteDefinition`:

```ts
{
  version: '1.0',
  suiteName: string,
  nodes: FlowNode[],
  edges: FlowEdge[]
}
```

Поддерживаемые node types:

- `apiRequest`;
- `wait`;
- `pollUntil`.

Validation:

- flow должен быть object;
- version должен быть `1.0`;
- suite name обязателен;
- должен быть хотя бы один node;
- edges должны быть массивом;
- каждый node должен иметь id;
- node ids должны быть уникальны;
- каждый node должен иметь name;
- API/poll nodes должны иметь method и path;
- wait node должен иметь `durationMs > 0`;
- poll node должен иметь `timeoutSeconds > 0`;
- poll node должен иметь `intervalSeconds > 0`;
- poll interval не может быть больше timeout;
- assertions должны иметь `fieldPath` и `operator`;
- edges должны ссылаться на существующие nodes;
- flow не должен содержать cycle.

Sorting:

- nodes сортируются topological sort по edges;
- nodes без incoming edge становятся стартовыми;
- cycle приводит к `BadRequestException`.

Warnings:

- если одна и та же variable сохраняется несколькими steps.

Compiled YAML shape:

```yaml
suite: Example suite
tests:
  - id: node-1
    type: apiRequest
    name: Health check
    request:
      method: GET
      path: /status/200
      expect:
        status: 200
  - id: node-2
    type: wait
    name: Wait
    wait:
      duration_ms: 1000
  - id: node-3
    type: pollUntil
    name: Poll status
    poll:
      request:
        method: GET
        path: /status
        expect:
          status: 200
      timeout_seconds: 30
      interval_seconds: 2
```

### TestRunsModule

Endpoints:

- `POST /projects/:projectId/test-runs`;
- `GET /projects/:projectId/test-runs`;
- `GET /projects/:projectId/test-runs/:runId`;
- `POST /projects/:projectId/test-runs/:runId/cancel`.

`TestRunsService.create`:

- проверяет project access;
- проверяет subscription limits;
- создает `TestRun` со статусом `CREATED`;
- ставит durable BullMQ job и переводит run в `QUEUED`;
- сразу возвращает run.

Runner выполняется worker process через durable queue.

`TestRunsService.cancel`:

- проверяет run;
- переводит cancellable run в `CANCEL_REQUESTED`;
- удаляет queued job и завершает `CANCELLED`, если job еще не активен;
- для active job сохраняет cancellation в PostgreSQL, worker завершает run как `CANCELLED`.

### RunnerModule

Runner - ядро проекта.

Основные сервисы:

- `RunnerOrchestratorService`;
- `DockerComposeManagerService`;
- `HealthcheckService`;
- `YamlTestParserService`;
- `HttpTestExecutorService`;
- `AssertionEngineService`;
- `VariableStoreService`.

#### RunnerOrchestratorService

Главный orchestration flow:

1. Находит `TestRun` по id.
2. Загружает связанный project, environmentConfig и testSuites.
3. Проверяет, что environment config существует.
4. Проверяет, что есть хотя бы один test suite.
5. Создает workspace:

```text
RUNNER_WORKSPACE_ROOT/testRunId
```

6. Claim-ит queued run и переводит его через durable phase statuses.
7. Пишет system log.
8. Emits `run.started`.
9. Валидирует compose YAML через Docker service.
10. Записывает:

```text
docker-compose.test.yml
backend-test.yml
tests/{suiteId}.yml
```

11. Emits `environment.starting`.
12. Запускает `docker compose up`.
13. Ждет healthcheck:

```text
baseUrl + healthcheckPath
```

14. Emits `environment.ready`.
15. Выполняет suites.
16. Собирает docker logs.
17. Сохраняет docker logs в `RunnerLog`.
18. Emits `logs.updated`.
19. Вычисляет final status:

- `CANCELLED`, если run был cancelled;
- `TEST_FAILED`, если есть failed tests/assertion failures;
- `INFRA_FAILED`, если произошла platform/environment ошибка;
- `TIMED_OUT`, если достигнут execution timeout;
- `PASSED`, если все passed.

20. Обновляет `TestRun` final stats.
21. В finally:

- emits `environment.stopping`;
- вызывает `docker down`;
- удаляет workspace;
- удаляет run id из cancelled set;
- emits `run.finished`.

#### Cancellation model

Cancellation хранится в памяти:

```ts
private readonly cancelledRuns = new Set<string>();
```

Runner регулярно вызывает `ensureNotCancelled(testRunId)`:

- перед стартом environment;
- перед healthcheck;
- перед каждым test;
- внутри wait sleep loop;
- внутри poll loop.

Ограничение: если backend process перезапустится, in-memory cancellation state будет потерян.

#### Step execution

Поддерживаются три типа step:

`apiRequest`:

- интерполирует variables;
- выполняет HTTP request;
- оценивает status/body/assertions;
- сохраняет variables из response при success.

`wait`:

- ждет заданное количество milliseconds;
- возвращает passed result.

`pollUntil`:

- выполняет HTTP request с интервалом;
- повторяет до success или timeout;
- учитывает cancellation между попытками.

#### HttpTestExecutorService

HTTP execution:

- строит URL через `new URL(request.path, baseUrl)`;
- добавляет query params;
- method uppercase;
- JSON body сериализуется через `JSON.stringify`;
- content-type default `application/json`;
- headers merge с request headers;
- timeout через `AbortController`;
- response body парсится как JSON, fallback - string;
- error возвращается в `errorMessage`, а не бросается наружу.

#### AssertionEngineService

Судя по использованию, отвечает за:

- проверку `json_contains`;
- выполнение assertions;
- чтение значений по JSON path;
- поддержку save variables.

Supported assertion operators видны во frontend types:

- `equals`;
- `contains`;
- `exists`.

#### VariableStoreService

Отвечает за:

- создание variable store для run;
- interpolation значений вида `{{ variable }}`;
- замену variables в request definition.

Variables живут в памяти в рамках одного test run execution.

#### DockerComposeManagerService

Отвечает за:

- validation compose YAML;
- `docker compose up`;
- `docker compose down`;
- получение docker logs.

Backend container получает доступ к Docker через mounted socket:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

Это удобно для local MVP, но важно понимать security implication: контейнер с Docker socket фактически получает высокий контроль над host Docker daemon.

### ReportsModule

Endpoints:

- `GET /projects/:projectId/test-runs/:runId/report`;
- `GET /projects/:projectId/test-runs/:runId/logs`.

Назначение:

- отдавать JSON report по test run;
- отдавать runner logs.

Frontend использует report endpoint для скачивания `test-run-{runId}.json`.

### DashboardModule

Endpoint:

- `GET /dashboard`.

Назначение:

- summary по компании;
- recent runs;
- passed/failed counts;
- subscription plan summary.

### RealtimeModule / WebSocket

Состоит из:

- `realtime.gateway.ts`;
- `realtime.service.ts`;
- `realtime.module.ts`.

Runner emits события:

- `run.started`;
- `environment.starting`;
- `environment.ready`;
- `test.started`;
- `test.passed`;
- `test.failed`;
- `logs.updated`;
- `environment.stopping`;
- `run.finished`.

Frontend подписывается на run-specific events через `TestRunEventsClient`.

Realtime используется правильно: не как source of truth, а как live feedback layer. Источник правды остается PostgreSQL.

### API surface summary

Auth:

- `POST /auth/register`;
- `POST /auth/login`;
- `GET /auth/me`.

Users:

- `GET /users/me`.

Companies:

- `GET /companies/me`;
- `PATCH /companies/me`.

Subscriptions:

- `GET /subscriptions/plans`;
- `PATCH /subscriptions/current`.

Dashboard:

- `GET /dashboard`.

Projects:

- `POST /projects`;
- `GET /projects`;
- `GET /projects/:id`;
- `PATCH /projects/:id`;
- `DELETE /projects/:id`.

Environment configs:

- `POST /projects/:projectId/environment-config`;
- `GET /projects/:projectId/environment-config`;
- `POST /projects/:projectId/environment-config/compile`;
- `PATCH /projects/:projectId/environment-config`.

Secrets:

- `POST /projects/:projectId/secrets`;
- `GET /projects/:projectId/secrets`;
- `DELETE /projects/:projectId/secrets/:secretId`.

Test suites:

- `POST /projects/:projectId/test-suites`;
- `GET /projects/:projectId/test-suites`;
- `POST /projects/:projectId/test-suites/compile-flow`;
- `GET /projects/:projectId/test-suites/:suiteId`;
- `PATCH /projects/:projectId/test-suites/:suiteId`;
- `DELETE /projects/:projectId/test-suites/:suiteId`.

Test runs:

- `POST /projects/:projectId/test-runs`;
- `GET /projects/:projectId/test-runs`;
- `GET /projects/:projectId/test-runs/:runId`;
- `POST /projects/:projectId/test-runs/:runId/cancel`.

Reports:

- `GET /projects/:projectId/test-runs/:runId/report`;
- `GET /projects/:projectId/test-runs/:runId/logs`.

### Sync vs async paths

Synchronous request/response paths:

- auth;
- projects CRUD;
- environment config CRUD/compile;
- test suite CRUD/compile;
- reports/logs download;
- dashboard;
- subscriptions.

Async path:

- `POST /test-runs` создает run и запускает runner async;
- runner продолжает execution после HTTP response;
- progress доставляется через Socket.IO;
- persisted state доступен через `GET /test-runs/:runId`.

Это хорошее разделение: запуск может быть долгим, поэтому HTTP request не держит весь test execution.

### Security model

Текущая security модель:

- JWT authentication;
- password hashing через bcrypt;
- DTO validation;
- company/project access checks;
- subscription limits;
- encrypted secrets;
- no plaintext `passwordHash` in auth responses;
- CORS enabled;
- Swagger с bearer auth.

Риски и зоны усиления:

- `JWT_SECRET` в docker-compose demo должен быть заменен в production;
- refresh token flow отсутствует;
- token revocation отсутствует;
- Docker socket mount опасен в multi-tenant или untrusted environment;
- Docker Compose YAML может быть рискованным, если пользователи недоверенные;
- нужно ограничивать resource usage runner workspace/container;
- нужна audit trail для destructive operations;
- нужна более строгая authorization matrix по ролям;
- secrets key rotation пока не описан;
- realtime authorization нужно проверить отдельно.

### Scalability and bottlenecks

Главные bottlenecks:

- Docker daemon и concurrent compose environments;
- PostgreSQL при большом количестве logs/results;
- backend process, потому что runner выполняется внутри него;
- memory для in-process cancellation и variable stores;
- filesystem `/tmp/backend-test-runner`;
- Socket.IO connections при множестве live runs.

Эволюция без преждевременного overengineering:

1. Оптимизировать queries и indexes по runs/results.
2. Добавить retention cleanup для old logs/results.
3. Ограничить log size и result payload size.
4. Ввести queue для runner jobs, например BullMQ/Redis или RabbitMQ.
5. Вынести runner в отдельный worker process.
6. Добавить distributed cancellation state.
7. Только после этого рассматривать отдельный runner service.

### Observability

Уже есть:

- persisted `RunnerLog`;
- `RunnerLogSource`;
- final run status/stats;
- realtime events.

Чего не хватает для production:

- structured logs на backend level;
- correlationId/requestId;
- metrics: run duration, pass rate, queue wait time, docker startup time, healthcheck time;
- tracing для request -> runner job -> results;
- alerts по failed runner jobs и stuck active TestRun phases.

### Testing coverage

В backend есть unit/e2e tests:

- auth e2e;
- environment config compiler specs;
- environment configs service specs;
- assertion engine specs;
- docker compose manager specs;
- variable store specs;
- flow suite compiler specs;
- test suites service specs;
- subscriptions service specs.

Тесты покрывают важные compiler/runner primitives. Для усиления стоит добавить:

- test run orchestration happy path с mocked Docker;
- cancellation scenarios;
- subscription edge cases;
- project tenant isolation;
- report/log access isolation;
- frontend component tests для critical forms/editors.

## 3. Frontend architecture и UI/UX решения

### Frontend architecture overview

Frontend - React SPA на Vite.

Entry point:

- `src/main.tsx`.

Root providers:

- `QueryClientProvider`;
- `BrowserRouter`;
- `ThemeProvider`;
- `ToastProvider`;
- `AuthProvider`;
- `App`.

Routing:

- `src/app/App.tsx`;
- React Router routes;
- protected area через `ProtectedRoute`;
- common dashboard shell через `DashboardLayout`.

Frontend organized by responsibility:

- `api` - API clients;
- `app` - routing root;
- `components/ui` - reusable UI primitives;
- `components/modals` - modals;
- `editors` - YAML editor;
- `features` - domain-specific interactive features;
- `forms` - forms;
- `layout` - sidebar/topbar/dashboard layout;
- `lib` - utilities;
- `pages` - route-level screens;
- `routes` - route guards;
- `tables` - table components;
- `types` - shared frontend types.

### Frontend data flow

Server state:

- managed through TanStack React Query;
- queries use resource-specific API clients;
- mutations invalidate related query keys;
- loading/error states rendered at page/section level.

Client state:

- auth token in `tokenStorage`;
- auth user through `AuthProvider`;
- theme through `ThemeProvider`;
- toasts through `ToastProvider`;
- form/editor local state in page or feature components;
- flow graph state local to `FlowSuiteEditor`;
- live run events local to `TestRunDetailPage`.

Network:

- `api/client.ts` wraps Axios;
- base URL: `VITE_API_URL` or `/api`;
- request interceptor injects bearer token;
- response interceptor handles `401` by clearing token and redirecting to `/login`.

### Routing map

Public routes:

- `/login`;
- `/register`.

Protected routes:

- `/dashboard`;
- `/projects`;
- `/projects/new`;
- `/projects/:projectId/edit`;
- `/projects/:projectId`;
- `/projects/:projectId/environment`;
- `/projects/:projectId/test-suites`;
- `/projects/:projectId/test-suites/new`;
- `/projects/:projectId/test-suites/:suiteId`;
- `/projects/:projectId/runs`;
- `/projects/:projectId/runs/:runId`;
- `/settings/company`;
- `/settings/subscription`.

Fallback:

- unknown route redirects to `/dashboard`.

### Layout and navigation

`DashboardLayout`:

- full-height page background;
- skip link to `#main`;
- fixed/sidebar layout on medium screens;
- topbar;
- centered max-width main content.

Accessibility-positive decisions:

- skip link exists;
- main landmark has `id="main"`;
- buttons are real `button`;
- forms use labels in many places;
- focus ring utility is centralized.

### Design system and styling

Styling uses Tailwind plus CSS variables.

Tokens in `styles.css`:

- border;
- page;
- surface;
- elevated;
- ink;
- muted;
- brand;
- input;
- code background;
- code text.

Theme:

- light tokens on `:root`;
- dark tokens on `:root[data-theme='dark']`;
- compatibility overrides for common `bg-white`, `slate`, `blue` classes.

Reusable classes:

- `.focus-ring`;
- `.input`;
- `.panel`;
- `.text-code`.

UI primitives:

- `Button`;
- `LinkButton`;
- `PageHeader`;
- `StatCard`;
- `UsageCard`;
- `StatusBadge`;
- `LoadingState`;
- `EmptyState`;
- `ErrorState`;
- `ToastProvider`;
- `ConfirmDialog`.

The project uses a quiet SaaS/operator-tool style:

- dense dashboard layout;
- restrained cards/panels;
- strong table/list flows;
- status badges;
- icons in buttons;
- no marketing landing page inside the application.

### Auth UX

Auth pages:

- login;
- register.

Auth flow:

- successful login/register stores JWT;
- auth provider refetches current user;
- protected routes require authenticated state;
- logout clears token and redirects to login;
- 401 globally clears token and redirects.

Potential improvement:

- avoid direct `window.location.href` where React navigation could handle it;
- add refresh token strategy;
- improve session expired toast/message;
- avoid treating "token exists but user query failed" as authenticated for too long.

### Projects UX

Projects pages support:

- list projects;
- create project;
- edit project;
- project details.

Project form captures runtime-critical values:

- name;
- description;
- baseUrl;
- mainServiceName;
- healthcheckPath;
- expected status;
- timeout seconds.

These fields directly influence runner behavior.

### Environment editor UX

Feature:

- `src/features/environment/EnvironmentEditor.tsx`.

Modes:

- `Config`;
- `YAML`.

Config mode:

- form-driven setup;
- services list;
- image/build context/dockerfile;
- command;
- ports;
- environment variables;
- dependencies;
- app/healthcheck panel;
- run settings panel;
- compile/validate button;
- generated YAML preview.

YAML mode:

- raw `docker-compose.test.yml`;
- raw `backend-test.yml`;
- YAML validation via `YamlValidator`;
- useful for advanced/manual configuration.

UX strengths:

- visual mode reduces YAML mistakes;
- YAML preview gives transparency;
- warnings are visible;
- destructive service removal checks dependents;
- config mode can generate runtime YAML consistently.

Potential improvements:

- use accessible custom confirmation dialog instead of `window.confirm`;
- show field-level validation before backend compile;
- support secret reference insertion;
- prevent save race where compile updates YAML state asynchronously and save uses stale local state;
- add clearer disabled/loading states for long compile/save operations.

### Test suite editor UX

Feature:

- `src/features/test-suites/FlowSuiteEditor.tsx`;
- `src/features/test-suites/TestSuiteEditor.tsx`.
- `src/features/test-suites/ApiImportWizard.tsx`.

Modes:

- `Flow`;
- `YAML`.

Flow mode uses React Flow:

- left toolbar for adding node types;
- central canvas;
- right node inspector;
- generated YAML preview;

Import wizard lets users paste/upload supported API sources, preview normalized operations, review warnings and suggested secrets, choose operations/templates, confirm destructive requests, and generate a local draft flow. Saving still happens through the existing suite save action.
- validation warnings/errors.

Supported node types:

- API request;
- wait;
- poll until.

API node fields:

- method;
- path;
- headers;
- query params;
- JSON body;
- expected status;
- assertions;
- save variables.

Poll node adds:

- timeout seconds;
- retry interval seconds;
- failure message.

Wait node adds:

- duration milliseconds.

UX strengths:

- makes test scenario authoring visual;
- supports variables from previous steps;
- compile button validates through backend, so frontend and backend logic stay consistent;
- YAML preview makes generated artifact inspectable;
- auto layout helps organize graph.

Potential improvements:

- keyboard shortcuts for canvas actions;
- accessible alternatives for graph editing;
- undo/redo;
- copy/paste step;
- better validation linking errors to specific fields;
- prevent duplicate edge ambiguity if linear execution is expected;
- make branching semantics explicit, because compiler currently topologically sorts nodes rather than representing conditional branches.

### Test run detail UX

Page:

- `src/pages/TestRunDetailPage.tsx`.

Components:

- `TestRunProgress`;
- `TestRunTimeline`;
- `LogsPanel`;
- `TestResultsTable`;
- `TestResultDetailsDrawer`.

Data:

- run query loads persisted run/results;
- logs query loads persisted logs;
- Socket.IO client appends live events;
- `logs.updated` invalidates logs query;
- `run.finished` invalidates run and logs.

Actions:

- run again;
- cancel run;
- download JSON.

UX strengths:

- separates summary/progress/timeline/logs/table/details;
- realtime updates do not replace persisted source of truth;
- drawer allows deep result inspection without leaving run page;
- download report supports sharing/debugging.

Potential improvements:

- show reconnection state;
- cap live event list size;
- auto-scroll logs with user-controlled pause;
- confirm cancellation;
- render response bodies with syntax highlighting and copy button;
- show docker startup/healthcheck/test execution phase durations.

### Subscription UX

Subscription page uses:

- current company plan;
- list of plans;
- usage cards;
- change plan mutation.

Backend enforces limits, frontend presents plan/usage. This is correct: UI helps, backend decides.

Current limitation:

- plan switching is local, no payment provider integration yet.

### Frontend API clients

The `api` directory separates resource clients:

- `auth.api.ts`;
- `companies.api.ts`;
- `projects.api.ts`;
- `environment-configs.api.ts`;
- `test-suites.api.ts`;
- `test-runs.api.ts`;
- `reports.api.ts`;
- `subscriptions.api.ts`;
- `test-run-events.client.ts`;
- `client.ts`;
- `paginated-result.ts`.

This is clean and KISS-friendly. It keeps pages/features focused on behavior and state, not URL construction.

### Frontend types

`src/types/index.ts` mirrors backend concepts:

- `RunStatus`;
- `SubscriptionTier`;
- `UserRole`;
- `User`;
- `Company`;
- `SubscriptionPlan`;
- `CompanyUsage`;
- `CompanyProfile`;
- `Project`;
- `EnvironmentConfig`;
- `EnvironmentVisualConfig`;
- `TestSuite`;
- `FlowSuiteDefinition`;
- `FlowNode`;
- `TestRun`;
- `TestResult`;
- `RunnerLog`;
- `DashboardSummary`;
- `TestRunEvent`.

This gives strong UI contracts. Long-term, generated API types from OpenAPI/Swagger could reduce drift between backend and frontend.

### Loading, empty, error and success states

Existing reusable pieces:

- `LoadingState`;
- `EmptyState`;
- `ErrorState`;
- `ToastProvider`.

Observed pattern:

- pages use React Query loading/error branches;
- mutations show toast on success/error;
- tables/sections show empty state when no data exists;
- editors show validation warnings.

Potential improvement:

- standardize all list pages around one paginated list state pattern;
- add skeletons only where useful;
- normalize backend error parsing through `ErrorPresenter`.

### Accessibility notes

Positive:

- semantic layout landmarks in dashboard;
- skip link;
- real buttons/inputs/selects;
- centralized focus-visible ring;
- many labels are explicit;
- icons generally accompany text in important buttons.

Risks:

- React Flow graph interactions can be hard for keyboard/screen reader users;
- modals/drawers need focus trap verification;
- `window.confirm` is not design-system consistent;
- color-coded statuses need text labels everywhere;
- code/YAML preview should remain keyboard scrollable and readable;
- some icon buttons need consistent `aria-label`.

### Frontend performance

Current performance is likely fine for MVP.

Potential concerns:

- React Flow can get heavy with many nodes;
- logs/results can grow large;
- full response bodies in table/detail can increase memory;
- Socket.IO events can accumulate in local state;
- Vite SPA ships all app routes unless code splitting is added.

Evolution:

- virtualize large result/log tables only after measured need;
- cap event list;
- paginate results/logs backend-side if they grow;
- lazy-load heavy pages/editors;
- split React Flow editor bundle.

## 4. Deployment and runtime behavior

Root `docker-compose.yml` defines:

### postgres

- image: `postgres:16-alpine`;
- database: `backend_test_runner`;
- port: `5432`;
- healthcheck via `pg_isready`;
- persistent volume `postgres_data`.

### backend

- builds from `testing-environment-backend`;
- exposes `3000`;
- env:
  - `DATABASE_URL`;
  - `JWT_SECRET`;
  - `JWT_EXPIRES_IN`;
  - `SECRET_ENCRYPTION_KEY`;
  - `RUNNER_WORKSPACE_ROOT`;
  - `RUNNER_REQUEST_TIMEOUT_MS`;
  - `RUNNER_DEFAULT_TIMEOUT_MINUTES`;
- depends on postgres health;
- mounts:
  - `/tmp/backend-test-runner`;
  - `/var/run/docker.sock`;
- healthcheck against `/docs`.

### frontend

- builds from `testing-environment-frontend`;
- served through nginx;
- exposes `80`;
- depends on backend;
- healthcheck against `/`.

### Local URLs

- Frontend: `http://localhost`;
- Backend: `http://localhost:3000`;
- Swagger: `http://localhost:3000/docs`;
- PostgreSQL: `localhost:5432`.

## 5. Важные архитектурные выводы

### Что уже хорошо

- Модульный монолит выбран правильно для стадии MVP.
- Доменные границы понятны по NestJS-модулям.
- PostgreSQL и Prisma подходят текущей модели данных.
- Runner execution вынесен из HTTP response path.
- Visual editors компилируются backend-ом, что снижает расхождение логики frontend/backend.
- Realtime events используются как feedback layer, а не как источник правды.
- DTO validation включена глобально.
- Project/company access вынесен в общий сервис.
- Subscription limits enforcement находится на backend.
- UI имеет понятную структуру pages/features/components/api/lib.

### Главные технические риски

- Runner работает внутри backend process.
- Cancellation state хранится in-memory.
- Docker socket mount опасен для недоверенных пользователей.
- Refresh token/revocation отсутствуют.
- Нет job queue для test runs.
- Большие logs/results могут перегружать БД и frontend.
- OpenAPI types не генерируются, возможен drift типов.
- Ролевая модель заложена, но может быть не полностью применена на всех endpoints.

### Что обсуждать с ChatGPT дальше

Полезные темы для дальнейшего обсуждения:

- как безопаснее изолировать runner;
- когда стоит выносить runner в worker;
- какую queue выбрать для test runs;
- как сделать cancellation устойчивым к restart;
- как спроектировать refresh token rotation;
- как ограничить Docker Compose возможности для untrusted users;
- как хранить и маскировать secrets;
- как добавить retention policy для reports/logs;
- как генерировать frontend types из Swagger;
- как улучшить accessibility React Flow editor;
- как добавить team/member management и RBAC matrix;
- как интегрировать Stripe plans через checkout/webhooks;
- как добавить audit logs;
- как сделать report format стабильным и versioned.

## 6. Рекомендуемый roadmap

### Short term

1. Добавить больше backend tests для tenant isolation и runner cancellation.
2. Добавить confirm dialog для cancel run.
3. Ограничить размер logs и response bodies.
4. Улучшить error presentation в frontend.
5. Проверить все endpoints на project/company access.
6. Добавить generated API types или shared contract package.

### Medium term

1. Вынести runner execution в queue worker.
2. Добавить Redis/BullMQ или другой job backend.
3. Сделать cancellation persisted/distributed.
4. Добавить run timeout enforcement на orchestration level.
5. Добавить retention cleanup jobs.
6. Добавить metrics и structured logs.
7. Добавить refresh tokens.

### Long term

1. Отделить control plane от runner plane.
2. Поддержать remote runners.
3. Добавить organization users/invites/RBAC.
4. Добавить billing provider.
5. Поддержать несколько environment providers.
6. Добавить шаблоны test suites и reusable steps.
7. Добавить versioned report schema.

## 7. Краткое резюме для передачи в ChatGPT

Это full-stack локальная платформа для конфигурации Docker Compose test environment, визуального создания API test flows и запуска их как backend test runs. Backend построен как NestJS modular monolith с Prisma/PostgreSQL, JWT auth, subscription limits, environment/test-suite compilers, Docker Compose runner и Socket.IO realtime events. Frontend построен как React/Vite SPA с React Query, React Router, Tailwind, feature-based structure, visual environment editor, React Flow based suite editor, run progress/timeline/logs/results UI.

Главная архитектурная идея: UI хранит structured visual config или RAW YAML, backend компилирует test suites в canonical execution plan, runner создает isolated workspace, поднимает Docker Compose, выполняет HTTP/wait/poll/setVariable/assert steps, сохраняет results/logs и сообщает progress через realtime. Система сейчас хорошо подходит для MVP/локального self-hosted usage, но для production/multi-tenant эксплуатации нужно усилить runner isolation, queue-based execution, security вокруг Docker socket, token lifecycle, RBAC, observability и retention.
