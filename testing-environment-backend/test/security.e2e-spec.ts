import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { ApiTokenAuthService } from '../src/authorization/api-token-auth.service';
import { PermissionService } from '../src/authorization/permission.service';
import { PermissionsGuard } from '../src/authorization/permissions.guard';
import { ResourceResolverService } from '../src/authorization/resource-resolver.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProjectsController } from '../src/projects/projects.controller';
import { ProjectsService } from '../src/projects/projects.service';
import { ReportsController } from '../src/reports/reports.controller';
import { ReportsService } from '../src/reports/reports.service';
import { EnvironmentConfigsController } from '../src/environment-configs/environment-configs.controller';
import { EnvironmentConfigsService } from '../src/environment-configs/environment-configs.service';
import { SubscriptionsController } from '../src/subscriptions/subscriptions.controller';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import { TestRunsController } from '../src/test-runs/test-runs.controller';
import { TestRunsService } from '../src/test-runs/test-runs.service';
import { RealtimeGateway } from '../src/websocket/realtime.gateway';
import { RealtimeService } from '../src/websocket/realtime.service';

describe('Security enforcement (e2e)', () => {
  let app: INestApplication;
  let gateway: RealtimeGateway;

  const projectsService = {
    findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    findOne: jest.fn().mockResolvedValue({ id: 'project-b' }),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const reportsService = {
    report: jest.fn(),
    logs: jest.fn(),
    junit: jest.fn(),
    downloadArtifact: jest.fn(),
  };
  const testRunsService = {
    create: jest.fn().mockResolvedValue({ id: 'run-1' }),
    list: jest.fn(),
    find: jest.fn(),
    cancel: jest.fn(),
  };
  const environmentService = {
    create: jest.fn(),
    find: jest.fn(),
    compile: jest.fn(),
    listRevisions: jest.fn(),
    compareRevisions: jest.fn(),
    publishRevision: jest.fn(),
    update: jest.fn(),
  };
  const subscriptionsService = {
    listPlans: jest.fn().mockResolvedValue([]),
    changePlan: jest.fn(),
  };

  const tokenAuth = new ApiTokenAuthService({
    apiToken: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  } as never);

  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => ({
        id: where.id,
        email: `${where.id}@example.com`,
        companyId: 'company-a',
        role: where.id === 'developer' ? 'DEVELOPER' : where.id === 'viewer' ? 'VIEWER' : 'OWNER',
      })),
    },
    companyMember: {
      findUnique: jest.fn(({ where }: { where: { companyId_userId: { userId: string } } }) => {
        const userId = where.companyId_userId.userId;
        if (userId === 'removed') {
          return {
            id: 'member-removed',
            userId,
            companyId: 'company-a',
            role: 'VIEWER',
            status: 'REMOVED',
          };
        }
        return {
          id: `member-${userId}`,
          userId,
          companyId: 'company-a',
          role: userId === 'developer' ? 'DEVELOPER' : userId === 'viewer' ? 'VIEWER' : 'OWNER',
          status: 'ACTIVE',
        };
      }),
    },
    project: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => ({
        id: where.id,
        companyId: where.id === 'project-b' ? 'company-b' : 'company-a',
      })),
    },
    projectMember: { findUnique: jest.fn().mockResolvedValue(null) },
    testRun: {
      findFirst: jest.fn(({ where }: { where: { id?: string; projectId?: string } }) => {
        if (where.id === 'run-b') {
          return { id: 'run-b', projectId: 'project-b', project: { companyId: 'company-b' } };
        }
        return {
          id: where.id ?? 'run-a',
          projectId: 'project-a',
          project: { companyId: 'company-a' },
        };
      }),
    },
    apiToken: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { tokenHash: string } }) => {
        if (where.tokenHash !== tokenAuth.hash('api-run-read-token')) {
          return null;
        }
        return {
          id: 'api-token-1',
          name: 'Run read token',
          companyId: 'company-a',
          scopes: ['run:read'],
          projectId: 'project-a',
          serviceAccountId: null,
          serviceAccount: null,
          revokedAt: null,
          expiresAt: null,
        };
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    secret: { findFirst: jest.fn() },
    testSuite: { findFirst: jest.fn() },
    testSuiteRevision: { findFirst: jest.fn() },
    environmentConfigRevision: { findFirst: jest.fn() },
  };

  const jwt = {
    verifyAsync: jest.fn((token: string) => {
      if (token === 'api-run-read-token') {
        throw new Error('Not a JWT');
      }
      const subByToken: Record<string, string> = {
        'owner-token': 'owner',
        'viewer-token': 'viewer',
        'developer-token': 'developer',
        'removed-token': 'removed',
      };
      return { sub: subByToken[token] ?? 'owner' };
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        ProjectsController,
        ReportsController,
        TestRunsController,
        EnvironmentConfigsController,
        SubscriptionsController,
      ],
      providers: [
        JwtAuthGuard,
        PermissionsGuard,
        PermissionService,
        ResourceResolverService,
        ApiTokenAuthService,
        RealtimeGateway,
        { provide: JwtService, useValue: jwt },
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectsService, useValue: projectsService },
        { provide: ReportsService, useValue: reportsService },
        { provide: TestRunsService, useValue: testRunsService },
        { provide: EnvironmentConfigsService, useValue: environmentService },
        { provide: SubscriptionsService, useValue: subscriptionsService },
        {
          provide: RealtimeService,
          useValue: {
            bind: jest.fn(),
            userRoom: (userId: string) => `user:${userId}`,
            apiTokenRoom: (apiTokenId: string) => `api-token:${apiTokenId}`,
            companyRoom: (companyId: string) => `company:${companyId}`,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    gateway = moduleRef.get(RealtimeGateway);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('company A cannot read project from company B', async () => {
    await request(app.getHttpServer())
      .get('/projects/project-b')
      .set('Authorization', 'Bearer owner-token')
      .expect(403);
    expect(projectsService.findOne).not.toHaveBeenCalled();
  });

  it('company A cannot read report or logs from company B by known UUID', async () => {
    await request(app.getHttpServer())
      .get('/projects/project-b/test-runs/run-b/report')
      .set('Authorization', 'Bearer owner-token')
      .expect(403);
    await request(app.getHttpServer())
      .get('/projects/project-b/test-runs/run-b/logs')
      .set('Authorization', 'Bearer owner-token')
      .expect(403);
    await request(app.getHttpServer())
      .get('/projects/project-b/test-runs/run-b/report/junit')
      .set('Authorization', 'Bearer owner-token')
      .expect(403);
    await request(app.getHttpServer())
      .get('/projects/project-b/test-runs/run-b/artifacts/artifact-b/download')
      .set('Authorization', 'Bearer owner-token')
      .expect(403);
    expect(reportsService.report).not.toHaveBeenCalled();
    expect(reportsService.logs).not.toHaveBeenCalled();
    expect(reportsService.junit).not.toHaveBeenCalled();
    expect(reportsService.downloadArtifact).not.toHaveBeenCalled();
  });

  it('viewer cannot start tests', async () => {
    await request(app.getHttpServer())
      .post('/projects/project-a/test-runs')
      .set('Authorization', 'Bearer viewer-token')
      .expect(403);
    expect(testRunsService.create).not.toHaveBeenCalled();
  });

  it('developer cannot change billing', async () => {
    await request(app.getHttpServer())
      .patch('/subscriptions/current')
      .set('Authorization', 'Bearer developer-token')
      .send({ planName: 'PRO' })
      .expect(403);
    expect(subscriptionsService.changePlan).not.toHaveBeenCalled();
  });

  it('viewer cannot change environment', async () => {
    await request(app.getHttpServer())
      .patch('/projects/project-a/environment-config')
      .set('Authorization', 'Bearer viewer-token')
      .send({ type: 'DOCKER_COMPOSE' })
      .expect(403);
    expect(environmentService.update).not.toHaveBeenCalled();
  });

  it('removed user loses API and WebSocket access', async () => {
    await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', 'Bearer removed-token')
      .expect(401);

    const socket = {
      handshake: { auth: { token: 'removed-token' }, headers: {} },
      data: {},
      join: jest.fn(),
      disconnect: jest.fn(),
    };
    await gateway.handleConnection(socket as never);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('API token is limited by scopes', async () => {
    await request(app.getHttpServer())
      .get('/projects/project-a/test-runs/run-a')
      .set('Authorization', 'Bearer api-run-read-token')
      .expect(200);

    await request(app.getHttpServer())
      .post('/projects/project-a/test-runs')
      .set('Authorization', 'Bearer api-run-read-token')
      .expect(403);
    expect(testRunsService.create).not.toHaveBeenCalled();
  });
});
