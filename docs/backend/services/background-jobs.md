# Background Jobs (NestJS Scheduled Tasks)

> Runtime: NestJS (`@nestjs/schedule` — node-cron under the hood)
> Location: `backend/src/scheduler/scheduler.service.ts`
> No separate process needed — runs inside the NestJS app

---

## Overview

Four jobs handle all time-based state transitions. They are the only processes that mutate objects based on time rather than user action.

| Job method | Cron | What it does |
|-----------|------|-------------|
| `expireDemands()` | `0 * * * *` (every hour) | Sets expired DemandRequests to `expired` |
| `expireListings()` | `0 * * * *` (every hour) | Sets expired ProductListings to `expired` |
| `expireOffers()` | `*/15 * * * *` (every 15 min) | Sets expired pending Offers to `expired` |
| `closeInactiveConversations()` | `0 */6 * * *` (every 6 hours) | Closes conversations past `auto_close_at`; sends warning at -2 days |

---

## Module Setup

```typescript
// backend/src/scheduler/scheduler.module.ts
import { Module }          from '@nestjs/common'
import { ScheduleModule }  from '@nestjs/schedule'
import { SchedulerService } from './scheduler.service'
import { PrismaModule }    from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    NotificationsModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
```

Register in `AppModule`:

```typescript
// backend/src/app.module.ts
imports: [
  // ...
  SchedulerModule,
]
```

---

## expireDemands

```typescript
// backend/src/scheduler/scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { Cron }               from '@nestjs/schedule'
import { PrismaService }      from '../prisma/prisma.service'

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name)

  constructor(
    private prisma:         PrismaService,
    private notifications:  NotificationsService,
  ) {}

  @Cron('0 * * * *')
  async expireDemands() {
    const result = await this.prisma.demandRequest.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        status:    { notIn: ['expired', 'cancelled', 'fulfilled'] },
      },
      data: { status: 'expired' },
    })
    this.logger.log(`expireDemands: ${result.count} updated`)
  }
```

---

## expireListings

```typescript
  @Cron('0 * * * *')
  async expireListings() {
    const result = await this.prisma.productListing.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        status:    { notIn: ['expired', 'sold', 'removed'] },
      },
      data: { status: 'expired' },
    })
    this.logger.log(`expireListings: ${result.count} updated`)
  }
```

---

## expireOffers

```typescript
  @Cron('*/15 * * * *')
  async expireOffers() {
    const result = await this.prisma.offer.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        status:    'pending',
      },
      data: { status: 'expired' },
    })
    this.logger.log(`expireOffers: ${result.count} updated`)
  }
```

---

## closeInactiveConversations

This job does two things:
1. Warns conversations that will auto-close in 2 days (in-app notification).
2. Closes conversations that have passed `auto_close_at`.

```typescript
  @Cron('0 */6 * * *')
  async closeInactiveConversations() {
    const now          = new Date()
    const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)

    // 1. Close conversations past auto_close_at
    const closed = await this.prisma.conversation.updateMany({
      where: {
        autoCloseAt: { lt: now },
        status:      'active',
      },
      data: { status: 'closed', closeReason: 'expired' },
    })

    // 2. Warn conversations closing within 2 days
    const soonClosing = await this.prisma.conversation.findMany({
      where: {
        autoCloseAt: { lt: twoDaysLater, gt: now },
        status:      'active',
      },
      select: { id: true, buyerUserId: true, sellerUserId: true },
    })

    for (const conv of soonClosing) {
      for (const userId of [conv.buyerUserId, conv.sellerUserId]) {
        await this.notifications.notify({
          userId,
          type:          'conversation_closing_soon',
          referenceType: 'conversation',
          referenceId:   conv.id,
          body:          'Your conversation will auto-close in 2 days due to inactivity.',
        })
      }
    }

    this.logger.log(
      `closeInactiveConversations: closed ${closed.count}, warned ${soonClosing.length}`
    )
  }
}
```

---

## Cron Expression Reference

| Expression | Human description |
|-----------|-------------------|
| `0 * * * *` | Every hour at minute 0 |
| `*/15 * * * *` | Every 15 minutes |
| `0 */6 * * *` | Every 6 hours (00:00, 06:00, 12:00, 18:00) |

---

## Running in Development

The scheduler starts automatically with the NestJS app:

```bash
cd backend
npm run dev
# Logs will show: [SchedulerService] expireDemands: 0 updated
```

To trigger a job manually during development, call the service method directly from a controller or use a temporary test endpoint.

---

## Testing Jobs

Since these methods use `prisma.updateMany`, they can be unit-tested by mocking `PrismaService`:

```typescript
it('expireDemands should update expired demands', async () => {
  prisma.demandRequest.updateMany.mockResolvedValue({ count: 3 })
  await service.expireDemands()
  expect(prisma.demandRequest.updateMany).toHaveBeenCalledWith({
    where: expect.objectContaining({ status: { notIn: ['expired', 'cancelled', 'fulfilled'] } }),
    data:  { status: 'expired' },
  })
})
```
