import * as yaml from 'js-yaml';
import { EnvironmentConfigCompilerService } from './environment-config-compiler.service';
import { EnvironmentVisualConfig } from './types/environment-visual-config.types';

describe('EnvironmentConfigCompilerService', () => {
  const service = new EnvironmentConfigCompilerService();

  it('compiles a single API service to Docker Compose YAML', () => {
    const result = service.compile({
      version: '1.0',
      services: [
        { name: 'api', image: 'api:latest', ports: [{ host: '8000', container: '8000' }] },
      ],
      app: {
        mainServiceName: 'api',
        baseUrl: 'http://localhost:8000',
        healthcheckPath: '/health',
        healthcheckExpectedStatus: 200,
        healthcheckTimeoutSeconds: 60,
      },
      run: { timeoutMinutes: 10, cleanup: true },
    });

    const compose = yaml.load(result.composeYaml) as {
      services: Record<string, { image: string; ports: string[] }>;
    };
    expect(compose.services.api.image).toBe('api:latest');
    expect(compose.services.api.ports).toEqual(['8000:8000']);
  });

  it('compiles API and postgres dependency with environment variables', () => {
    const result = service.compile(createVisualConfig());
    const compose = yaml.load(result.composeYaml) as {
      services: Record<string, { environment: Record<string, string>; depends_on?: string[] }>;
    };

    expect(compose.services.api.depends_on).toEqual(['postgres']);
    expect(compose.services.postgres.environment.POSTGRES_DB).toBe('app');
  });

  it('compiles backend-test YAML from app and run settings', () => {
    const result = service.compile(createVisualConfig());
    const backendTest = yaml.load(result.backendTestYaml) as {
      app: {
        service: string;
        healthcheck: { path: string; expected_status: number; timeout_seconds: number };
      };
      tests: string[];
      run: { timeout_minutes: number; cleanup: boolean };
    };

    expect(backendTest.app.service).toBe('api');
    expect(backendTest.app.healthcheck).toMatchObject({
      path: '/health',
      expected_status: 200,
      timeout_seconds: 60,
    });
    expect(backendTest.tests).toEqual(['./tests/*.yml']);
    expect(backendTest.run).toEqual({ timeout_minutes: 10, cleanup: true });
  });

  it('rejects duplicate service names', () => {
    const config = createVisualConfig();
    config.services.push({ name: 'api', image: 'another-api:latest' });

    expect(() => service.compile(config)).toThrow('Duplicate service name: api');
  });

  it('rejects services without image or build context', () => {
    const config = createVisualConfig();
    config.services[0] = { name: 'api' };

    expect(() => service.compile(config)).toThrow(
      'Service "api" must define image or build context',
    );
  });
});

function createVisualConfig(): EnvironmentVisualConfig {
  return {
    version: '1.0',
    services: [
      {
        name: 'api',
        image: 'api:latest',
        ports: [{ host: '8000', container: '8000' }],
        environment: [{ key: 'DATABASE_URL', value: 'postgres://user:pass@postgres:5432/app' }],
        dependsOn: ['postgres'],
      },
      {
        name: 'postgres',
        image: 'postgres:16',
        environment: [{ key: 'POSTGRES_DB', value: 'app' }],
      },
    ],
    app: {
      mainServiceName: 'api',
      baseUrl: 'http://localhost:8000',
      healthcheckPath: '/health',
      healthcheckExpectedStatus: 200,
      healthcheckTimeoutSeconds: 60,
    },
    run: { timeoutMinutes: 10, cleanup: true },
  };
}
