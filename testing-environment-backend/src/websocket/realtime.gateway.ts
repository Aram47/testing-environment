import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ApiTokenAuthService } from '../authorization/api-token-auth.service';
import { PermissionService } from '../authorization/permission.service';
import { AuthenticatedPrincipal } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({ cors: true, namespace: 'runs' })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly apiTokens: ApiTokenAuthService,
    private readonly permissions: PermissionService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.bind(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const principal = await this.authenticate(token);
      client.data.user = principal;
      if (principal.userId) {
        await client.join(this.realtime.userRoom(principal.userId));
      }
      if (principal.apiTokenId) {
        await client.join(this.realtime.apiTokenRoom(principal.apiTokenId));
      }
      await client.join(this.realtime.companyRoom(principal.companyId));
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('subscribe')
  async subscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { testRunId: string }) {
    const user = client.data.user as AuthenticatedPrincipal | undefined;
    if (!user?.companyId || !body?.testRunId) {
      throw new UnauthorizedException();
    }
    const run = await this.prisma.testRun.findFirst({
      where: { id: body.testRunId },
      select: { id: true, projectId: true, project: { select: { companyId: true } } },
    });
    if (!run) {
      throw new UnauthorizedException();
    }
    await this.permissions.assertCan(user, 'run:read', {
      type: 'run',
      id: run.id,
      projectId: run.projectId,
      companyId: run.project.companyId,
    });
    await client.join(body.testRunId);
    return { subscribed: true, testRunId: body.testRunId };
  }

  private async authenticate(token: string): Promise<AuthenticatedPrincipal> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException();
      }
      const member = await this.prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId: user.companyId, userId: user.id } },
      });
      if (!member || member.status !== 'ACTIVE') {
        throw new UnauthorizedException();
      }
      return {
        type: 'USER',
        id: user.id,
        userId: user.id,
        memberId: member.id,
        email: user.email,
        companyId: user.companyId,
        role: member.role,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      return this.apiTokens.validate(token);
    }
  }

  private extractToken(client: Socket): string {
    const authToken = client.handshake.auth?.token;
    const header = client.handshake.headers.authorization;
    if (typeof authToken === 'string') {
      return authToken.replace(/^Bearer\s+/i, '');
    }
    if (typeof header === 'string') {
      return header.replace(/^Bearer\s+/i, '');
    }
    throw new UnauthorizedException();
  }
}
