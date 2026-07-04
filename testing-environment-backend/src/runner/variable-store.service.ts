import { Injectable } from '@nestjs/common';

@Injectable()
export class VariableStoreService {
  create(): Map<string, string> {
    return new Map<string, string>();
  }

  interpolate<T>(value: T, variables: Map<string, string>): T {
    if (typeof value === 'string') {
      return value.replace(
        /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g,
        (_match, key) => variables.get(key) ?? '',
      ) as T;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.interpolate(item, variables)) as T;
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [key, this.interpolate(nested, variables)]),
      ) as T;
    }
    return value;
  }
}
