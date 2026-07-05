import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { ExecutionContextService } from './execution-context.service';

type ObservableRequest = Request & {
  user?: {
    companyId?: string;
    projectId?: string | null;
  };
  params: Record<string, string | undefined>;
};

@Injectable()
export class ContextEnrichmentInterceptor implements NestInterceptor {
  constructor(private readonly executionContext: ExecutionContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<ObservableRequest>();
    this.executionContext.merge({
      companyId: request.user?.companyId,
      projectId: request.params.projectId ?? request.user?.projectId ?? undefined,
      runId: request.params.runId,
    });
    return next.handle();
  }
}
