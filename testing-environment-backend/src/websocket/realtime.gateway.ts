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
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({ cors: true, namespace: 'runs' })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.bind(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwt.verifyAsync(token);
      client.data.user = payload;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('subscribe')
  async subscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { testRunId: string }) {
    const user = client.data.user;
    if (!user?.companyId) {
      throw new UnauthorizedException();
    }
    const run = await this.prisma.testRun.findFirst({
      where: { id: body.testRunId, project: { companyId: user.companyId } },
    });
    if (!run) {
      throw new UnauthorizedException();
    }
    await client.join(body.testRunId);
    return { subscribed: true, testRunId: body.testRunId };
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
