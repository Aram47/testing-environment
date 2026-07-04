import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as yaml from 'js-yaml';

@Injectable()
export class DockerComposeManagerService {
  private readonly logger = new Logger(DockerComposeManagerService.name);

  validateCompose(composeYaml: string): void {
    // MVP guardrail only. A production SaaS runner must use isolated VMs or self-hosted runners,
    // never untrusted customer containers on a shared Docker host.
    const parsed = yaml.load(composeYaml) as Record<string, any>;
    const services = parsed?.services;
    if (!services || typeof services !== 'object') {
      throw new BadRequestException('Compose YAML must define services');
    }

    for (const [serviceName, service] of Object.entries<Record<string, any>>(services)) {
      if (service.privileged === true) {
        throw new BadRequestException(`Service ${serviceName} cannot use privileged mode`);
      }
      if (service.network_mode === 'host') {
        throw new BadRequestException(`Service ${serviceName} cannot use host network mode`);
      }
      const volumes = service.volumes ?? [];
      for (const volume of volumes) {
        const source = typeof volume === 'string' ? volume : volume?.source;
        if (String(source).includes('/var/run/docker.sock') || String(source) === '/') {
          throw new BadRequestException(`Service ${serviceName} uses a forbidden volume mount`);
        }
      }
    }
  }

  up(workspace: string, signal?: AbortSignal): Promise<string> {
    return this.run(
      ['compose', '-f', 'docker-compose.test.yml', 'up', '-d', '--build'],
      workspace,
      signal,
    );
  }

  logs(workspace: string): Promise<string> {
    return this.run(['compose', '-f', 'docker-compose.test.yml', 'logs', '--no-color'], workspace);
  }

  down(workspace: string): Promise<string> {
    return this.run(['compose', '-f', 'docker-compose.test.yml', 'down', '-v'], workspace);
  }

  private run(args: string[], cwd: string, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', args, { cwd });
      let output = '';
      let forceKillTimer: NodeJS.Timeout | undefined;
      const abortChild = () => {
        child.kill('SIGTERM');
        forceKillTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
      };
      if (signal?.aborted) {
        abortChild();
      } else {
        signal?.addEventListener('abort', abortChild, { once: true });
      }
      child.stdout.on('data', (chunk) => (output += chunk.toString()));
      child.stderr.on('data', (chunk) => (output += chunk.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
        if (forceKillTimer) {
          clearTimeout(forceKillTimer);
        }
        signal?.removeEventListener('abort', abortChild);
        if (signal?.aborted) {
          reject(signal.reason instanceof Error ? signal.reason : new Error('Docker aborted'));
          return;
        }
        if (code === 0) {
          resolve(output);
          return;
        }
        this.logger.warn(output);
        reject(new Error(`docker ${args.join(' ')} failed with code ${code}: ${output}`));
      });
    });
  }
}
