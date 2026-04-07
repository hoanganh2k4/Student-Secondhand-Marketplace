import { Module, forwardRef }  from '@nestjs/common'
import { PrismaModule }        from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { UploadModule }        from '../upload/upload.module'
import { AuthModule }          from '../auth/auth.module'
import { ConversationsService }    from './conversations.service'
import { ConversationsController } from './conversations.controller'
import { ConversationsGateway }    from './conversations.gateway'

@Module({
  imports:     [PrismaModule, NotificationsModule, UploadModule, AuthModule],
  controllers: [ConversationsController],
  providers:   [ConversationsService, ConversationsGateway],
  exports:     [ConversationsService, ConversationsGateway],
})
export class ConversationsModule {}
