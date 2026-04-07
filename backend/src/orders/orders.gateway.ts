import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Server, Socket } from 'socket.io'
import { PrismaService } from '../prisma/prisma.service'

@WebSocketGateway({
  namespace: '/orders',
  cors: {
    origin: (origin: string, cb: (err: Error | null, allow?: boolean) => void) => cb(null, true),
    credentials: true,
  },
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server
  private readonly logger = new Logger(OrdersGateway.name)

  constructor(
    private readonly prisma:  PrismaService,
    private readonly jwt:     JwtService,
    private readonly config:  ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined
    if (!token) { client.disconnect(); return }
    try {
      const payload = this.jwt.verify<{ sub: string; type: string }>(token, {
        secret: this.config.get('JWT_SECRET', 'dev-secret'),
      })
      if (payload.type !== 'access') { client.disconnect(); return }
      client.data.userId = payload.sub
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Orders WS disconnect: ${client.id}`)
  }

  @SubscribeMessage('join_order')
  async joinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() orderId: string,
  ) {
    const userId = client.data.userId as string
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order || (order.buyerUserId !== userId && order.sellerUserId !== userId)) {
      return { error: 'Access denied' }
    }
    await client.join(`order:${orderId}`)
    return { ok: true }
  }

  emit(orderId: string, event: string, data: unknown) {
    this.server.to(`order:${orderId}`).emit(event, data)
  }
}
