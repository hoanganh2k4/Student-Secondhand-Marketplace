import { Module }              from '@nestjs/common'
import { PrismaModule }        from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { AuthModule }          from '../auth/auth.module'
import { OrdersService }       from './orders.service'
import { OrdersController }    from './orders.controller'
import { OrdersGateway }       from './orders.gateway'

@Module({
  imports:     [PrismaModule, NotificationsModule, AuthModule],
  controllers: [OrdersController],
  providers:   [OrdersService, OrdersGateway],
  exports:     [OrdersGateway],
})
export class OrdersModule {}
