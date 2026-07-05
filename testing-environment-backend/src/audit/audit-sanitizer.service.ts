import { Injectable } from '@nestjs/common';

const SECRET_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'accesstoken',
  'apitoken',
  'secret',
  'encryptedvalue',
  'value',
]);

@Injectable()
export class AuditSanitizerService {
  sanitize(input: unknown): unknown {
    if (input === null || input === undefined) {
      return input;
    }
    if (Array.isArray(input)) {
      return input.map((item) => this.sanitize(item));
    }
    if (input instanceof Date) {
      return input.toISOString();
    }
    if (typeof input !== 'object') {
      return input;
    }

    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      output[key] = SECRET_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : this.sanitize(value);
    }
    return output;
  }
}
