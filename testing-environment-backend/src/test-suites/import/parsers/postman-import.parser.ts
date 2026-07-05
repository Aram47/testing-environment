import { BadRequestException, Injectable } from '@nestjs/common';
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
import {
  cleanRecord,
  ensureContent,
  normalizeMethod,
  splitUrlPathAndQuery,
  stableOperationId,
} from './import-parser-utils';

type PostmanItem = Record<string, unknown> & {
  name?: string;
  item?: PostmanItem[];
  request?: Record<string, unknown>;
  response?: Array<Record<string, unknown>>;
};

@Injectable()
export class PostmanImportParser implements ApiImportParser {
  constructor(private readonly warnings: ImportWarningService) {}

  parse(input: ImportParseInput): ImportParseResult {
    const document = this.parseDocument(ensureContent(input.content, 'Postman'));
    const items = Array.isArray(document.item) ? (document.item as PostmanItem[]) : [];
    if (items.length === 0) {
      throw new BadRequestException('Postman collection must include item[]');
    }

    const warnings: ImportWarning[] = [];
    const authSchemes: DetectedAuthScheme[] = [];
    const operations = this.walkItems(
      items,
      [],
      document.auth as Record<string, unknown> | undefined,
      warnings,
      authSchemes,
    );
    return {
      operations,
      authSchemes: this.warnings.mergeAuthSchemes(authSchemes),
      warnings: [...warnings, ...this.warnings.destructiveWarnings(operations)],
    };
  }

