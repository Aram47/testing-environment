import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AuthenticatedPrincipal } from '../common/types/authenticated-user.type';
import { AuditService } from './audit.service';

type AuditRequest = Request & {
  user?: AuthenticatedPrincipal;
  params: Record<string, string | undefined>;
  body?: unknown;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    return next.handle().pipe(
      tap(() => {
        if (!request.user || request.method === 'GET') {
          return;
        }
        void this.audit.record({
          action: this.actionName(request),
          principal: request.user,
          projectId: request.params.projectId,
          resourceType: this.resourceType(request),
          resourceId: this.resourceId(request),
          requestId: this.requestId(request),
          metadata: {
            method: request.method,
            path: request.route?.path,
            params: request.params,
            body: request.body,
          },
        });
      }),
    );
  }

  private actionName(request: AuditRequest): string {
    return `${request.method.toLowerCase()}:${request.route?.path ?? request.path}`;
  }

  private resourceType(request: AuditRequest): string | undefined {
    if (request.params.runId) {
      return 'run';
    }
    if (request.params.secretId) {
      return 'secret';
    }
    if (request.params.suiteId) {
      return 'suite';
    }
    if (request.params.revisionId) {
      return 'revision';
    }
    if (request.params.projectId || request.params.id) {
      return 'project';
    }
    return undefined;
  }

  private resourceId(request: AuditRequest): string | undefined {
    return (
      request.params.runId ??
      request.params.secretId ??
      request.params.suiteId ??
      request.params.revisionId ??
      request.params.projectId ??
      request.params.id
    );
  }

  private requestId(request: Request): string | undefined {
    const value = request.headers['x-request-id'];
    return Array.isArray(value) ? value[0] : value;
  }
}
