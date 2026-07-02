import { apiClient } from './client';
import { PaginatedResultAdapter, type PaginatedResult } from './paginated-result';
import type { CreateProjectInput, DashboardSummary, Project } from '../types';

class ProjectsApi {
  async dashboard(): Promise<DashboardSummary> {
    const { data } = await apiClient.get<DashboardSummary>('/dashboard');
    return data;
  }

  async list(): Promise<Project[]> {
    const { data } = await apiClient.get<Project[] | PaginatedResult<Project>>('/projects');
    return PaginatedResultAdapter.toItems(data);
  }

  async get(id: string): Promise<Project> {
    const { data } = await apiClient.get<Project>(`/projects/${id}`);
    return data;
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const { data } = await apiClient.post<Project>('/projects', input);
    return data;
  }

  async update(id: string, input: Partial<CreateProjectInput>): Promise<Project> {
    const { data } = await apiClient.patch<Project>(`/projects/${id}`, input);
    return data;
  }

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/projects/${id}`);
  }
}

export const projectsApi = new ProjectsApi();
