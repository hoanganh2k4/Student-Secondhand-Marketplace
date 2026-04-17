/**
 * Shared test helpers for ConversationsGateway integration tests.
 * Each spec file calls `createGatewayApp()` in beforeAll and `teardown()` in afterAll.
 */

import { Test, TestingModule }   from '@nestjs/testing'
import { INestApplication }      from '@nestjs/common'
import { IoAdapter }             from '@nestjs/platform-socket.io'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { ConfigService }         from '@nestjs/config'
import { io as ioClient, Socket } from 'socket.io-client'

import { ConversationsGateway }  from '../conversations.gateway'
import { PrismaService }         from '../../prisma/prisma.service'

// Fixed secret — avoids dependency on process.env / .env files
export const JWT_SECRET = 'test-ws-secret'

export interface GatewayCtx {
  app:        INestApplication
  jwtService: JwtService
  gateway:    ConversationsGateway
  port:       number
  mockPrisma: { conversation: { findUnique: jest.Mock } }
  sockets:    Socket[]
}

/** Spin up a real NestJS app on a random port with mocked Prisma and ConfigService. */
export async function createGatewayApp(): Promise<GatewayCtx> {
  const mockPrisma: GatewayCtx['mockPrisma'] = {
    conversation: { findUnique: jest.fn() },
  }

  const mockConfig: Partial<ConfigService> = {
    get: (key: string, defaultValue?: unknown) =>
      key === 'JWT_SECRET' ? JWT_SECRET : defaultValue,
  }

  const module: TestingModule = await Test.createTestingModule({
    imports: [
      JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
    ],
    providers: [
      ConversationsGateway,
      { provide: PrismaService, useValue: mockPrisma  },
      { provide: ConfigService, useValue: mockConfig  },
    ],
  }).compile()

  const app = module.createNestApplication()
  app.useWebSocketAdapter(new IoAdapter(app))
  await app.listen(0) // OS picks a free port

  const addr      = (app.getHttpServer() as any).address()
  const port      = typeof addr === 'object' && addr ? addr.port : 0
  const jwtService = module.get(JwtService)
  const gateway   = module.get(ConversationsGateway)

  return { app, jwtService, gateway, port, mockPrisma, sockets: [] }
}

/** Close app and all tracked sockets. */
export async function teardown(ctx: GatewayCtx) {
  ctx.sockets.forEach(s => s.close())
  await ctx.app.close()
}

// ── Socket helpers ────────────────────────────────────────────────────────────

export function makeToken(
  jwtService: JwtService,
  userId: string,
  type: 'ws' | 'access' | 'refresh' = 'ws',
) {
  return jwtService.sign({ sub: userId, type })
}

/** Create a socket but do NOT wait for connection. */
export function openSocket(port: number, token?: string): Socket {
  return ioClient(`http://localhost:${port}/chat`, {
    auth:         token ? { token } : {},
    transports:   ['websocket'],
    reconnection: false,
  })
}

/**
 * Resolves true  → socket connected and stayed connected for `stableMs`
 * Resolves false → no token / bad token (kicked immediately) or hard timeout
 */
export function waitForStableConnect(
  socket: Socket,
  stableMs  = 400,
  timeoutMs = 3_000,
): Promise<boolean> {
  return new Promise(resolve => {
    let connected   = false
    let stableTimer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (stableTimer) clearTimeout(stableTimer)
      socket.off('connect',    onConnect)
      socket.off('disconnect', onDisconnect)
    }

    const onConnect = () => {
      connected    = true
      stableTimer  = setTimeout(() => { cleanup(); resolve(true) }, stableMs)
    }
    const onDisconnect = () => {
      if (connected) { cleanup(); resolve(false) }
    }

    socket.on('connect',    onConnect)
    socket.on('disconnect', onDisconnect)
    setTimeout(() => { cleanup(); resolve(false) }, timeoutMs)
  })
}

/** Wait until a socket connects (assumes valid auth). */
export function waitForConnect(socket: Socket, timeoutMs = 3_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect timeout')), timeoutMs)
    socket.once('connect',       () => { clearTimeout(timer); resolve() })
    socket.once('connect_error', (e) => { clearTimeout(timer); reject(e) })
  })
}

/** Emit an event and wait for the server ACK callback. */
export function emitWithAck<T = unknown>(
  socket:    Socket,
  event:     string,
  data?:     unknown,
  timeoutMs = 3_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`ACK timeout on '${event}'`)),
      timeoutMs,
    )
    socket.emit(event, data, (res: T) => { clearTimeout(timer); resolve(res) })
  })
}

/** Wait for the next occurrence of a named event on a socket. */
export function waitForEvent<T = unknown>(
  socket:    Socket,
  event:     string,
  timeoutMs = 3_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Event timeout: '${event}'`)),
      timeoutMs,
    )
    socket.once(event, (data: T) => { clearTimeout(timer); resolve(data) })
  })
}

/** Connect, wait for stable connection, join a room, return the socket. */
export async function joinRoom(
  ctx:    GatewayCtx,
  userId: string,
  convId: string,
  conv:   object,
): Promise<Socket> {
  ctx.mockPrisma.conversation.findUnique.mockResolvedValue(conv)
  const s = openSocket(ctx.port, makeToken(ctx.jwtService, userId))
  ctx.sockets.push(s)
  await waitForConnect(s)
  await emitWithAck(s, 'join_conversation', convId)
  return s
}
