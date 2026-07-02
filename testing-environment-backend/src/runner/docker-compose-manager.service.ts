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

  up(workspace: string): Promise<string> {
    return this.run(['compose', '-f', 'docker-compose.test.yml', 'up', '-d', '--build'], workspace);
  }

  logs(workspace: string): Promise<string> {
    return this.run(['compose', '-f', 'docker-compose.test.yml', 'logs', '--no-color'], workspace);
  }

  down(workspace: string): Promise<string> {
    return this.run(['compose', '-f', 'docker-compose.test.yml', 'down', '-v'], workspace);
  }

  private run(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', args, { cwd });
      let output = '';
      child.stdout.on('data', (chunk) => (output += chunk.toString()));
      child.stderr.on('data', (chunk) => (output += chunk.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
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
