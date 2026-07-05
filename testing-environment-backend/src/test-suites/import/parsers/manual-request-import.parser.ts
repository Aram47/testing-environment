import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ImportedApiOperation,
  ImportParseInput,
  ImportParseResult,
} from '../../types/api-import.types';
import { ImportWarningService } from '../import-warning.service';
import {
  cleanRecord,
  expectedStatus,
  normalizeMethod,
  splitUrlPathAndQuery,
  stableOperationId,
} from './import-parser-utils';
import { ApiImportParser } from './api-import-parser.interface';

@Injectable()
export class ManualRequestImportParser implements ApiImportParser {
  constructor(private readonly warnings: ImportWarningService) {}

  parse(input: ImportParseInput): ImportParseResult {
    const request = input.manualRequest;
    if (!request) {
      throw new BadRequestException('Manual request import needs manualRequest');
    }

    const method = normalizeMethod(request.method);
    const parsedPath = splitUrlPathAndQuery(request.path);
    const responses = [
      { status: String(request.expectedStatus ?? 200), description: 'Expected status' },
    ];
    const operation: ImportedApiOperation = {
      id: stableOperationId(['manual', method, parsedPath.path]),
      name: request.name?.trim() || `${method} ${parsedPath.path}`,
      method,
      path: parsedPath.path,
      headers: cleanRecord(request.headers),
      query: { ...parsedPath.query, ...cleanRecord(request.query) },
      body: request.body,
      expectedResponses: responses,
      sourceMetadata: { sourceType: 'MANUAL', expectedStatus: expectedStatus(responses) },
    };

    const sanitized = this.warnings.sanitizeOperation(operation);
    return {
      operations: [sanitized.operation],
      authSchemes: sanitized.authSchemes,
      warnings: [
        ...sanitized.warnings,
        ...this.warnings.destructiveWarnings([sanitized.operation]),
      ],
    };
  }
}
