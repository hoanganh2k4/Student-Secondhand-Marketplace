import { Module }               from '@nestjs/common'
import { PrismaModule }         from '../prisma/prisma.module'
import { AuthModule }           from '../auth/auth.module'
import { ConversationsModule }  from '../conversations/conversations.module'
import { PaymentsService }      from './payments.service'
import { PaymentsController }   from './payments.controller'
import { MomoService }          from './momo.service'
import { VnpayService }         from './vnpay.service'

@Module({
  imports:     [PrismaModule, AuthModule, ConversationsModule],
  controllers: [PaymentsController],
  providers:   [PaymentsService, MomoService, VnpayService],
  exports:     [PaymentsService],
})
export class PaymentsModule {}
