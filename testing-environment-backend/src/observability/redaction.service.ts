import { Injectable } from '@nestjs/common';

const SECRET_KEY_PARTS = [
  'authorization',
  'cookie',
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'encryptedvalue',
];

const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const BASIC_PATTERN = /\bBasic\s+[A-Za-z0-9+/=-]+/gi;

@Injectable()
export class RedactionService {
  redact(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'string') {
      return this.redactString(value);
    }
    if (typeof value !== 'object') {
      return value;
    }
    if (value instanceof Error) {
      return {
        name: value.name,
        message: this.redactString(value.message),
        stack: value.stack ? this.redactString(value.stack) : undefined,
      };
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.redact(item));
    }

    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = this.isSecretKey(key) ? '[REDACTED]' : this.redact(item);
    }
    return output;
  }

  redactString(value: string): string {
    return value
      .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
      .replace(BASIC_PATTERN, 'Basic [REDACTED]');
  }

  private isSecretKey(key: string): boolean {
    const normalized = key.toLowerCase().replace(/[-\s]/g, '_');
    return SECRET_KEY_PARTS.some((part) => normalized.includes(part));
  }
}
