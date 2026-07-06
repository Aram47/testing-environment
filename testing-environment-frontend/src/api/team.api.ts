import { generatedApi } from './generated-client';
import type { TeamMemberResponseDto, UpdateMemberRoleDto } from '../generated/api';

export type TeamMember = TeamMemberResponseDto;
export type TeamMemberRole = UpdateMemberRoleDto['role'];

class TeamApi {
  async list(): Promise<TeamMember[]> {
    return generatedApi.TeamController_list({ path: {} });
  }

  async updateRole(memberId: string, role: TeamMemberRole): Promise<TeamMember> {
    return generatedApi.TeamController_updateRole({ path: { memberId } }, { role });
  }

  async remove(memberId: string): Promise<void> {
    await generatedApi.TeamController_remove({ path: { memberId } });
  }
}

export const teamApi = new TeamApi();
