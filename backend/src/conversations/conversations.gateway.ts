import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Server, Socket } from 'socket.io'
import { PrismaService } from '../prisma/prisma.service'

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (origin: string, cb: (err: Error | null, allow?: boolean) => void) => cb(null, true),
    credentials: true,
  },
})
export class ConversationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server
  private readonly logger = new Logger(ConversationsGateway.name)

  constructor(
    private readonly prisma:  PrismaService,
    private readonly jwt:     JwtService,
    private readonly config:  ConfigService,
  ) {}

  // ── Auth on connect ─────────────────────────────────────────────────────
  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined
    if (!token) {
      client.disconnect()
      return
    }
    try {
      const payload = this.jwt.verify<{ sub: string; type: string }>(token, {
        secret: this.config.get('JWT_SECRET', 'dev-secret'),
      })
      if (payload.type !== 'ws' && payload.type !== 'access') {
        client.disconnect()
        return
      }
      client.data.userId = payload.sub
      this.logger.debug(`WS connect: ${client.id} user=${payload.sub}`)
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`WS disconnect: ${client.id}`)
  }

  // ── Join conversation room ──────────────────────────────────────────────
  @SubscribeMessage('join_conversation')
  async joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    const userId = client.data.userId as string
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    })
    if (!conv || (conv.buyerUserId !== userId && conv.sellerUserId !== userId)) {
      return { error: 'Access denied' }
    }
    await client.join(`conv:${conversationId}`)
    this.logger.debug(`User ${userId} joined conv:${conversationId}`)
    return { ok: true }
  }

  // ── Emit helpers (called from service) ─────────────────────────────────
  emit(conversationId: string, event: string, data: unknown) {
    this.server.to(`conv:${conversationId}`).emit(event, data)
  }
}
