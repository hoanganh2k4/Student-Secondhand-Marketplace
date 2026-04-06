import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { MailModule } from './mail/mail.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { UploadModule } from './upload/upload.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    UploadModule,
  ],
})
export class AppModule {}
