import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthcheckService {
  async waitFor(
    baseUrl: string,
    path: string,
    expectedStatus: number,
    timeoutSeconds: number,
  ): Promise<void> {
    const url = new URL(path, baseUrl);
    const deadline = Date.now() + timeoutSeconds * 1000;
    let lastError = 'Healthcheck did not complete';
    while (Date.now() < deadline) {
      try {
        const response = await fetch(url);
        if (response.status === expectedStatus) {
          return;
        }
        lastError = `Healthcheck ${url.toString()} expected ${expectedStatus}, got ${response.status}`;
      } catch (error) {
        lastError = `Healthcheck ${url.toString()} failed: ${error instanceof Error ? error.message : 'fetch failed'}`;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(lastError);
  }
}
