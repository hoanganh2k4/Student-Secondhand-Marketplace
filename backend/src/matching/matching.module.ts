import { Module }               from '@nestjs/common'
import { PrismaModule }         from '../prisma/prisma.module'
import { NotificationsModule }  from '../notifications/notifications.module'
import { AiModule }             from '../ai/ai.module'
import { MatchingService }      from './matching.service'

@Module({
  imports:  [PrismaModule, NotificationsModule, AiModule],
  providers: [MatchingService],
  exports:   [MatchingService],
})
export class MatchingModule {}
