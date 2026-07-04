import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthcheckService {
  async waitFor(
    baseUrl: string,
    path: string,
    expectedStatus: number,
    timeoutSeconds: number,
    signal?: AbortSignal,
  ): Promise<void> {
    const url = new URL(path, baseUrl);
    const deadline = Date.now() + timeoutSeconds * 1000;
    let lastError = 'Healthcheck did not complete';
    while (Date.now() < deadline) {
      if (signal?.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error('Healthcheck aborted');
      }
      try {
        const response = await fetch(url, { signal });
        if (response.status === expectedStatus) {
          return;
        }
        lastError = `Healthcheck ${url.toString()} expected ${expectedStatus}, got ${response.status}`;
      } catch (error) {
        if (signal?.aborted) {
          throw signal.reason instanceof Error ? signal.reason : new Error('Healthcheck aborted');
        }
        lastError = `Healthcheck ${url.toString()} failed: ${error instanceof Error ? error.message : 'fetch failed'}`;
      }
      await this.sleep(1000, signal);
    }
    throw new Error(lastError);
  }

  private sleep(durationMs: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason instanceof Error ? signal.reason : new Error('Healthcheck aborted'));
        return;
      }
      const timeout = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        resolve();
      }, durationMs);
      const abort = () => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
        reject(signal?.reason instanceof Error ? signal.reason : new Error('Healthcheck aborted'));
      };
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
}
