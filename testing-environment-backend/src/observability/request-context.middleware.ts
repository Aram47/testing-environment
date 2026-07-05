import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { ExecutionContextService } from './execution-context.service';

type RequestWithUser = Request & {
  user?: {
    companyId?: string;
    projectId?: string | null;
  };
};

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly executionContext: ExecutionContextService) {}

  use(request: RequestWithUser, response: Response, next: NextFunction): void {
    const requestId = this.requestId(request);
    response.setHeader('x-request-id', requestId);
    this.executionContext.run(
      {
        requestId,
        companyId: request.user?.companyId,
        projectId: request.params?.projectId ?? request.user?.projectId ?? undefined,
        runId: request.params?.runId,
      },
      next,
    );
  }

  private requestId(request: Request): string {
    const raw = request.headers['x-request-id'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && value.trim() ? value.trim() : randomUUID();
  }
}
