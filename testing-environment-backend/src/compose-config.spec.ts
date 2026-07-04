import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

describe('root docker-compose runner separation', () => {
  const compose = yaml.load(
    readFileSync(join(process.cwd(), '..', 'docker-compose.yml'), 'utf8'),
  ) as {
    services: Record<string, { volumes?: string[]; environment?: Record<string, string> }>;
  };

  it('defines redis for durable queues', () => {
    expect(compose.services.redis).toBeDefined();
    expect(compose.services['backend-api'].environment?.REDIS_URL).toBe('redis://redis:6379');
    expect(compose.services['runner-worker'].environment?.REDIS_URL).toBe('redis://redis:6379');
  });

  it('does not mount Docker socket into backend-api', () => {
    expect(compose.services['backend-api'].volumes ?? []).not.toContain(
      '/var/run/docker.sock:/var/run/docker.sock',
    );
  });

  it('mounts Docker socket only into runner-worker', () => {
    expect(compose.services['runner-worker'].volumes ?? []).toContain(
      '/var/run/docker.sock:/var/run/docker.sock',
    );
  });
});
