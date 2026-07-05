import { Injectable } from '@nestjs/common';

export interface SecretMaskingContext {
  values: string[];
}

const MASK = '[SECRET]';

@Injectable()
export class SecretMaskingService {
  createContext(values: Iterable<string>): SecretMaskingContext {
    return {
      values: [...new Set([...values].filter((value) => value.length >= 3))],
    };
  }

  emptyContext(): SecretMaskingContext {
    return { values: [] };
  }

  maskString(value: string, context: SecretMaskingContext): string {
    let masked = value;
    for (const secret of context.values) {
      masked = masked.split(secret).join(MASK);
      try {
        masked = masked.split(encodeURIComponent(secret)).join(MASK);
      } catch {
        continue;
      }
    }

    masked = masked.replace(
      /\b(Authorization\s*[:=]\s*)(Bearer|Basic)\s+[^\s'",}]+/gi,
      `$1$2 ${MASK}`,
    );
    masked = masked.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${MASK}`);
    masked = masked.replace(
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password)(\s*[:=]\s*)[^\s'",}&]+/gi,
      `$1$2${MASK}`,
    );
    masked = masked.replace(
      /([?&](?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password)=)[^&#\s'"]+/gi,
      `$1${MASK}`,
    );

    return masked;
  }

  maskValue<T>(value: T, context: SecretMaskingContext): T {
    if (typeof value === 'string') {
      return this.maskString(value, context) as T;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.maskValue(item, context)) as T;
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => {
          if (
            /authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password/i.test(
              key,
            )
          ) {
            return [key, MASK];
          }
          return [key, this.maskValue(nested, context)];
        }),
      ) as T;
    }

    return value;
  }
}
