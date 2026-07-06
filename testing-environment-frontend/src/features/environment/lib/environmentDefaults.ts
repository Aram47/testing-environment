import type { EnvironmentServiceConfig, EnvironmentVisualConfig } from '../../../types';

export function createDefaultVisualConfig(): EnvironmentVisualConfig {
  return {
    version: '1.0',
    services: [
      {
        name: 'api',
        image: 'your-company/backend-api:latest',
        ports: [{ host: '8000', container: '8000' }],
        environment: [{ key: 'DATABASE_URL', value: 'postgres://user:pass@postgres:5432/app' }],
        dependsOn: ['postgres'],
      },
      {
        name: 'postgres',
        image: 'postgres:16',
        environment: [
          { key: 'POSTGRES_USER', value: 'user' },
          { key: 'POSTGRES_PASSWORD', value: 'pass' },
          { key: 'POSTGRES_DB', value: 'app' },
        ],
      },
    ],
    app: {
      mainServiceName: 'api',
      baseUrl: 'http://localhost:8000',
      healthcheckPath: '/health',
      healthcheckExpectedStatus: 200,
      healthcheckTimeoutSeconds: 60,
    },
    run: {
      timeoutMinutes: 10,
      cleanup: true,
    },
  };
}

export function createEmptyService(index: number): EnvironmentServiceConfig {
  return {
    name: `service-${index}`,
    image: '',
    ports: [],
    environment: [],
    dependsOn: [],
  };
}
