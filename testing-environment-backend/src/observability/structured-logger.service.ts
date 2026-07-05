import { Injectable, LoggerService } from '@nestjs/common';
import { ExecutionContextService } from './execution-context.service';
import { RedactionService } from './redaction.service';

type LogLevel = 'debug' | 'error' | 'log' | 'verbose' | 'warn';

interface LogRecord {
  level: LogLevel;
  message: string;
  context?: string;
  event?: string;
  error?: unknown;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  constructor(
    private readonly executionContext: ExecutionContextService,
    private readonly redaction: RedactionService,
  ) {}

  log(message: unknown, context?: string): void {
    this.write({ level: 'log', message: String(message), context });
  }

  error(message: unknown, traceOrContext?: string, context?: string): void {
    this.write({
      level: 'error',
      message: String(message),
      context: context ?? traceOrContext,
      error: context && traceOrContext ? { stack: traceOrContext } : undefined,
    });
  }

  warn(message: unknown, context?: string): void {
    this.write({ level: 'warn', message: String(message), context });
  }

  debug(message: unknown, context?: string): void {
    this.write({ level: 'debug', message: String(message), context });
  }

  verbose(message: unknown, context?: string): void {
    this.write({ level: 'verbose', message: String(message), context });
  }

  event(event: string, metadata: Record<string, unknown> = {}): void {
    this.write({ level: 'log', message: event, event, metadata });
  }

  eventError(event: string, error: unknown, metadata: Record<string, unknown> = {}): void {
    this.write({ level: 'error', message: event, event, error, metadata });
  }

  private write(record: LogRecord): void {
    const payload = {
      timestamp: new Date().toISOString(),
      level: record.level === 'log' ? 'info' : record.level,
      message: this.redaction.redactString(record.message),
      context: record.context,
      event: record.event,
      ...this.executionContext.snapshot(),
      ...(record.metadata ? { metadata: this.redaction.redact(record.metadata) } : {}),
      ...(record.error ? { error: this.redaction.redact(record.error) } : {}),
    };
    const line = JSON.stringify(payload);
    if (record.level === 'error') {
      process.stderr.write(`${line}\n`);
      return;
    }
    process.stdout.write(`${line}\n`);
  }
}
