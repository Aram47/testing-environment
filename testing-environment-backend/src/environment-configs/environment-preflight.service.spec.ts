import { ProjectAccessService } from '../common/services/project-access.service';
import { EnvironmentImportAnalyzerService } from '../environment-import/environment-import-analyzer.service';
import { PrismaService } from '../prisma/prisma.service';
import { DockerComposeManagerService } from '../runner/docker-compose-manager.service';
import { EnvironmentConfigCompilerService } from './environment-config-compiler.service';
import { EnvironmentPreflightService } from './environment-preflight.service';

describe('EnvironmentPreflightService', () => {
  const projectAccess = {
    getProjectOrThrow: jest.fn(() => Promise.resolve({ id: 'project-1' })),
  } as unknown as ProjectAccessService;
  const prisma = {
    environmentConfigRevision: {
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;

  const service = new EnvironmentPreflightService(
    prisma,
    projectAccess,
    new EnvironmentConfigCompilerService(),
    new EnvironmentImportAnalyzerService(),
    new DockerComposeManagerService(),
  );

  it('fails preflight for privileged compose', async () => {
    const result = await service.preflight('project-1', 'company-1', {
      composeYaml: `services:
  api:
    image: nginx
    privileged: true
`,
      backendTestYaml: `version: "1.0"
app:
  service: api
  base_url: http://localhost:8000
  healthcheck:
    path: /health
    expected_status: 200
    timeout_seconds: 30
`,
    });

    expect(result.ok).toBe(false);
    expect(result.securityErrors.length).toBeGreaterThan(0);
  });
});
