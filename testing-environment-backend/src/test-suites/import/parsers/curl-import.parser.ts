import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DetectedAuthScheme,
  ImportedApiOperation,
  ImportParseInput,
  ImportParseResult,
  ImportWarning,
} from '../../types/api-import.types';
import { ImportWarningService } from '../import-warning.service';
import {
  cleanRecord,
  ensureContent,
  normalizeMethod,
  splitUrlPathAndQuery,
  stableOperationId,
} from './import-parser-utils';
import { ApiImportParser } from './api-import-parser.interface';

@Injectable()
export class CurlImportParser implements ApiImportParser {
  constructor(private readonly warnings: ImportWarningService) {}

  parse(input: ImportParseInput): ImportParseResult {
    const content = ensureContent(input.content, 'cURL');
    this.rejectShellSyntax(content);
    const tokens = this.tokenize(content);
    if (tokens[0] === 'curl') {
      tokens.shift();
    }
    if (tokens.length === 0) {
      throw new BadRequestException('cURL command does not include a URL');
    }

    let method = '';
    let url = '';
    let body: unknown;
    let useGetData = false;
    const headers: Record<string, string> = {};
    const query: Record<string, string> = {};
    const localAuth: DetectedAuthScheme[] = [];
    const localWarnings: ImportWarning[] = [];

    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const next = () => {
        const value = tokens[index + 1];
        if (value === undefined) {
          throw new BadRequestException(`cURL option ${token} needs a value`);
        }
        index += 1;
        return value;
      };

      if (token === '-X' || token === '--request') {
        method = normalizeMethod(next());
      } else if (token.startsWith('-X') && token.length > 2) {
        method = normalizeMethod(token.slice(2));
      } else if (token === '-H' || token === '--header') {
        this.addHeader(headers, next());
      } else if (token.startsWith('-H') && token.length > 2) {
        this.addHeader(headers, token.slice(2));
      } else if (
        token === '-d' ||
        token === '--data' ||
        token === '--data-raw' ||
        token === '--data-binary' ||
        token === '--data-ascii'
      ) {
        body = this.parseBody(next());
        if (!method) {
          method = 'POST';
        }
      } else if (token.startsWith('-d') && token.length > 2) {
        body = this.parseBody(token.slice(2));
        if (!method) {
          method = 'POST';
        }
      } else if (token === '--url') {
        url = next();
      } else if (token === '-u' || token === '--user') {
        next();
        headers.Authorization = 'Basic {{ secret.BASIC_AUTH }}';
        localAuth.push({
          type: 'BASIC',
          name: 'Authorization',
          location: 'header',
          parameterName: 'Authorization',
          secretKey: 'BASIC_AUTH',
        });
        localWarnings.push({
          code: 'LITERAL_CREDENTIAL_REPLACED',
          severity: 'warning',
          message: 'cURL basic auth credentials were replaced with {{ secret.BASIC_AUTH }}.',
        });
      } else if (token === '-G' || token === '--get') {
        useGetData = true;
        if (!method) {
          method = 'GET';
        }
      } else if (!token.startsWith('-') && !url) {
        url = token;
      }
    }

    if (!url) {
      throw new BadRequestException('cURL command does not include a URL');
    }
    if (useGetData && body && typeof body === 'string') {
      Object.assign(query, Object.fromEntries(new URLSearchParams(body).entries()));
      body = undefined;
    }

    const parsedUrl = splitUrlPathAndQuery(url);
    const normalizedMethod = normalizeMethod(method || 'GET');
    const operation: ImportedApiOperation = {
      id: stableOperationId(['curl', normalizedMethod, parsedUrl.path]),
      name: `${normalizedMethod} ${parsedUrl.path}`,
      method: normalizedMethod,
      path: parsedUrl.path,
      headers: cleanRecord(headers),
      query: { ...parsedUrl.query, ...query },
      body,
      expectedResponses: [{ status: '200', description: 'Default cURL expectation' }],
      sourceMetadata: { sourceType: 'CURL', rawCommand: content },
    };

    const sanitized = this.warnings.sanitizeOperation(operation);
    return {
      operations: [sanitized.operation],
      authSchemes: this.warnings.mergeAuthSchemes([...localAuth, ...sanitized.authSchemes]),
      warnings: [
        ...localWarnings,
        ...sanitized.warnings,
        ...this.warnings.destructiveWarnings([sanitized.operation]),
      ],
    };
  }

  private rejectShellSyntax(command: string): void {
    if (/[|;<>`]/.test(command) || /\$\s*\(/.test(command)) {
      throw new BadRequestException('cURL import rejects shell operators and command substitution');
    }
  }

  private tokenize(command: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let quote: '"' | "'" | undefined;
    let escaping = false;

    for (const char of command) {
      if (escaping) {
        current += char;
        escaping = false;
        continue;
      }
      if (char === '\\' && quote !== "'") {
        escaping = true;
        continue;
      }
      if ((char === '"' || char === "'") && !quote) {
        quote = char;
        continue;
      }
      if (quote === char) {
        quote = undefined;
        continue;
      }
      if (!quote && /\s/.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }
      current += char;
    }
    if (quote) {
      throw new BadRequestException('cURL command contains an unterminated quote');
    }
    if (current) {
      tokens.push(current);
    }
    return tokens;
  }

  private addHeader(headers: Record<string, string>, header: string): void {
    const separator = header.indexOf(':');
    if (separator <= 0) {
      throw new BadRequestException(`Invalid cURL header: ${header}`);
    }
    headers[header.slice(0, separator).trim()] = header.slice(separator + 1).trim();
  }

  private parseBody(raw: string): unknown {
    const trimmed = raw.trim();
    if (!trimmed) {
      return undefined;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
}
