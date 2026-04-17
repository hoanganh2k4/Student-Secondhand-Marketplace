/**
 * Gateway — authentication tests.
 * Verifies that handleConnection accepts / rejects clients based on the JWT.
 */

import {
  createGatewayApp, teardown,
  makeToken, openSocket, waitForStableConnect,
  type GatewayCtx,
} from './test/gateway-setup'

describe('ConversationsGateway – authentication', () => {
  let ctx: GatewayCtx

  beforeAll(async () => { ctx = await createGatewayApp() })
  afterAll(async ()  => { await teardown(ctx) })
  afterEach(()       => { jest.clearAllMocks() })

  it('disconnects a client that sends no token', async () => {
    const s = openSocket(ctx.port)
    ctx.sockets.push(s)
    expect(await waitForStableConnect(s)).toBe(false)
  })

  it('disconnects a client with a malformed / invalid token', async () => {
    const s = openSocket(ctx.port, 'not-a-jwt')
    ctx.sockets.push(s)
    expect(await waitForStableConnect(s)).toBe(false)
  })

  it('disconnects a client whose token type is not "ws" or "access"', async () => {
    const token = makeToken(ctx.jwtService, 'user-1', 'refresh')
    const s     = openSocket(ctx.port, token)
    ctx.sockets.push(s)
    expect(await waitForStableConnect(s)).toBe(false)
  })

  it('keeps a client connected when token type is "ws"', async () => {
    const s = openSocket(ctx.port, makeToken(ctx.jwtService, 'user-ws'))
    ctx.sockets.push(s)
    expect(await waitForStableConnect(s)).toBe(true)
    s.disconnect()
  })

  it('keeps a client connected when token type is "access"', async () => {
    const s = openSocket(ctx.port, makeToken(ctx.jwtService, 'user-access', 'access'))
    ctx.sockets.push(s)
    expect(await waitForStableConnect(s)).toBe(true)
    s.disconnect()
  })
})
