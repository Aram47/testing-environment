import { PrincipalType, UserRole } from '@prisma/client';

export interface AuthenticatedPrincipal {
  type: PrincipalType;
  id: string;
  email: string;
  companyId: string;
  role: UserRole;
  memberId?: string;
  userId?: string;
  apiTokenId?: string;
  serviceAccountId?: string | null;
  scopes?: string[];
  projectId?: string | null;
}

export type AuthenticatedUser = AuthenticatedPrincipal;
