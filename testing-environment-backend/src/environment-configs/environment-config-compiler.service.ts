import { BadRequestException, Injectable } from '@nestjs/common';
import * as yaml from 'js-yaml';
import {
  EnvironmentCompileResult,
  EnvironmentVariable,
  EnvironmentServiceConfig,
  EnvironmentVisualConfig,
} from './types/environment-visual-config.types';

@Injectable()
export class EnvironmentConfigCompilerService {
  compile(config: EnvironmentVisualConfig): EnvironmentCompileResult {
    this.validate(config);
    const warnings = this.buildWarnings(config);
    return {
      composeYaml: yaml.dump(this.toComposeFile(config), { noRefs: true, lineWidth: 120 }),
      backendTestYaml: yaml.dump(this.toBackendTestFile(config), { noRefs: true, lineWidth: 120 }),
      warnings,
    };
  }

  private validate(config: EnvironmentVisualConfig): void {
    if (!config || typeof config !== 'object') {
      throw new BadRequestException('Environment visual config is required');
    }
    if (config.version !== '1.0') {
      throw new BadRequestException('Unsupported environment config version');
    }
    if (!Array.isArray(config.services) || config.services.length === 0) {
      throw new BadRequestException('At least one service is required');
    }

    const serviceNames = new Set<string>();
    for (const service of config.services) {
      if (!service.name?.trim()) {
        throw new BadRequestException('Every service must have a name');
      }
      if (serviceNames.has(service.name)) {
        throw new BadRequestException(`Duplicate service name: ${service.name}`);
      }
      serviceNames.add(service.name);
      if (!service.image?.trim() && !service.buildContext?.trim()) {
        throw new BadRequestException(
          `Service "${service.name}" must define image or build context`,
        );
      }
    }

    if (!serviceNames.has(config.app?.mainServiceName)) {
      throw new BadRequestException('Main API service must match one of the configured services');
    }
    if (!config.app.baseUrl?.trim()) {
      throw new BadRequestException('Base URL is required');
    }
    if (!config.app.healthcheckPath?.trim()) {
      throw new BadRequestException('Healthcheck path is required');
    }
  }

  private buildWarnings(config: EnvironmentVisualConfig): string[] {
    const warnings: string[] = [];
    const serviceNames = new Set(config.services.map((service) => service.name));

    for (const service of config.services) {
      for (const dependency of service.dependsOn ?? []) {
        if (!serviceNames.has(dependency)) {
          warnings.push(`Service "${service.name}" depends on unknown service "${dependency}".`);
        }
      }
    }

    return warnings;
  }

  private toComposeFile(config: EnvironmentVisualConfig): Record<string, unknown> {
    return {
      services: Object.fromEntries(
        config.services.map((service) => [service.name, this.toComposeService(service)]),
      ),
    };
  }

  private toComposeService(service: EnvironmentServiceConfig): Record<string, unknown> {
    const composeService: Record<string, unknown> = {};

    if (service.image?.trim()) {
      composeService.image = service.image.trim();
    }
    if (service.buildContext?.trim()) {
      composeService.build = {
        context: service.buildContext.trim(),
        ...(service.buildDockerfile?.trim() ? { dockerfile: service.buildDockerfile.trim() } : {}),
      };
    }
    if (service.ports?.length) {
      composeService.ports = service.ports
        .filter((port) => port.host && port.container)
        .map((port) => `${port.host}:${port.container}`);
    }
    if (service.environment?.length) {
      composeService.environment = Object.fromEntries(
        service.environment
          .filter((entry) => entry.key)
          .map((entry) => [entry.key, this.environmentValue(entry)]),
      );
    }
    if (service.dependsOn?.length) {
      composeService.depends_on = service.dependsOn;
    }
    if (service.command?.trim()) {
      composeService.command = service.command.trim();
    }

    return composeService;
  }

  private toBackendTestFile(config: EnvironmentVisualConfig): Record<string, unknown> {
    return {
      version: '1.0',
      environment: {
        type: 'docker_compose',
        compose_file: './docker-compose.test.yml',
      },
      app: {
        service: config.app.mainServiceName,
        base_url: config.app.baseUrl,
        healthcheck: {
          path: config.app.healthcheckPath,
          expected_status: config.app.healthcheckExpectedStatus,
          timeout_seconds: config.app.healthcheckTimeoutSeconds,
        },
      },
      tests: ['./tests/*.yml'],
      run: {
        timeout_minutes: config.run.timeoutMinutes,
        cleanup: config.run.cleanup,
      },
    };
  }

  private environmentValue(entry: EnvironmentVariable): string {
    if (entry.valueType === 'secret') {
      return entry.secretKey ? `{{ secret.${entry.secretKey} }}` : '';
    }
    if (entry.valueType === 'runtime') {
      return entry.variableName ? `{{ ${entry.variableName} }}` : '';
    }
    return entry.value ?? '';
  }
}
