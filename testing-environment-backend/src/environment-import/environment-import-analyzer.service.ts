import { BadRequestException, Injectable } from '@nestjs/common';
import * as yaml from 'js-yaml';
import {
  ComposeAnalysisResult,
  ComposeEnvironmentVariable,
  ComposePort,
  ComposeServiceAnalysis,
  ComposeVolume,
  EnvironmentImportSource,
  ProbableMainService,
  SecurityWarning,
} from './types/import-analysis.types';

type ComposeDocument = {
  services?: Record<string, ComposeService>;
};

type ComposeService = {
  image?: string;
  build?: string | { context?: string; dockerfile?: string };
  ports?: Array<
    string | { target?: number | string; published?: number | string; protocol?: string }
  >;
  depends_on?: string[] | Record<string, unknown>;
  environment?: string[] | Record<string, unknown>;
  volumes?: Array<string | { source?: string; target?: string; type?: string }>;
  healthcheck?: Record<string, unknown>;
  privileged?: boolean;
  network_mode?: string;
};

interface ServiceScore {
  service: ComposeServiceAnalysis;
  score: number;
  reasons: string[];
}

@Injectable()
export class EnvironmentImportAnalyzerService {
  analyze(composeYaml: string, source: EnvironmentImportSource): ComposeAnalysisResult {
    const parsed = this.parse(composeYaml);
    const services = parsed.services;
    if (!services || typeof services !== 'object' || Array.isArray(services)) {
      throw new BadRequestException('Docker Compose YAML must define services');
    }

    const analyzedServices = Object.entries(services).map(([name, service]) =>
      this.analyzeService(name, service ?? {}),
    );
    const probableMainService = this.detectMainService(analyzedServices);
    return {
      source,
      services: analyzedServices,
      probableMainService,
      probableBaseUrl: probableMainService
        ? this.detectBaseUrl(analyzedServices, probableMainService.serviceName)
        : undefined,
      securityWarnings: this.buildWarnings(services, analyzedServices),
    };
  }

