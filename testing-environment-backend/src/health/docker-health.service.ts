import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';

@Injectable()
export class DockerHealthService {
  check(): Promise<'ok' | 'error'> {
    return new Promise((resolve) => {
      const child = spawn('docker', ['version', '--format', '{{.Server.Version}}']);
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        resolve('error');
      }, 1500);
      child.once('error', () => {
        clearTimeout(timeout);
        resolve('error');
      });
      child.once('close', (code) => {
        clearTimeout(timeout);
        resolve(code === 0 ? 'ok' : 'error');
      });
    });
  }
}
