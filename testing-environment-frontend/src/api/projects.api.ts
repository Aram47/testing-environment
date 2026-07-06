import { PaginatedResultAdapter, type PaginatedResult } from './paginated-result';
import type { CreateProjectInput, DashboardSummary, Project } from '../types';
import { generatedApi } from './generated-client';
import type { CreateProjectDto, UpdateProjectDto } from '../generated/api';

class ProjectsApi {
  async dashboard(): Promise<DashboardSummary> {
    return generatedApi.DashboardController_getSummary({ path: {} }) as Promise<DashboardSummary>;
  }

  async list(): Promise<Project[]> {
    const data = await generatedApi.ProjectsController_findAll({ path: {} }) as Project[] | PaginatedResult<Project>;
    return PaginatedResultAdapter.toItems(data);
  }

  async get(id: string): Promise<Project> {
    return generatedApi.ProjectsController_findOne({ path: { projectId: id } }) as Promise<Project>;
  }

  async create(input: CreateProjectInput): Promise<Project> {
    return generatedApi.ProjectsController_create({ path: {} }, input as CreateProjectDto) as Promise<Project>;
  }

  async update(id: string, input: Partial<CreateProjectInput>): Promise<Project> {
    return generatedApi.ProjectsController_update({ path: { projectId: id } }, input as UpdateProjectDto) as Promise<Project>;
  }

  async remove(id: string): Promise<void> {
    await generatedApi.ProjectsController_remove({ path: { projectId: id } });
  }
}

export const projectsApi = new ProjectsApi();