  private parse(composeYaml: string): ComposeDocument {
    try {
      const parsed = yaml.load(composeYaml);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new BadRequestException('Docker Compose YAML must be an object');
      }
      return parsed as ComposeDocument;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Invalid YAML';
      throw new BadRequestException(`Invalid Docker Compose YAML: ${message}`);
    }
  }

  private analyzeService(name: string, service: ComposeService): ComposeServiceAnalysis {
    return {
      name,
      image: service.image,
      buildContext: this.buildContext(service.build),
      buildDockerfile: typeof service.build === 'object' ? service.build.dockerfile : undefined,
      ports: this.ports(service.ports),
      dependencies: this.dependencies(service.depends_on),
      environment: this.environment(service.environment),
      volumes: this.volumes(service.volumes),
      healthcheck: service.healthcheck,
    };
  }

  private buildContext(build: ComposeService['build']): string | undefined {
    if (typeof build === 'string') {
      return build;
    }
    return build?.context;
  }

  private ports(ports: ComposeService['ports']): ComposePort[] {
    return (ports ?? []).flatMap<ComposePort>((port) => {
      if (typeof port === 'object') {
        const container = port.target ? String(port.target) : '';
        return container
          ? [
              {
                host: port.published ? String(port.published) : undefined,
                container,
                protocol: port.protocol,
              },
            ]
          : [];
      }
      const [mapping, protocol] = port.split('/');
      const parts = mapping.split(':');
      if (parts.length === 1) {
        return [{ host: undefined, container: parts[0], protocol }];
      }
      return [{ host: parts[parts.length - 2], container: parts[parts.length - 1], protocol }];
    });
  }

  private dependencies(dependsOn: ComposeService['depends_on']): string[] {
    if (Array.isArray(dependsOn)) {
      return dependsOn;
    }
    return dependsOn ? Object.keys(dependsOn) : [];
  }

  private environment(environment: ComposeService['environment']): ComposeEnvironmentVariable[] {
    if (Array.isArray(environment)) {
      return environment.map((entry) => {
        const [key, ...valueParts] = entry.split('=');
        const value = valueParts.length > 0 ? valueParts.join('=') : undefined;
        return { key, value, isSensitive: this.isSensitiveEnv(key, value) };
      });
    }

    return Object.entries(environment ?? {}).map(([key, value]) => ({
      key,
      value: value === null || value === undefined ? undefined : String(value),
      isSensitive: this.isSensitiveEnv(
        key,
        value === null || value === undefined ? undefined : String(value),
      ),
    }));
  }

  private volumes(volumes: ComposeService['volumes']): ComposeVolume[] {
    return (volumes ?? []).flatMap<ComposeVolume>((volume) => {
      if (typeof volume === 'object') {
        if (!volume.target) {
          return [];
        }
        return [
          {
            source: volume.source,
            target: volume.target,
            type: this.volumeType(volume.type, volume.source),
          },
        ];
      }
      const parts = volume.split(':');
      if (parts.length === 1) {
        return [{ source: undefined, target: parts[0], type: 'unknown' }];
      }
      return [{ source: parts[0], target: parts[1], type: this.volumeType(undefined, parts[0]) }];
    });
  }

  private volumeType(type?: string, source?: string): ComposeVolume['type'] {
    if (type === 'bind' || (source && (source.startsWith('.') || source.startsWith('/')))) {
      return 'bind';
    }
    if (type === 'volume' || source) {
      return 'volume';
    }
    return 'unknown';
  }

  private detectMainService(services: ComposeServiceAnalysis[]): ProbableMainService | undefined {
    const scores = services
      .map((service) => this.scoreService(service))
      .sort((left, right) => right.score - left.score);
    const best = scores[0];
    if (!best) {
      return undefined;
    }
    const confidence = Math.max(0.1, Math.min(1, best.score / 100));
    return { serviceName: best.service.name, confidence, reasons: best.reasons };
  }

  private scoreService(service: ComposeServiceAnalysis): ServiceScore {
    let score = 20;
    const reasons: string[] = [];
    const name = service.name.toLowerCase();
    const image = service.image?.toLowerCase() ?? '';
    if (/(api|app|web|backend|server)/.test(name)) {
      score += 30;
      reasons.push('Service name looks like an application entrypoint');
    }
    if (
      service.ports.some((port) => this.isHttpPort(port.container) || this.isHttpPort(port.host))
    ) {
      score += 35;
      reasons.push('Service exposes a probable HTTP port');
    }
    if (service.healthcheck) {
      score += 15;
      reasons.push('Service already has a healthcheck');
    }
    if (service.buildContext) {
      score += 10;
      reasons.push('Service is built from local source');
    }
    if (/(postgres|mysql|mariadb|redis|mongo|rabbitmq|kafka|memcached)/.test(`${name} ${image}`)) {
      score -= 35;
      reasons.push('Service looks like infrastructure, not the main API');
    }
    return { service, score, reasons: reasons.length > 0 ? reasons : ['Best available candidate'] };
  }

  private detectBaseUrl(
    services: ComposeServiceAnalysis[],
    serviceName: string,
  ): string | undefined {
    const service = services.find((item) => item.name === serviceName);
    const port = service?.ports.find((item) => item.host || item.container);
    if (!port) {
      return undefined;
    }
    return `http://localhost:${port.host ?? port.container}`;
  }

  private buildWarnings(
    rawServices: Record<string, ComposeService>,
    services: ComposeServiceAnalysis[],
  ): SecurityWarning[] {
    const warnings: SecurityWarning[] = [];
    for (const service of services) {
      const raw = rawServices[service.name] ?? {};
      if (raw.privileged === true) {
        warnings.push(
          this.warning('PRIVILEGED', service.name, 'critical', 'Service uses privileged mode.'),
        );
      }
      if (raw.network_mode === 'host') {
        warnings.push(
          this.warning('HOST_NETWORK', service.name, 'critical', 'Service uses host network mode.'),
        );
      }
      if (!service.healthcheck) {
        warnings.push(
          this.warning(
            'MISSING_HEALTHCHECK',
            service.name,
            'info',
            'Service does not define a healthcheck.',
          ),
        );
      }
      if (service.image?.endsWith(':latest')) {
        warnings.push(
          this.warning(
            'FLOATING_LATEST_TAG',
            service.name,
            'warning',
            'Service image uses the floating latest tag.',
          ),
        );
      }
      for (const volume of service.volumes) {
        if (volume.source === '/var/run/docker.sock' || volume.target === '/var/run/docker.sock') {
          warnings.push(
            this.warning(
              'DOCKER_SOCKET',
              service.name,
              'critical',
              'Service mounts the Docker socket.',
            ),
          );
        }
        if (volume.source === '/') {
          warnings.push(
            this.warning(
              'ROOT_MOUNT',
              service.name,
              'critical',
              'Service mounts the host root filesystem.',
            ),
          );
        }
        if (volume.type === 'bind') {
          warnings.push(
            this.warning(
              'HOST_BIND_MOUNT',
              service.name,
              'warning',
              `Service bind-mounts ${volume.source ?? volume.target}.`,
            ),
          );
        }
      }
      for (const env of service.environment) {
        if (env.isSensitive && env.value && !env.value.startsWith('${')) {
          warnings.push(
            this.warning(
              'PLAINTEXT_SECRET',
              service.name,
              'warning',
              `Environment variable ${env.key} looks sensitive and has an inline value.`,
            ),
          );
        }
      }
      for (const port of service.ports) {
        if (port.host && this.isInfrastructurePort(port.container)) {
          warnings.push(
            this.warning(
              'PUBLISHED_INFRA_PORT',
              service.name,
              'warning',
              `Infrastructure port ${port.container} is published on the host.`,
            ),
          );
        }
      }
    }
    return warnings;
  }

  private warning(
    code: string,
    serviceName: string,
    severity: SecurityWarning['severity'],
    message: string,
  ): SecurityWarning {
    return { code, serviceName, severity, message };
  }

  private isHttpPort(port?: string): boolean {
    return Boolean(
      port && ['80', '3000', '3333', '4000', '5000', '8000', '8080', '8081'].includes(port),
    );
  }

  private isInfrastructurePort(port: string): boolean {
    return ['5432', '3306', '6379', '27017', '5672', '9092', '11211'].includes(port);
  }

  private isSensitiveEnv(key: string, value?: string): boolean {
    if (!value) {
      return false;
    }
    return /(password|secret|token|key|credential)/i.test(key);
  }
}
