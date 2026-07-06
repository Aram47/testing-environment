import { BadRequestException, Injectable } from '@nestjs/common';
import * as yaml from 'js-yaml';
import {
  DetectedAuthScheme,
  ImportedApiOperation,
  ImportedResponse,
  ImportParseInput,
  ImportParseResult,
  ImportWarning,
} from '../../types/api-import.types';
import { ImportWarningService } from '../import-warning.service';
import { ApiImportParser } from './api-import-parser.interface';
import { cleanRecord, ensureContent, HTTP_METHODS, stableOperationId } from './import-parser-utils';

type OpenApiDocument = Record<string, unknown> & {
  openapi?: string;
  swagger?: string;
  paths?: Record<string, Record<string, unknown>>;
  components?: { securitySchemes?: Record<string, Record<string, unknown>> };
  security?: Array<Record<string, string[]>>;
};

@Injectable()
export class OpenApiImportParser implements ApiImportParser {
  constructor(private readonly warnings: ImportWarningService) {}

  parse(input: ImportParseInput): ImportParseResult {
    const document = this.parseDocument(ensureContent(input.content, 'OpenAPI'));
    const paths = document.paths;
    if (!paths || typeof paths !== 'object' || Array.isArray(paths)) {
      throw new BadRequestException('OpenAPI document must include paths');
    }

    const authSchemes = this.detectSecuritySchemes(document);
    const warnings: ImportWarning[] = [];
    const operations: ImportedApiOperation[] = [];

    for (const [path, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') {
        continue;
      }
      const pathParameters = this.parameters(
        (pathItem as Record<string, unknown>).parameters,
        document,
        warnings,
      );
      for (const method of HTTP_METHODS.map((item) => item.toLowerCase())) {
        const operation = (pathItem as Record<string, unknown>)[method];
        if (!operation || typeof operation !== 'object') {
          continue;
        }
        const operationRecord = operation as Record<string, unknown>;
        const operationParameters = [
          ...pathParameters,
          ...this.parameters(operationRecord.parameters, document, warnings),
        ];
        const request = this.requestParts(operationParameters);
        this.applySecurityPlaceholders(
          request,
          operationRecord.security,
          document.security,
          authSchemes,
          warnings,
        );
        const responses = this.responses(operationRecord.responses, document, warnings);
        const imported: ImportedApiOperation = {
          id: String(operationRecord.operationId ?? stableOperationId(['openapi', method, path])),
          name: String(
            operationRecord.summary ??
              operationRecord.operationId ??
              `${method.toUpperCase()} ${path}`,
          ),
          method: method.toUpperCase(),
          path,
          headers: request.headers,
          query: request.query,
          body: this.requestBodyExample(operationRecord.requestBody, document, warnings),
          expectedResponses: responses,
          sourceMetadata: {
            sourceType: 'OPENAPI',
            operationId: operationRecord.operationId,
            tags: operationRecord.tags,
            security: operationRecord.security ?? document.security,
          },
        };
        const sanitized = this.warnings.sanitizeOperation(imported);
        operations.push(sanitized.operation);
        authSchemes.push(...sanitized.authSchemes);
        warnings.push(...sanitized.warnings);
      }
    }

    return {
      operations,
      authSchemes: this.warnings.mergeAuthSchemes(authSchemes),
      warnings: [...warnings, ...this.warnings.destructiveWarnings(operations)],
    };
  }

