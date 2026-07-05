import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ExecutionContextService } from './execution-context.service';

@Injectable()
export class TracingService implements OnModuleInit, OnModuleDestroy {
  private sdk?: NodeSDK;

  constructor(private readonly executionContext: ExecutionContextService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.OTEL_ENABLED !== 'true') {
      return;
    }
    this.sdk = new NodeSDK({
      traceExporter: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
        ? new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT })
        : undefined,
      instrumentations: [getNodeAutoInstrumentations()],
    });
    await this.sdk.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.sdk?.shutdown();
  }

  async span<T>(
    name: string,
    attributes: Record<string, unknown>,
    callback: () => Promise<T>,
  ): Promise<T> {
    const tracer = trace.getTracer('testing-environment');
    const mergedAttributes = { ...this.executionContext.snapshot(), ...attributes };
    return tracer.startActiveSpan(
      name,
      { attributes: this.attributes(mergedAttributes) },
      async (span) => {
        try {
          const result = await context.with(trace.setSpan(context.active(), span), callback);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'span failed',
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  private attributes(input: Record<string, unknown>): Record<string, string | number | boolean> {
    return Object.fromEntries(
      Object.entries(input).filter((entry): entry is [string, string | number | boolean] =>
        ['string', 'number', 'boolean'].includes(typeof entry[1]),
      ),
    );
  }
}
