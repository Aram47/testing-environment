import { BadRequestException, Injectable } from '@nestjs/common';
import * as yaml from 'js-yaml';
import {
  DetectedAuthScheme,
  ImportedApiOperation,
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

const BRUNO_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

interface BruBlock {
  name: string;
  content: string;
}

@Injectable()
export class BrunoImportParser implements ApiImportParser {
  constructor(private readonly warnings: ImportWarningService) {}

  parse(input: ImportParseInput): ImportParseResult {
    const contents = this.contents(input);
    const warnings: ImportWarning[] = [];
    const operations = contents.flatMap(({ name, content }) =>
      this.looksLikeYaml(content)
        ? this.parseOpenCollection(content, name, warnings)
        : this.parseBru(content, name, warnings),
    );
    if (operations.length === 0) {
      throw new BadRequestException('Bruno import did not include supported HTTP requests');
    }

    const authSchemes: DetectedAuthScheme[] = [];
    const sanitizedOperations: ImportedApiOperation[] = [];
    for (const operation of operations) {
      const sanitized = this.warnings.sanitizeOperation(operation);
      sanitizedOperations.push(sanitized.operation);
      authSchemes.push(...sanitized.authSchemes);
      warnings.push(...sanitized.warnings);
    }

    return {
      operations: sanitizedOperations,
      authSchemes: this.warnings.mergeAuthSchemes(authSchemes),
      warnings: [...warnings, ...this.warnings.destructiveWarnings(sanitizedOperations)],
    };
  }

  private contents(input: ImportParseInput): Array<{ name: string; content: string }> {
    const entries = Object.entries(input.files ?? {});
    if (entries.length > 0) {
      return entries
        .filter(
          ([name]) => name.endsWith('.bru') || name.endsWith('.yaml') || name.endsWith('.yml'),
        )
        .map(([name, content]) => ({ name, content }));
    }
    return [{ name: 'pasted.bru', content: ensureContent(input.content, 'Bruno') }];
  }

  private parseBru(
    content: string,
    fileName: string,
    warnings: ImportWarning[],
  ): ImportedApiOperation[] {
    const blocks = this.blocks(content);
    if (
      blocks.some(
        (block) =>
          block.name.startsWith('script') || block.name === 'tests' || block.name === 'test',
      )
    ) {
      warnings.push(this.warnings.ignoredExecutableWarning(`Bruno ${fileName}`));
    }

    const meta = this.dictionary(blocks.find((block) => block.name === 'meta')?.content);
    const methodBlock = blocks.find((block) => BRUNO_METHODS.includes(block.name));
    if (!methodBlock) {
      return [];
    }
    const methodData = this.dictionary(methodBlock.content);
    const parsedUrl = splitUrlPathAndQuery(String(methodData.url ?? '/'));
    const operation: ImportedApiOperation = {
      id: stableOperationId(['bruno', fileName, methodBlock.name, parsedUrl.path]),
      name: String(
        meta.name ??
          fileName.replace(/\.bru$/, '') ??
          `${methodBlock.name.toUpperCase()} ${parsedUrl.path}`,
      ),
      method: normalizeMethod(methodBlock.name),
      path: parsedUrl.path,
      headers: this.dictionary(blocks.find((block) => block.name === 'headers')?.content),
      query: {
        ...parsedUrl.query,
        ...this.dictionary(blocks.find((block) => block.name === 'params:query')?.content),
      },
      body: this.body(
        blocks.find((block) => block.name === 'body' || block.name.startsWith('body:')),
      ),
      expectedResponses: [{ status: '200', description: 'Default Bruno expectation' }],
      sourceMetadata: { sourceType: 'BRUNO', fileName, meta },
    };
    return [operation];
  }

  private parseOpenCollection(
    content: string,
    fileName: string,
    warnings: ImportWarning[],
  ): ImportedApiOperation[] {
    let parsed: unknown;
    try {
      parsed = yaml.load(content);
    } catch {
      return this.parseBru(content, fileName, warnings);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [];
    }

    const items = this.collectOpenCollectionItems(parsed as Record<string, unknown>);
    return items.flatMap((item, index) => {
      const method = item.method ? normalizeMethod(String(item.method)) : undefined;
      const url = String(item.url ?? item.path ?? '');
      if (!method || !url) {
        return [];
      }
      const parsedUrl = splitUrlPathAndQuery(url);
      return [
        {
          id: stableOperationId(['bruno-yaml', fileName, String(index), method, parsedUrl.path]),
          name: String(item.name ?? `${method} ${parsedUrl.path}`),
          method,
          path: parsedUrl.path,
          headers: cleanRecord(item.headers),
          query: { ...parsedUrl.query, ...cleanRecord(item.query ?? item.params) },
          body: item.body,
          expectedResponses: [
            {
              status: String(item.expectedStatus ?? 200),
              description: 'Default Bruno expectation',
            },
          ],
          sourceMetadata: { sourceType: 'BRUNO', fileName, format: 'OpenCollection YAML' },
        },
      ];
    });
  }

  private collectOpenCollectionItems(document: Record<string, unknown>): Record<string, unknown>[] {
    const candidates = [document.requests, document.items, document.item, document.collection];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return this.flattenItems(candidate);
      }
    }
    if (document.method || document.url || document.path) {
      return [document];
    }
    return [];
  }

  private flattenItems(items: unknown[]): Record<string, unknown>[] {
    return items.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return [];
      }
      const record = item as Record<string, unknown>;
      const children = record.items ?? record.item ?? record.requests;
      return [record, ...(Array.isArray(children) ? this.flattenItems(children) : [])];
    });
  }

  private blocks(content: string): BruBlock[] {
    const blocks: BruBlock[] = [];
    const pattern = /([A-Za-z][A-Za-z0-9:-]*)\s*\{/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content))) {
      const name = match[1];
      const start = pattern.lastIndex;
      let depth = 1;
      let index = start;
      while (index < content.length && depth > 0) {
        if (content[index] === '{') {
          depth += 1;
        } else if (content[index] === '}') {
          depth -= 1;
        }
        index += 1;
      }
      if (depth === 0) {
        blocks.push({ name, content: content.slice(start, index - 1).trim() });
        pattern.lastIndex = index;
      }
    }
    return blocks;
  }

  private dictionary(content: string | undefined): Record<string, string> {
    if (!content) {
      return {};
    }
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('~') && line.includes(':'))
        .map((line) => {
          const separator = line.indexOf(':');
          return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()] as const;
        })
        .filter(([key]) => key),
    );
  }

  private body(block: BruBlock | undefined): unknown {
    if (!block) {
      return undefined;
    }
    const content = block.content.trim();
    try {
      return JSON.parse(content);
    } catch {
      try {
        return yaml.load(content);
      } catch {
        return content;
      }
    }
  }

  private looksLikeYaml(content: string): boolean {
    const trimmed = content.trimStart();
    return /^requests:|^items:|^item:|^collection:|^method:/m.test(trimmed);
  }
}