  private parseDocument(content: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new BadRequestException('Postman collection must be an object');
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Invalid Postman collection JSON: ${error instanceof Error ? error.message : 'parse failed'}`,
      );
    }
  }

  private walkItems(
    items: PostmanItem[],
    parents: string[],
    inheritedAuth: Record<string, unknown> | undefined,
    warnings: ImportWarning[],
    authSchemes: DetectedAuthScheme[],
  ): ImportedApiOperation[] {
    return items.flatMap((item) => {
      const nextParents = [...parents, item.name ?? 'Folder'];
      if (Array.isArray(item.item)) {
        return this.walkItems(
          item.item,
          nextParents,
          (item.auth as Record<string, unknown> | undefined) ?? inheritedAuth,
          warnings,
          authSchemes,
        );
      }
      if (!item.request || typeof item.request !== 'object') {
        return [];
      }
      const operation = this.toOperation(
        item,
        parents,
        (item.request.auth as Record<string, unknown> | undefined) ?? inheritedAuth,
        warnings,
        authSchemes,
      );
      const sanitized = this.warnings.sanitizeOperation(operation);
      authSchemes.push(...sanitized.authSchemes);
      warnings.push(...sanitized.warnings);
      return [sanitized.operation];
    });
  }

  private toOperation(
    item: PostmanItem,
    parents: string[],
    auth: Record<string, unknown> | undefined,
    warnings: ImportWarning[],
    authSchemes: DetectedAuthScheme[],
  ): ImportedApiOperation {
    const request = item.request ?? {};
    const method = normalizeMethod(String(request.method ?? 'GET'));
    const url = this.url(request.url);
    const parsedUrl = splitUrlPathAndQuery(url);
    const headers = this.headers(request.header);
    const query = { ...parsedUrl.query, ...this.query(request.url) };
    this.applyAuth(auth, headers, warnings, authSchemes);
    const responses = this.responses(item.response);

    return {
      id: stableOperationId(['postman', ...parents, item.name ?? method, method, parsedUrl.path]),
      name: [...parents, item.name ?? `${method} ${parsedUrl.path}`].filter(Boolean).join(' / '),
      method,
      path: parsedUrl.path,
      headers: cleanRecord(headers),
      query: cleanRecord(query),
      body: this.body(request.body),
      expectedResponses: responses,
      sourceMetadata: { sourceType: 'POSTMAN', folder: parents, rawName: item.name },
    };
  }

  private url(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (typeof record.raw === 'string') {
        return record.raw;
      }
      if (Array.isArray(record.path)) {
        return `/${record.path.join('/')}`;
      }
    }
    throw new BadRequestException('Postman request is missing URL');
  }

  private headers(value: unknown): Record<string, string> {
    if (!Array.isArray(value)) {
      return {};
    }
    return Object.fromEntries(
      value
        .filter(
          (header) =>
            header && typeof header === 'object' && !(header as { disabled?: boolean }).disabled,
        )
        .map((header) => [
          String((header as { key?: string }).key ?? ''),
          String((header as { value?: string }).value ?? ''),
        ])
        .filter(([key]) => key),
    );
  }

  private query(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const query = (value as Record<string, unknown>).query;
    if (!Array.isArray(query)) {
      return {};
    }
    return Object.fromEntries(
      query
        .filter(
          (entry) =>
            entry && typeof entry === 'object' && !(entry as { disabled?: boolean }).disabled,
        )
        .map((entry) => [
          String((entry as { key?: string }).key ?? ''),
          String((entry as { value?: string }).value ?? ''),
        ])
        .filter(([key]) => key),
    );
  }

  private body(value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    const record = value as Record<string, unknown>;
    if (record.mode === 'raw' && typeof record.raw === 'string') {
      try {
        return JSON.parse(record.raw);
      } catch {
        return record.raw;
      }
    }
    if (record.mode === 'urlencoded' && Array.isArray(record.urlencoded)) {
      return Object.fromEntries(
        record.urlencoded
          .filter(
            (entry) =>
              entry && typeof entry === 'object' && !(entry as { disabled?: boolean }).disabled,
          )
          .map((entry) => [
            String((entry as { key?: string }).key ?? ''),
            String((entry as { value?: string }).value ?? ''),
          ])
          .filter(([key]) => key),
      );
    }
    return record;
  }

  private responses(value: unknown): ImportedResponse[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((response) => ({
      status: String(response.code ?? '200'),
      description: response.name ? String(response.name) : undefined,
      body: typeof response.body === 'string' ? this.parseMaybeJson(response.body) : response.body,
    }));
  }

  private applyAuth(
    auth: Record<string, unknown> | undefined,
    headers: Record<string, string>,
    warnings: ImportWarning[],
    authSchemes: DetectedAuthScheme[],
  ): void {
    if (!auth) {
      return;
    }
    const type = String(auth.type ?? '').toLowerCase();
    if (type === 'bearer') {
      headers.Authorization = 'Bearer {{ secret.API_TOKEN }}';
      authSchemes.push({
        type: 'BEARER',
        name: 'bearer',
        location: 'header',
        parameterName: 'Authorization',
        secretKey: 'API_TOKEN',
        metadata: auth,
      });
    } else if (type === 'basic') {
      headers.Authorization = 'Basic {{ secret.BASIC_AUTH }}';
      authSchemes.push({
        type: 'BASIC',
        name: 'basic',
        location: 'header',
        parameterName: 'Authorization',
        secretKey: 'BASIC_AUTH',
        metadata: auth,
      });
    } else if (type === 'apikey') {
      const entries = Array.isArray(auth.apikey) ? auth.apikey : [];
      const keyEntry = entries.find(
        (entry) => entry && typeof entry === 'object' && (entry as { key?: string }).key === 'key',
      ) as { value?: string } | undefined;
      const inEntry = entries.find(
        (entry) => entry && typeof entry === 'object' && (entry as { key?: string }).key === 'in',
      ) as { value?: string } | undefined;
      const parameterName = keyEntry?.value ?? 'X-API-Key';
      if (inEntry?.value === 'query') {
        authSchemes.push({
          type: 'API_KEY',
          name: parameterName,
          location: 'query',
          parameterName,
          secretKey: 'API_KEY',
          metadata: auth,
        });
      } else {
        headers[parameterName] = '{{ secret.API_KEY }}';
        authSchemes.push({
          type: 'API_KEY',
          name: parameterName,
          location: 'header',
          parameterName,
          secretKey: 'API_KEY',
          metadata: auth,
        });
      }
    } else if (type === 'oauth2') {
      headers.Authorization = 'Bearer {{ secret.API_TOKEN }}';
      authSchemes.push({
        type: 'OAUTH',
        name: 'oauth2',
        location: 'metadata',
        secretKey: 'API_TOKEN',
        metadata: auth,
      });
    }
    if (type) {
      warnings.push({
        code: 'AUTH_SECRET_REFERENCE_SUGGESTED',
        severity: 'info',
        message: `Postman ${type} auth was converted to project secret references.`,
      });
    }
  }

  private parseMaybeJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
