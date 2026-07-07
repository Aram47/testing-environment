import { TestResult, TestResultStatus } from '@prisma/client';
import {
  DiagnosisRun,
  FailureDiagnosisContext,
  LogChunkPreview,
  readExecutionMetadata,
  readPhaseTimestamps,
} from './failure-diagnosis.types';

const SECRET_KEY_PATTERN = /password|secret|token|api[_-]?key|authorization/i;
const MAX_DETAIL_LENGTH = 240;

export function buildFailureDiagnosisContext(
  run: DiagnosisRun,
  results: TestResult[],
  logPreviews: LogChunkPreview[] = [],
): FailureDiagnosisContext {
  const metadata = readExecutionMetadata(run.executionMetadata);
  const phaseTimestamps = readPhaseTimestamps(run.phaseTimestamps);
  const failedResult = results.find((result) => result.status === TestResultStatus.FAILED);
  const message = sanitizeDetail(
    run.errorMessage ?? run.statusReason ?? failedResult?.errorMessage ?? '',
  );

  return {
    run,
    results,
    metadata,
    phaseTimestamps,
    logPreviews: logPreviews.map((chunk) => ({
      ...chunk,
      preview: sanitizeDetail(chunk.preview),
    })),
    failedResult,
    message,
  };
}

export function sanitizeDetail(value: string): string {
  if (!value) {
    return '';
  }
  let sanitized = value;
  sanitized = sanitized.replace(
    /("?(?:password|secret|token|api[_-]?key|authorization)"?\s*[:=]\s*)"[^"]*"/gi,
    '$1"***"',
  );
  sanitized = sanitized.replace(
    /((?:password|secret|token|api[_-]?key|authorization)=)[^\s&]+/gi,
    '$1***',
  );
  if (sanitized.length > MAX_DETAIL_LENGTH) {
    return `${sanitized.slice(0, MAX_DETAIL_LENGTH)}…`;
  }
  return sanitized;
}

export function sanitizeJsonPreview(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  try {
    const json = JSON.stringify(value);
    if (SECRET_KEY_PATTERN.test(json)) {
      return '[redacted: may contain secrets — see test result ref]';
    }
    return sanitizeDetail(json);
  } catch {
    return sanitizeDetail(String(value));
  }
}
