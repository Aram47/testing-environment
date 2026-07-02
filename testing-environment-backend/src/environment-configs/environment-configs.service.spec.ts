import { Prisma } from '@prisma/client';
import { ProjectAccessService } from '../common/services/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnvironmentConfigCompilerService } from './environment-config-compiler.service';
import { EnvironmentConfigsService } from './environment-configs.service';

describe('EnvironmentConfigsService', () => {
  const projectId = 'project-1';
  const companyId = 'company-1';
  let prisma: {
    environmentConfig: {
      create: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let service: EnvironmentConfigsService;

  beforeEach(() => {
    prisma = {
      environmentConfig: {
        create: jest.fn(({ data }: { data: unknown }) => Promise.resolve(data)),
        upsert: jest.fn(({ create }: { create: unknown }) => Promise.resolve(create)),
      },
    };
    const projectAccess = {
      getProjectOrThrow: jest.fn(() => Promise.resolve({ id: projectId })),
    };
    service = new EnvironmentConfigsService(
      prisma as unknown as PrismaService,
      projectAccess as unknown as ProjectAccessService,
      new EnvironmentConfigCompilerService(),
    );
  });

  it('preserves legacy YAML create behavior', async () => {
    await service.create(projectId, companyId, {
      type: 'DOCKER_COMPOSE',
      composeYaml: 'services: {}\n',
      backendTestYaml: 'version: "1.0"\n',
    });

    expect(prisma.environmentConfig.create).toHaveBeenCalledWith({
      data: {
        projectId,
        type: 'DOCKER_COMPOSE',
        composeYaml: 'services: {}\n',
        backendTestYaml: 'version: "1.0"\n',
        visualConfig: Prisma.JsonNull,
      },
    });
  });

  it('stores visual config with generated YAML on create', async () => {
    const visualConfig = createVisualConfig();

    await service.create(projectId, companyId, { type: 'DOCKER_COMPOSE', visualConfig });
    const call = prisma.environmentConfig.create.mock.calls[0][0] as {
      data: { composeYaml: string; backendTestYaml: string; visualConfig: unknown };
    };

    expect(call.data.composeYaml).toContain('services:');
    expect(call.data.backendTestYaml).toContain('compose_file');
    expect(call.data.visualConfig).toEqual(visualConfig);
  });

  it('stores visual config with generated YAML on update', async () => {
    const visualConfig = createVisualConfig();

    await service.update(projectId, companyId, { type: 'DOCKER_COMPOSE', visualConfig });
    const call = prisma.environmentConfig.upsert.mock.calls[0][0] as {
      update: { composeYaml: string; backendTestYaml: string; visualConfig: unknown };
    };

    expect(call.update.composeYaml).toContain('api:');
    expect(call.update.backendTestYaml).toContain('timeout_minutes');
    expect(call.update.visualConfig).toEqual(visualConfig);
  });
});

function createVisualConfig() {
  return {
    version: '1.0' as const,
    services: [{ name: 'api', image: 'api:latest' }],
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
