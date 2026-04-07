import { Module }              from '@nestjs/common'
import { PrismaModule }        from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { OffersService }       from './offers.service'
import { OffersController }    from './offers.controller'

@Module({
  imports:     [PrismaModule, NotificationsModule],
  controllers: [OffersController],
  providers:   [OffersService],
  exports:     [OffersService],
})
export class OffersModule {}
