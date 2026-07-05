import { EnvironmentImportAnalyzerService } from './environment-import-analyzer.service';

describe('EnvironmentImportAnalyzerService', () => {
  const service = new EnvironmentImportAnalyzerService();

  it('extracts Compose services, ports, dependencies, env, volumes, and healthchecks', () => {
    const result = service.analyze(
      `services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgres://user:pass@postgres:5432/app
    depends_on:
      - postgres
    volumes:
      - .:/app
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8000/health"]
  postgres:
    image: postgres:16
`,
      'PASTE',
    );

    expect(result.services).toHaveLength(2);
    expect(result.services[0]).toMatchObject({
      name: 'api',
      buildContext: '.',
      buildDockerfile: 'Dockerfile',
      dependencies: ['postgres'],
      ports: [{ host: '8000', container: '8000' }],
      volumes: [{ source: '.', target: '/app', type: 'bind' }],
    });
    expect(result.services[0].environment[0]).toMatchObject({
      key: 'DATABASE_URL',
      isSensitive: false,
    });
    expect(result.services[0].healthcheck).toBeDefined();
  });

  it('detects probable main service with confidence and base URL', () => {
    const result = service.analyze(
      `services:
  api:
    image: my-api:1.0
    ports:
      - "3000:3000"
  redis:
    image: redis:7
    ports:
      - "6379:6379"
`,
      'PASTE',
    );

    expect(result.probableMainService?.serviceName).toBe('api');
    expect(result.probableMainService?.confidence).toBeGreaterThan(0.5);
    expect(result.probableBaseUrl).toBe('http://localhost:3000');
  });

  it('keeps security warnings visible', () => {
    const result = service.analyze(
      `services:
  api:
    image: api:latest
    privileged: true
    network_mode: host
    environment:
      API_TOKEN: inline-token
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
`,
      'PASTE',
    );

    expect(result.securityWarnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        'FLOATING_LATEST_TAG',
        'PRIVILEGED',
        'HOST_NETWORK',
        'PLAINTEXT_SECRET',
        'DOCKER_SOCKET',
        'PUBLISHED_INFRA_PORT',
      ]),
    );
  });
});
