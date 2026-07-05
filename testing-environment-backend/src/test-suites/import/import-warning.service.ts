import { Injectable } from '@nestjs/common';
import { DetectedAuthScheme, ImportedApiOperation, ImportWarning } from '../types/api-import.types';

const DESTRUCTIVE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE_QUERY_NAMES =
  /api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password/i;

@Injectable()
export class ImportWarningService {
  destructiveMethods(): ReadonlySet<string> {
    return DESTRUCTIVE_METHODS;
  }

  isDestructive(method: string): boolean {
    return DESTRUCTIVE_METHODS.has(method.toUpperCase());
  }

  destructiveWarnings(operations: ImportedApiOperation[]): ImportWarning[] {
    return operations
      .filter((operation) => this.isDestructive(operation.method))
      .map((operation) => ({
        code: 'DESTRUCTIVE_OPERATION',
        severity: 'warning',
        operationId: operation.id,
        message: `${operation.method.toUpperCase()} ${operation.path} can mutate data and requires confirmation before flow generation.`,
      }));
  }

  sanitizeOperation(operation: ImportedApiOperation): {
    operation: ImportedApiOperation;
    authSchemes: DetectedAuthScheme[];
    warnings: ImportWarning[];
  } {
    const warnings: ImportWarning[] = [];
    const authSchemes: DetectedAuthScheme[] = [];
    const headers: Record<string, string> = {};
    const query: Record<string, string> = {};

    for (const [name, value] of Object.entries(operation.headers ?? {})) {
      const sanitized = this.sanitizeHeader(name, String(value), operation.id);
      headers[name] = sanitized.value;
      warnings.push(...sanitized.warnings);
      authSchemes.push(...sanitized.authSchemes);
    }

    for (const [name, value] of Object.entries(operation.query ?? {})) {
      if (SENSITIVE_QUERY_NAMES.test(name) && value && !this.isSecretReference(value)) {
        query[name] = '{{ secret.API_KEY }}';
        authSchemes.push({
          type: 'API_KEY',
          name: name.toUpperCase(),
          location: 'query',
          parameterName: name,
          secretKey: 'API_KEY',
        });
        warnings.push({
          code: 'LITERAL_CREDENTIAL_REPLACED',
          severity: 'warning',
          operationId: operation.id,
          message: `Query parameter "${name}" looked sensitive and was replaced with {{ secret.API_KEY }}.`,
        });
      } else {
        query[name] = String(value);
      }
    }

    return {
      operation: { ...operation, headers, query },
      authSchemes,
      warnings,
    };
  }

  mergeAuthSchemes(schemes: DetectedAuthScheme[]): DetectedAuthScheme[] {
    const byKey = new Map<string, DetectedAuthScheme>();
    for (const scheme of schemes) {
      const key = `${scheme.type}:${scheme.location ?? ''}:${scheme.parameterName ?? scheme.name}:${scheme.secretKey ?? ''}`;
      if (!byKey.has(key)) {
        byKey.set(key, scheme);
      }
    }
    return [...byKey.values()];
  }

  suggestedSecrets(authSchemes: DetectedAuthScheme[]): string[] {
    return [
      ...new Set(authSchemes.flatMap((scheme) => (scheme.secretKey ? [scheme.secretKey] : []))),
    ].sort();
  }

  ignoredExecutableWarning(source: string): ImportWarning {
    return {
      code: 'EXECUTABLE_IMPORT_CONTENT_IGNORED',
      severity: 'warning',
      message: `${source} scripts, tests, or hooks were ignored. Imported content is never executed.`,
    };
  }

  private sanitizeHeader(
    name: string,
    value: string,
    operationId: string,
  ): {
    value: string;
    authSchemes: DetectedAuthScheme[];
    warnings: ImportWarning[];
  } {
    const lowerName = name.toLowerCase();
    const authSchemes: DetectedAuthScheme[] = [];
    const warnings: ImportWarning[] = [];

    if (lowerName === 'authorization') {
      const bearer = value.match(/^Bearer\s+(.+)$/i);
      if (bearer && !this.isSecretReference(value)) {
        authSchemes.push({
          type: 'BEARER',
          name: 'Authorization',
          location: 'header',
          parameterName: name,
          secretKey: 'API_TOKEN',
        });
        warnings.push({
          code: 'LITERAL_CREDENTIAL_REPLACED',
          severity: 'warning',
          operationId,
          message: 'Bearer token was replaced with {{ secret.API_TOKEN }}.',
        });
        return { value: 'Bearer {{ secret.API_TOKEN }}', authSchemes, warnings };
      }

      const basic = value.match(/^Basic\s+(.+)$/i);
      if (basic && !this.isSecretReference(value)) {
        authSchemes.push({
          type: 'BASIC',
          name: 'Authorization',
          location: 'header',
          parameterName: name,
          secretKey: 'BASIC_AUTH',
        });
        warnings.push({
          code: 'LITERAL_CREDENTIAL_REPLACED',
          severity: 'warning',
          operationId,
          message: 'Basic credentials were replaced with {{ secret.BASIC_AUTH }}.',
        });
        return { value: 'Basic {{ secret.BASIC_AUTH }}', authSchemes, warnings };
      }
    }

    if (
      /(api[_-]?key|token|secret|password)/i.test(name) &&
      value &&
      !this.isSecretReference(value)
    ) {
      authSchemes.push({
        type: 'API_KEY',
        name,
        location: 'header',
        parameterName: name,
        secretKey: 'API_KEY',
      });
      warnings.push({
        code: 'LITERAL_CREDENTIAL_REPLACED',
        severity: 'warning',
        operationId,
        message: `Header "${name}" looked sensitive and was replaced with {{ secret.API_KEY }}.`,
      });
      return { value: '{{ secret.API_KEY }}', authSchemes, warnings };
    }

    return { value, authSchemes, warnings };
  }

  private isSecretReference(value: string): boolean {
    return /\{\{\s*secret\.[A-Z0-9_]{2,80}\s*\}\}/.test(value);
  }
}
