import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { teamApi, type TeamMember, type TeamMemberRole } from '../api/team.api';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/toastContext';
import { ErrorPresenter } from '../lib/errors';

const ROLES: TeamMemberRole[] = ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'];

export function TeamPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const query = useQuery({ queryKey: ['team', 'members'], queryFn: teamApi.list });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: TeamMemberRole }) =>
      teamApi.updateRole(memberId, role),
    onSuccess: async () => {
      showToast('Member role updated', 'success');
      await queryClient.invalidateQueries({ queryKey: ['team', 'members'] });
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => teamApi.remove(memberId),
    onSuccess: async () => {
      showToast('Member removed', 'success');
      setRemoveTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['team', 'members'] });
    },
    onError: (error) => showToast(ErrorPresenter.message(error), 'error'),
  });

  if (query.isLoading) {
    return <LoadingState label="Loading team" />;
  }

  if (query.isError) {
    return <ErrorState error={query.error} />;
  }

  const members = query.data ?? [];

  return (
    <>
      <PageHeader title="Team" description="Manage workspace members and roles." />
      <section className="rounded-lg border border-border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-ink">
                  {member.user.firstName} {member.user.lastName}
                </td>
                <td className="px-4 py-3 text-muted">{member.user.email}</td>
                <td className="px-4 py-3">
                  <select
                    className="input"
                    value={member.role}
                    disabled={updateRoleMutation.isPending}
                    onChange={(event) =>
                      updateRoleMutation.mutate({
                        memberId: member.id,
                        role: event.target.value as TeamMemberRole,
                      })
                    }
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <Button type="button" variant="danger" onClick={() => setRemoveTarget(member)}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove team member?"
        description={`Remove ${removeTarget?.user.email} from the workspace.`}
        confirmLabel="Remove member"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) {
            removeMutation.mutate(removeTarget.id);
          }
        }}
      />
    </>
  );
}
