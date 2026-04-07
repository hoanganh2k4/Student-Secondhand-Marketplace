import { Module }              from '@nestjs/common'
import { PrismaModule }        from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { MatchesService }      from './matches.service'
import { MatchesController }   from './matches.controller'

@Module({
  imports:     [PrismaModule, NotificationsModule],
  controllers: [MatchesController],
  providers:   [MatchesService],
  exports:     [MatchesService],
})
export class MatchesModule {}
