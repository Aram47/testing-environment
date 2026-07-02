import { Injectable } from '@nestjs/common';

@Injectable()
export class AssertionEngineService {
  contains(actual: unknown, expected: unknown): boolean {
    if (expected === undefined) {
      return true;
    }
    if (expected === null || typeof expected !== 'object') {
      return actual === expected;
    }
    if (!actual || typeof actual !== 'object') {
      return false;
    }
    if (Array.isArray(expected)) {
      return Array.isArray(actual) && expected.every((item, index) => this.contains(actual[index], item));
    }
    return Object.entries(expected).every(([key, value]) =>
      this.contains((actual as Record<string, unknown>)[key], value),
    );
  }

  readJsonPath(payload: unknown, path: string): string | undefined {
    if (!path.startsWith('$.')) {
      return undefined;
    }
    const value = path
      .slice(2)
      .split('.')
      .reduce<unknown>((current, key) => {
        if (!current || typeof current !== 'object') {
          return undefined;
        }
        return (current as Record<string, unknown>)[key];
      }, payload);
    return value === undefined || value === null ? undefined : String(value);
  }
}
