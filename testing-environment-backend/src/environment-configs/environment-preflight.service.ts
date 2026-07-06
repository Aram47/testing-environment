import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as yaml from 'js-yaml';
import { ProjectAccessService } from '../common/services/project-access.service';
import { EnvironmentImportAnalyzerService } from '../environment-import/environment-import-analyzer.service';
import { DockerComposeManagerService } from '../runner/docker-compose-manager.service';
import { PrismaService } from '../prisma/prisma.service';
import { PreflightEnvironmentConfigDto } from './dto/preflight-environment-config.dto';
import { EnvironmentConfigCompilerService } from './environment-config-compiler.service';
import {
  EnvironmentPreflightResult,
  PreflightCheck,
} from './types/preflight.types';
import { EnvironmentVisualConfig } from './types/environment-visual-config.types';

@Injectable()
export class EnvironmentPreflightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
    private readonly compiler: EnvironmentConfigCompilerService,
    private readonly importAnalyzer: EnvironmentImportAnalyzerService,
    private readonly docker: DockerComposeManagerService,
  ) {}

  async preflight(
    projectId: string,
    companyId: string,
    dto: PreflightEnvironmentConfigDto,
  ): Promise<EnvironmentPreflightResult> {
    await this.projectAccess.getProjectOrThrow(projectId, companyId);
    return this.runPreflight(projectId, dto);
  }

  private async runPreflight(
    projectId: string,
    dto: PreflightEnvironmentConfigDto,
  ): Promise<EnvironmentPreflightResult> {
    const resolved = await this.resolvePayload(projectId, dto);
    const checks: PreflightCheck[] = [];
    const securityErrors: string[] = [];
    const dependencyWarnings: string[] = [];

    if (resolved.visualConfig) {
      this.runVisualChecks(resolved.visualConfig, checks, dependencyWarnings);
      const compiled = this.compiler.compile(resolved.visualConfig);
      resolved.composeYaml = compiled.composeYaml;
      resolved.backendTestYaml = compiled.backendTestYaml;
      dependencyWarnings.push(...compiled.warnings);
    } else {
      this.runRawYamlChecks(checks, resolved.composeYaml, resolved.backendTestYaml);
    }

    if (resolved.composeYaml?.trim()) {
      try {
        this.docker.validateCompose(resolved.composeYaml);
        checks.push({
          id: 'security',
          status: 'pass',
          message: 'Compose security validation passed',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Compose security validation failed';
        securityErrors.push(message);
        checks.push({ id: 'security', status: 'fail', message });
      }

      const analysis = this.importAnalyzer.analyze(resolved.composeYaml, 'PASTE');
      for (const warning of analysis.securityWarnings) {
        if (warning.severity === 'critical') {
          securityErrors.push(warning.message);
          checks.push({ id: `security-${warning.code}`, status: 'fail', message: warning.message });
        } else {
          checks.push({
            id: `security-${warning.code}`,
            status: warning.severity === 'warning' ? 'warn' : 'pass',
            message: warning.message,
          });
        }
      }
    }

    const resourceEstimation = this.estimateResources(resolved.visualConfig, resolved.composeYaml);
    const ok = !checks.some((check) => check.status === 'fail') && securityErrors.length === 0;

    return {
      ok,
      checks,
      securityErrors,
      dependencyWarnings,
      resourceEstimation,
    };
  }

  private async resolvePayload(projectId: string, dto: PreflightEnvironmentConfigDto) {
    if (dto.revisionId) {
      const revision = await this.prisma.environmentConfigRevision.findFirst({
        where: {
          id: dto.revisionId,
          environmentConfig: { projectId },
        },
      });
      if (!revision) {
        throw new NotFoundException('Environment config revision not found');
      }
      return {
        visualConfig: revision.visualConfig as EnvironmentVisualConfig | null,
        composeYaml: revision.compiledComposeYaml,
        backendTestYaml: revision.compiledRuntimeYaml,
      };
    }

    return {
      visualConfig: dto.visualConfig,
      composeYaml: dto.composeYaml,
      backendTestYaml: dto.backendTestYaml,
    };
  }

  private runVisualChecks(
    config: EnvironmentVisualConfig,
    checks: PreflightCheck[],
    dependencyWarnings: string[],
  ) {
    try {
      this.compiler.compile(config);
      checks.push({
        id: 'services_configured',
        status: config.services.length > 0 ? 'pass' : 'fail',
        message:
          config.services.length > 0
            ? `${config.services.length} service(s) configured`
            : 'At least one service is required',
      });
      checks.push({
        id: 'main_service_selected',
        status: config.services.some((service) => service.name === config.app.mainServiceName)
          ? 'pass'
          : 'fail',
        message: `Main service: ${config.app.mainServiceName || 'not selected'}`,
      });
      checks.push({
        id: 'healthcheck_configured',
        status:
          config.app.healthcheckPath?.trim() && config.app.healthcheckExpectedStatus > 0
            ? 'pass'
            : 'fail',
        message: `Healthcheck ${config.app.healthcheckPath || 'not configured'}`,
      });
      const portIssues = this.validatePortMappings(config);
      checks.push({
        id: 'port_mapping_valid',
        status: portIssues.length === 0 ? 'pass' : 'fail',
        message:
          portIssues.length === 0
            ? 'Port mappings are valid'
            : portIssues.join('; '),
      });
      for (const warning of this.compiler.compile(config).warnings) {
        dependencyWarnings.push(warning);
        checks.push({ id: 'dependency', status: 'warn', message: warning });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Visual config validation failed';
      checks.push({ id: 'visual_validation', status: 'fail', message });
    }
  }

  private runRawYamlChecks(
    checks: PreflightCheck[],
    composeYaml?: string,
    backendTestYaml?: string,
  ) {
    checks.push({
      id: 'services_configured',
      status: composeYaml?.trim() ? 'pass' : 'fail',
      message: composeYaml?.trim() ? 'Compose YAML provided' : 'Compose YAML is required',
    });
    checks.push({
      id: 'healthcheck_configured',
      status: backendTestYaml?.trim() ? 'pass' : 'fail',
      message: backendTestYaml?.trim()
        ? 'Backend-test YAML provided'
        : 'Backend-test YAML is required',
    });
    if (backendTestYaml?.trim()) {
      try {
        const parsed = yaml.load(backendTestYaml) as Record<string, unknown>;
        const app = parsed?.app as Record<string, unknown> | undefined;
        const healthcheck = app?.healthcheck as Record<string, unknown> | undefined;
        checks.push({
          id: 'main_service_selected',
          status: typeof app?.service === 'string' && app.service.length > 0 ? 'pass' : 'warn',
          message: typeof app?.service === 'string' ? `Main service: ${app.service}` : 'Main service not found in backend-test YAML',
        });
        checks.push({
          id: 'healthcheck_details',
          status: typeof healthcheck?.path === 'string' ? 'pass' : 'warn',
          message:
            typeof healthcheck?.path === 'string'
              ? `Healthcheck path: ${healthcheck.path}`
              : 'Healthcheck path missing in backend-test YAML',
        });
      } catch (error) {
        checks.push({
          id: 'backend_test_yaml',
          status: 'fail',
          message: error instanceof Error ? error.message : 'Invalid backend-test YAML',
        });
      }
    }
    checks.push({
      id: 'port_mapping_valid',
      status: 'warn',
      message: 'Port mapping validation is limited in raw YAML mode',
    });
  }

  private validatePortMappings(config: EnvironmentVisualConfig): string[] {
    const issues: string[] = [];
    const seen = new Set<string>();
    for (const service of config.services) {
      for (const port of service.ports ?? []) {
        if (!this.isValidPort(port.host) || !this.isValidPort(port.container)) {
          issues.push(`Service "${service.name}" has invalid port mapping ${port.host}:${port.container}`);
        }
        const key = `${port.host}:${port.container}`;
        if (seen.has(key)) {
          issues.push(`Duplicate port mapping ${key}`);
        }
        seen.add(key);
      }
    }
    return issues;
  }

  private isValidPort(value: string): boolean {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535;
  }

  private estimateResources(
    visualConfig?: EnvironmentVisualConfig | null,
    composeYaml?: string,
  ) {
    const serviceCount = visualConfig?.services.length ?? this.countComposeServices(composeYaml);
    const hasBuild = visualConfig
      ? visualConfig.services.some((service) => Boolean(service.buildContext?.trim()))
      : composeYaml?.includes('build:') ?? false;
    const portCount =
      visualConfig?.services.reduce((total, service) => total + (service.ports?.length ?? 0), 0) ??
      0;
    const tier: 'low' | 'medium' | 'high' =
      serviceCount >= 6 || hasBuild
        ? 'high'
        : serviceCount >= 3 || portCount >= 4
          ? 'medium'
          : 'low';
    const notes = [
      `Estimated from ${serviceCount} service(s)`,
      hasBuild ? 'Build contexts increase startup time' : 'No build contexts detected',
    ];
    return { tier, serviceCount, notes };
  }

  private countComposeServices(composeYaml?: string): number {
    if (!composeYaml?.trim()) {
      return 0;
    }
    try {
      const parsed = yaml.load(composeYaml) as { services?: Record<string, unknown> };
      return Object.keys(parsed.services ?? {}).length;
    } catch {
      throw new BadRequestException('Invalid compose YAML');
    }
  }
}
