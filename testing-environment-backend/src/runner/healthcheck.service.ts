import { Injectable } from '@nestjs/common';

export interface HealthcheckResult {
  passed: boolean;
  expectedStatus: number;
  actualStatus?: number;
  durationMs: number;
  url: string;
  message?: string;
}

@Injectable()
export class HealthcheckService {
  async waitFor(
    baseUrl: string,
    path: string,
    expectedStatus: number,
    timeoutSeconds: number,
    signal?: AbortSignal,
  ): Promise<HealthcheckResult> {
    const url = new URL(path, baseUrl);
    const started = Date.now();
    const deadline = started + timeoutSeconds * 1000;
    let lastError = 'Healthcheck did not complete';
    let lastActualStatus: number | undefined;
    while (Date.now() < deadline) {
      if (signal?.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error('Healthcheck aborted');
      }
      try {
        const response = await fetch(url, { signal });
        lastActualStatus = response.status;
        if (response.status === expectedStatus) {
          return {
            passed: true,
            expectedStatus,
            actualStatus: response.status,
            durationMs: Date.now() - started,
            url: url.toString(),
          };
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
    const result: HealthcheckResult = {
      passed: false,
      expectedStatus,
      actualStatus: lastActualStatus,
      durationMs: Date.now() - started,
      url: url.toString(),
      message: lastError,
    };
    throw Object.assign(new Error(lastError), { healthcheckResult: result });
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
