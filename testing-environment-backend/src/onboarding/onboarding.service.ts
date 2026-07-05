import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EnvironmentConfigType,
  OnboardingSession,
  OnboardingSessionStatus,
  Prisma,
  RevisionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ConfirmOnboardingDto } from './dto/confirm-onboarding.dto';
import { UpdateOnboardingSessionDto } from './dto/update-onboarding-session.dto';
import { OnboardingTemplatesService } from './onboarding-templates.service';
import { OnboardingProjectDraft } from './onboarding.types';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly templates: OnboardingTemplatesService,
  ) {}

  async getOrCreateSession(companyId: string, userId: string): Promise<OnboardingSession> {
    const existing = await this.prisma.onboardingSession.findFirst({
      where: { companyId, userId, status: OnboardingSessionStatus.IN_PROGRESS },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.onboardingSession.create({
      data: { companyId, userId, draftData: {} },
    });
  }

  async updateSession(
    companyId: string,
    userId: string,
    dto: UpdateOnboardingSessionDto,
  ): Promise<OnboardingSession> {
    const session = await this.getOrCreateSession(companyId, userId);
    return this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: {
        currentStep: dto.currentStep ?? session.currentStep,
        draftData: dto.draftData
          ? (dto.draftData as Prisma.InputJsonValue)
          : (session.draftData as Prisma.InputJsonValue),
      },
    });
  }

  templatesList() {
    return this.templates.list();
  }

  async confirm(companyId: string, userId: string, dto: ConfirmOnboardingDto) {
    const session = await this.getOrCreateSession(companyId, userId);
    this.validateConfirm(dto);

    const result = await this.prisma.$transaction(async (tx) => {
      const project = await this.upsertProject(tx, companyId, session.projectId, dto.project);
      const environmentRevision = await this.createPublishedEnvironmentRevision(
        tx,
        project.id,
        userId,
        dto,
      );
      const suiteRevision = await this.createPublishedSmokeSuiteRevision(
        tx,
        project.id,
        userId,
        dto.project,
      );
      const updatedSession = await tx.onboardingSession.update({
        where: { id: session.id },
        data: {
          projectId: project.id,
          currentStep: 'run',
          status: OnboardingSessionStatus.COMPLETED,
          completedAt: new Date(),
          draftData: {
            project: dto.project,
            environmentType: dto.environmentType,
            templateId: dto.templateId,
            analysis: dto.analysis,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return { project, environmentRevision, suiteRevision, session: updatedSession };
    });

    return result;
  }

  async createDemoProject(companyId: string, userId: string) {
    const demo = this.templates.demo();
    return this.confirm(companyId, userId, {
      project: demo.project,
      environmentType: demo.environmentType,
      composeYaml: demo.composeYaml,
      backendTestYaml: demo.backendTestYaml,
      templateId: demo.id,
    });
  }

  async recordFirstSuccessfulRun(
    projectId: string,
    finishedAt = new Date(),
  ): Promise<number | null> {
    const session = await this.prisma.onboardingSession.findFirst({
      where: {
        projectId,
        status: OnboardingSessionStatus.COMPLETED,
        firstSuccessfulRunAt: null,
      },
      orderBy: { completedAt: 'asc' },
    });
    if (!session) {
      return null;
    }
    const durationMs = Math.max(0, finishedAt.getTime() - session.startedAt.getTime());
    const updated = await this.prisma.onboardingSession.updateMany({
      where: { id: session.id, firstSuccessfulRunAt: null },
      data: { firstSuccessfulRunAt: finishedAt, timeToFirstSuccessfulRunMs: durationMs },
    });
    return updated.count > 0 ? durationMs : null;
  }

  private validateConfirm(dto: ConfirmOnboardingDto): void {
    if (dto.environmentType === EnvironmentConfigType.DOCKER_COMPOSE && !dto.composeYaml?.trim()) {
      throw new BadRequestException('Docker Compose YAML is required');
    }
    if (!dto.backendTestYaml?.trim()) {
      throw new BadRequestException('backend-test YAML is required');
    }
  }

  private async upsertProject(
    tx: Prisma.TransactionClient,
    companyId: string,
    projectId: string | null,
    project: OnboardingProjectDraft,
  ) {
    const data = {
      name: project.name,
      description: project.description,
      baseUrl: project.baseUrl,
      mainServiceName: project.mainServiceName,
      healthcheckPath: project.healthcheckPath,
      healthcheckExpectedStatus: project.healthcheckExpectedStatus,
      healthcheckTimeoutSeconds: project.healthcheckTimeoutSeconds,
    };
    if (projectId) {
      const existing = await tx.project.findFirst({ where: { id: projectId, companyId } });
      if (!existing) {
        throw new NotFoundException('Onboarding project not found');
      }
      return tx.project.update({ where: { id: projectId }, data });
    }
    await this.subscriptions.assertCanCreateProject(companyId);
    return tx.project.create({ data: { ...data, companyId } });
  }

  private async createPublishedEnvironmentRevision(
    tx: Prisma.TransactionClient,
    projectId: string,
    userId: string,
    dto: ConfirmOnboardingDto,
  ) {
    const config = await tx.environmentConfig.upsert({
      where: { projectId },
      create: { projectId, type: dto.environmentType },
      update: { type: dto.environmentType },
    });
    const latest = await tx.environmentConfigRevision.aggregate({
      where: { environmentConfigId: config.id },
      _max: { revisionNumber: true },
    });
    await tx.environmentConfigRevision.updateMany({
      where: { environmentConfigId: config.id, status: RevisionStatus.PUBLISHED },
      data: { status: RevisionStatus.DRAFT, publishedAt: null, publishedById: null },
    });
    return tx.environmentConfigRevision.create({
      data: {
        environmentConfigId: config.id,
        revisionNumber: (latest._max.revisionNumber ?? 0) + 1,
        status: RevisionStatus.PUBLISHED,
        sourceMode:
          dto.environmentType === EnvironmentConfigType.EXTERNAL_URL ? 'EXTERNAL_URL' : 'YAML',
        compiledComposeYaml:
          dto.environmentType === EnvironmentConfigType.EXTERNAL_URL ? '' : (dto.composeYaml ?? ''),
        compiledRuntimeYaml: dto.backendTestYaml ?? '',
        visualConfig: Prisma.JsonNull,
        schemaVersion: 1,
        createdById: userId,
        publishedById: userId,
        publishedAt: new Date(),
      },
    });
  }

  private async createPublishedSmokeSuiteRevision(
    tx: Prisma.TransactionClient,
    projectId: string,
    userId: string,
    project: OnboardingProjectDraft,
  ) {
    const suiteName = 'Onboarding smoke test';
    const suite =
      (await tx.testSuite.findFirst({ where: { projectId, name: suiteName, deletedAt: null } })) ??
      (await tx.testSuite.create({ data: { projectId, name: suiteName } }));
    const latest = await tx.testSuiteRevision.aggregate({
      where: { testSuiteId: suite.id },
      _max: { revisionNumber: true },
    });
    await tx.testSuiteRevision.updateMany({
      where: { testSuiteId: suite.id, status: RevisionStatus.PUBLISHED },
      data: { status: RevisionStatus.DRAFT, publishedAt: null, publishedById: null },
    });
    return tx.testSuiteRevision.create({
      data: {
        testSuiteId: suite.id,
        revisionNumber: (latest._max.revisionNumber ?? 0) + 1,
        status: RevisionStatus.PUBLISHED,
        sourceMode: 'RAW_YAML',
        compiledYaml: this.templates.smokeSuiteYaml(
          project.healthcheckPath,
          project.healthcheckExpectedStatus,
        ),
        visualFlow: Prisma.JsonNull,
        executionPlan: Prisma.JsonNull,
        schemaVersion: 1,
        createdById: userId,
        publishedById: userId,
        publishedAt: new Date(),
      },
    });
  }
}
