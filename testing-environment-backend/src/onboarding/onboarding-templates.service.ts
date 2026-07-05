import { Injectable } from '@nestjs/common';
import { EnvironmentConfigType } from '@prisma/client';
import { OnboardingTemplate } from './onboarding.types';

const NODE_POSTGRES_COMPOSE = `services:
  api:
    image: node:22-alpine
    working_dir: /app
    command: sh -c "npm install && npm run start"
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgres://app:app@postgres:5432/app
    depends_on:
      - postgres
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 10s
      timeout: 3s
      retries: 10

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
`;

const NEST_REDIS_COMPOSE = `services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgres://app:app@postgres:5432/app
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 10s
      timeout: 3s
      retries: 10

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app

  redis:
    image: redis:7-alpine
`;

const MICROSERVICES_COMPOSE = `services:
  gateway:
    build:
      context: ./gateway
    ports:
      - "8080:8080"
    depends_on:
      - users
      - orders
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 10s
      timeout: 3s
      retries: 10

  users:
    build:
      context: ./services/users
    environment:
      DATABASE_URL: postgres://app:app@postgres:5432/users
    depends_on:
      - postgres

  orders:
    build:
      context: ./services/orders
    environment:
      DATABASE_URL: postgres://app:app@postgres:5432/orders
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app

  redis:
    image: redis:7-alpine
`;

const BACKEND_TEST = `version: "1.0"
environment:
  type: "docker_compose"
  compose_file: "./docker-compose.test.yml"
tests:
  - "./tests/*.yml"
run:
  timeout_minutes: 10
  cleanup: true
`;

@Injectable()
export class OnboardingTemplatesService {
  list(): OnboardingTemplate[] {
    return [
      {
        id: 'node-postgres',
        name: 'Node.js API + PostgreSQL',
        description: 'Single Node.js HTTP API backed by PostgreSQL.',
        environmentType: EnvironmentConfigType.DOCKER_COMPOSE,
        composeYaml: NODE_POSTGRES_COMPOSE,
        backendTestYaml: BACKEND_TEST,
        project: this.project('Node API', 'http://localhost:3000', 'api', '/health'),
      },
      {
        id: 'nestjs-postgres-redis',
        name: 'NestJS API + PostgreSQL + Redis',
        description: 'NestJS service with database and Redis cache dependencies.',
        environmentType: EnvironmentConfigType.DOCKER_COMPOSE,
        composeYaml: NEST_REDIS_COMPOSE,
        backendTestYaml: BACKEND_TEST,
        project: this.project('NestJS API', 'http://localhost:3000', 'api', '/health'),
      },
      {
        id: 'microservices-readiness',
        name: 'Microservices readiness',
        description: 'Gateway plus internal services for readiness testing.',
        environmentType: EnvironmentConfigType.DOCKER_COMPOSE,
        composeYaml: MICROSERVICES_COMPOSE,
        backendTestYaml: BACKEND_TEST,
        project: this.project(
          'Microservices readiness',
          'http://localhost:8080',
          'gateway',
          '/health',
        ),
      },
      {
        id: 'existing-remote-api',
        name: 'Existing remote API without Compose',
        description: 'Run tests against an already reachable API.',
        environmentType: EnvironmentConfigType.EXTERNAL_URL,
        backendTestYaml: BACKEND_TEST,
        project: this.project('Existing API', 'https://api.example.com', 'external-api', '/health'),
      },
    ];
  }

  find(id: string): OnboardingTemplate | undefined {
    return this.list().find((template) => template.id === id);
  }

  demo(): OnboardingTemplate {
    return {
      ...this.find('node-postgres')!,
      id: 'sample-demo-project',
      name: 'Sample demo project',
      project: this.project('Sample Demo API', 'http://localhost:3000', 'api', '/health'),
    };
  }

  smokeSuiteYaml(path = '/health', expectedStatus = 200): string {
    return `suite: "Onboarding smoke test"
tests:
  - name: "Health check"
    request:
      method: GET
      path: "${path}"
    expect:
      status: ${expectedStatus}
`;
  }

  private project(name: string, baseUrl: string, mainServiceName: string, healthcheckPath: string) {
    return {
      name,
      baseUrl,
      mainServiceName,
      healthcheckPath,
      healthcheckExpectedStatus: 200,
      healthcheckTimeoutSeconds: 60,
    };
  }
}
