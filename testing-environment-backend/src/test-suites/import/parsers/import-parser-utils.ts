import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ImportedResponse } from '../../types/api-import.types';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

export function stableOperationId(parts: string[]): string {
  const base = parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  const hash = createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 8);
  return `${base || 'operation'}-${hash}`;
}

export function ensureContent(content: string | undefined, label: string): string {
  if (!content?.trim()) {
    throw new BadRequestException(`${label} import content is required`);
  }
  return content;
}

export function normalizeMethod(method: string | undefined): string {
  const normalized = method?.trim().toUpperCase();
  if (!normalized || !HTTP_METHODS.includes(normalized as (typeof HTTP_METHODS)[number])) {
    throw new BadRequestException(`Unsupported HTTP method: ${method ?? 'unknown'}`);
  }
  return normalized;
}

export function splitUrlPathAndQuery(rawUrl: string): {
  path: string;
  query: Record<string, string>;
} {
  const value = rawUrl.trim();
  if (!value) {
    throw new BadRequestException('Request URL or path is required');
  }

  let pathWithQuery = value;
  try {
    const parsed = new URL(value);
    pathWithQuery = `${parsed.pathname}${parsed.search}`;
  } catch {
    pathWithQuery = value;
  }

  const [pathPart, queryPart] = pathWithQuery.split('?');
  const query = new URLSearchParams(queryPart ?? '');
  return {
    path: pathPart.startsWith('/') ? pathPart : `/${pathPart}`,
    query: Object.fromEntries([...query.entries()].map(([key, valuePart]) => [key, valuePart])),
  };
}

export function cleanRecord(record: unknown): Record<string, string> {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key, value]) => key.trim() && value !== undefined && value !== null)
      .map(([key, value]) => [key.trim(), String(value)]),
  );
}

export function expectedStatus(responses: ImportedResponse[] | undefined): number {
  const success = (responses ?? []).find((response) => /^2\d\d$/.test(response.status));
  return Number(success?.status ?? responses?.[0]?.status ?? 200);
}
