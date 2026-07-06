import { DEFAULT_LIST_LIMIT, PaginatedResultAdapter } from './paginated-result';
import { generatedApi } from './generated-client';
import type { AuditEventResponseDto } from '../generated/api';

export type AuditEvent = AuditEventResponseDto;

export interface AuditEventsQuery {
  page?: number;
  limit?: number;
  action?: string;
  projectId?: string;
}

class AuditApi {
  async list(query: AuditEventsQuery = {}): Promise<AuditEvent[]> {
    const data = await generatedApi.AuditController_list({
      path: {},
      query: {
        page: query.page ?? 1,
        limit: query.limit ?? DEFAULT_LIST_LIMIT,
        action: query.action,
        projectId: query.projectId,
      },
    });
    return PaginatedResultAdapter.toItems(data);
  }
}

export const auditApi = new AuditApi();
