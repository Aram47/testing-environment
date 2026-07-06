import { Injectable } from '@nestjs/common';
import { YamlAssertion } from './types/yaml-test.types';

export interface AssertionEvaluation {
  passed: boolean;
  message?: string;
}

export interface DetailedAssertionEvaluation extends AssertionEvaluation {
  fieldPath: string;
  operator: string;
  expected?: unknown;
  actual?: unknown;
}

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
      return (
        Array.isArray(actual) && expected.every((item, index) => this.contains(actual[index], item))
      );
    }
    return Object.entries(expected).every(([key, value]) =>
      this.contains((actual as Record<string, unknown>)[key], value),
    );
  }

  readJsonPath(payload: unknown, path: string): string | undefined {
    const value = this.readJsonValue(payload, path);
    return value === undefined || value === null ? undefined : String(value);
  }

  readJsonValue(payload: unknown, path: string): unknown {
    if (!path.startsWith('$.')) {
      return undefined;
    }
    return path
      .slice(2)
      .split('.')
      .reduce<unknown>((current, key) => {
        if (!current || typeof current !== 'object') {
          return undefined;
        }
        return (current as Record<string, unknown>)[key];
      }, payload);
  }

  evaluateAssertions(
    payload: unknown,
    assertions: YamlAssertion[] | undefined,
  ): AssertionEvaluation {
    const all = this.evaluateAllAssertions(payload, assertions);
    const failed = all.find((result) => !result.passed);
    if (failed) {
      return { passed: false, message: failed.message };
    }
    return { passed: true };
  }

  evaluateAllAssertions(
    payload: unknown,
    assertions: YamlAssertion[] | undefined,
  ): DetailedAssertionEvaluation[] {
    return (assertions ?? []).map((assertion) => {
      const result = this.evaluateAssertion(payload, assertion);
      const actual = this.readJsonValue(payload, assertion.field_path);
      return {
        fieldPath: assertion.field_path,
        operator: assertion.operator,
        expected: assertion.expected_value,
        actual,
        passed: result.passed,
        message: result.message,
      };
    });
  }

  private evaluateAssertion(payload: unknown, assertion: YamlAssertion): AssertionEvaluation {
    const actual = this.readJsonValue(payload, assertion.field_path);

    if (assertion.operator === 'exists') {
      return actual === undefined
        ? { passed: false, message: `Response field ${assertion.field_path} does not exist` }
        : { passed: true };
    }

    if (actual === undefined) {
      return { passed: false, message: `Response field ${assertion.field_path} does not exist` };
    }

    const expected = assertion.expected_value ?? '';
    if (assertion.operator === 'equals') {
      return String(actual) === expected
        ? { passed: true }
        : {
            passed: false,
            message: `Expected ${assertion.field_path} to equal "${expected}", got "${String(actual)}"`,
          };
    }

    if (assertion.operator === 'contains') {
      return String(actual).includes(expected)
        ? { passed: true }
        : {
            passed: false,
            message: `Expected ${assertion.field_path} to contain "${expected}", got "${String(actual)}"`,
          };
    }

    return { passed: false, message: `Unsupported assertion operator "${assertion.operator}"` };
  }
}