  private parseDocument(content: string): OpenApiDocument {
    try {
      const parsed = yaml.load(content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new BadRequestException('OpenAPI document must be an object');
      }
      const document = parsed as OpenApiDocument;
      if (!document.openapi && !document.swagger) {
        throw new BadRequestException('OpenAPI document must include openapi or swagger version');
      }
      return document;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Invalid OpenAPI document: ${error instanceof Error ? error.message : 'parse failed'}`,
      );
    }
  }

  private detectSecuritySchemes(document: OpenApiDocument): DetectedAuthScheme[] {
    return Object.entries(document.components?.securitySchemes ?? {}).flatMap<DetectedAuthScheme>(
      ([name, scheme]) => {
        const type = String(scheme.type ?? '').toLowerCase();
        const location = String(scheme.in ?? 'metadata') as DetectedAuthScheme['location'];
        if (type === 'http' && String(scheme.scheme ?? '').toLowerCase() === 'bearer') {
          return [
            {
              type: 'BEARER',
              name,
              location: 'header',
              parameterName: 'Authorization',
              secretKey: 'API_TOKEN',
              metadata: scheme,
            },
          ];
        }
        if (type === 'http' && String(scheme.scheme ?? '').toLowerCase() === 'basic') {
          return [
            {
              type: 'BASIC',
              name,
              location: 'header',
              parameterName: 'Authorization',
              secretKey: 'BASIC_AUTH',
              metadata: scheme,
            },
          ];
        }
        if (type === 'apiKey') {
          return [
            {
              type: 'API_KEY',
              name,
              location: ['header', 'query', 'cookie'].includes(location ?? '')
                ? location
                : 'metadata',
              parameterName: String(scheme.name ?? name),
              secretKey: 'API_KEY',
              metadata: scheme,
            },
          ];
        }
        if (type === 'oauth2' || type === 'openIdConnect') {
          return [
            { type: 'OAUTH', name, location: 'metadata', secretKey: 'API_TOKEN', metadata: scheme },
          ];
        }
        return [];
      },
    );
  }

  private parameters(
    value: unknown,
    document: OpenApiDocument,
    warnings: ImportWarning[],
  ): Record<string, unknown>[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.flatMap((parameter) => {
      const resolved = this.resolveRef(parameter, document, warnings);
      return resolved && typeof resolved === 'object' && !Array.isArray(resolved)
        ? [resolved as Record<string, unknown>]
        : [];
    });
  }

  private requestParts(parameters: Record<string, unknown>[]): {
    headers: Record<string, string>;
    query: Record<string, string>;
  } {
    const headers: Record<string, string> = {};
    const query: Record<string, string> = {};
    for (const parameter of parameters) {
      const name = String(parameter.name ?? '');
      if (!name) {
        continue;
      }
      const example = this.exampleFrom(parameter) ?? '';
      if (parameter.in === 'header') {
        headers[name] = String(example);
      }
      if (parameter.in === 'query') {
        query[name] = String(example);
      }
    }
    return { headers: cleanRecord(headers), query: cleanRecord(query) };
  }

  private applySecurityPlaceholders(
    request: { headers: Record<string, string>; query: Record<string, string> },
    operationSecurity: unknown,
    documentSecurity: OpenApiDocument['security'],
    authSchemes: DetectedAuthScheme[],
    warnings: ImportWarning[],
  ): void {
    const security = operationSecurity === undefined ? documentSecurity : operationSecurity;
    if (Array.isArray(security) && security.length === 0) {
      return;
    }
    if (!Array.isArray(security) || security.length === 0 || authSchemes.length === 0) {
      return;
    }

    const referencedNames = new Set(
      security.flatMap((requirement) =>
        requirement && typeof requirement === 'object' && !Array.isArray(requirement)
          ? Object.keys(requirement)
          : [],
      ),
    );

    for (const scheme of authSchemes.filter((item) => referencedNames.has(item.name))) {
      if (scheme.type === 'BEARER' || scheme.type === 'OAUTH') {
        request.headers.Authorization =
          request.headers.Authorization ?? 'Bearer {{ secret.API_TOKEN }}';
      } else if (scheme.type === 'BASIC') {
        request.headers.Authorization =
          request.headers.Authorization ?? 'Basic {{ secret.BASIC_AUTH }}';
      } else if (scheme.type === 'API_KEY') {
        const parameterName = scheme.parameterName ?? scheme.name;
        if (scheme.location === 'query') {
          request.query[parameterName] = request.query[parameterName] ?? '{{ secret.API_KEY }}';
        } else {
          request.headers[parameterName] = request.headers[parameterName] ?? '{{ secret.API_KEY }}';
        }
      }
    }

    warnings.push({
      code: 'AUTH_SECRET_REFERENCE_SUGGESTED',
      severity: 'info',
      message: 'OpenAPI security schemes were converted to project secret references.',
    });
  }

  private requestBodyExample(
    value: unknown,
    document: OpenApiDocument,
    warnings: ImportWarning[],
  ): unknown {
    const requestBody = this.resolveRef(value, document, warnings);
    if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
      return undefined;
    }
    const content = (requestBody as { content?: Record<string, Record<string, unknown>> }).content;
    const media = content?.['application/json'] ?? Object.values(content ?? {})[0];
    if (!media) {
      return undefined;
    }
    return this.exampleFrom(media);
  }

  private responses(
    value: unknown,
    document: OpenApiDocument,
    warnings: ImportWarning[],
  ): ImportedResponse[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return [];
    }
    return Object.entries(value).map(([status, response]) => {
      const resolved = this.resolveRef(response, document, warnings) as
        Record<string, unknown> | undefined;
      return {
        status,
        description: resolved?.description ? String(resolved.description) : undefined,
        body: this.responseBodyExample(resolved),
      };
    });
  }

  private responseBodyExample(response: Record<string, unknown> | undefined): unknown {
    const content = response?.content as Record<string, Record<string, unknown>> | undefined;
    const media = content?.['application/json'] ?? Object.values(content ?? {})[0];
    return media ? this.exampleFrom(media) : undefined;
  }

  private exampleFrom(value: Record<string, unknown>): unknown {
    if ('example' in value) {
      return value.example;
    }
    const examples = value.examples;
    if (examples && typeof examples === 'object' && !Array.isArray(examples)) {
      const first = Object.values(examples)[0];
      if (first && typeof first === 'object' && 'value' in first) {
        return (first as { value?: unknown }).value;
      }
      return first;
    }
    return undefined;
  }

  private resolveRef(
    value: unknown,
    document: OpenApiDocument,
    warnings: ImportWarning[],
  ): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !('$ref' in value)) {
      return value;
    }
    const ref = String((value as { $ref?: string }).$ref);
    if (!ref.startsWith('#/')) {
      warnings.push({
        code: 'EXTERNAL_REF_IGNORED',
        severity: 'warning',
        message: `External OpenAPI reference was ignored: ${ref}`,
      });
      return undefined;
    }
    return ref
      .slice(2)
      .split('/')
      .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
      .reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
          return (current as Record<string, unknown>)[part];
        }
        return undefined;
      }, document);
  }
}
