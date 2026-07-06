export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const DEFAULT_LIST_LIMIT = 100;

export class PaginatedResultAdapter {
  static toItems<T>(response: T[] | PaginatedResult<T>): T[] {
    return Array.isArray(response) ? response : response.data;
  }
}
