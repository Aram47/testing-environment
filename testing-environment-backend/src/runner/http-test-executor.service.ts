import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpExecutionResult, YamlRequestStep } from './types/yaml-test.types';
import { VariableStoreService } from './variable-store.service';

@Injectable()
export class HttpTestExecutorService {
  constructor(
    private readonly config: ConfigService,
    private readonly variables: VariableStoreService,
  ) {}

  async execute(
    baseUrl: string,
    test: YamlRequestStep,
    store: Map<string, string>,
  ): Promise<HttpExecutionResult> {
    const started = Date.now();
    const request = this.variables.interpolate(test.request, store);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get<number>('RUNNER_REQUEST_TIMEOUT_MS', 30000),
    );

    try {
      const url = new URL(request.path, baseUrl);
      Object.entries(request.query ?? {}).forEach(([key, value]) =>
        url.searchParams.set(key, String(value)),
      );
      const response = await fetch(url, {
        method: request.method.toUpperCase(),
        headers: { 'content-type': 'application/json', ...(request.headers ?? {}) },
        body: request.json === undefined ? undefined : JSON.stringify(request.json),
        signal: controller.signal,
      });
      const text = await response.text();
      const responseBody = this.parseBody(text);
      return { actualStatus: response.status, responseBody, durationMs: Date.now() - started };
    } catch (error) {
      return {
        durationMs: Date.now() - started,
        errorMessage: error instanceof Error ? error.message : 'Request failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseBody(text: string): unknown {
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
