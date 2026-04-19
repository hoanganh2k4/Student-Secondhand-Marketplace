import { Module }               from '@nestjs/common'
import { ConfigModule }         from '@nestjs/config'
import { PrismaModule }         from './prisma/prisma.module'
import { MailModule }           from './mail/mail.module'
import { AuthModule }           from './auth/auth.module'
import { UsersModule }          from './users/users.module'
import { UploadModule }         from './upload/upload.module'
import { NotificationsModule }  from './notifications/notifications.module'
import { DemandsModule }        from './demands/demands.module'
import { ListingsModule }       from './listings/listings.module'
import { MatchingModule }       from './matching/matching.module'
import { MatchesModule }        from './matches/matches.module'
import { ConversationsModule }  from './conversations/conversations.module'
import { OffersModule }         from './offers/offers.module'
import { OrdersModule }         from './orders/orders.module'
import { SchedulerModule }      from './scheduler/scheduler.module'
import { AdminModule }          from './admin/admin.module'
import { CategoriesModule }     from './categories/categories.module'
import { AiModule }             from './ai/ai.module'
import { PaymentsModule }       from './payments/payments.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    UploadModule,
    NotificationsModule,
    DemandsModule,
    ListingsModule,
    MatchingModule,
    MatchesModule,
    ConversationsModule,
    OffersModule,
    OrdersModule,
    SchedulerModule,
    AdminModule,
    CategoriesModule,
    AiModule,
    PaymentsModule,
  ],
})
export class AppModule {}
