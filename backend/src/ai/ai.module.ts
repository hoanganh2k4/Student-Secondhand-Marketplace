import { Module }        from '@nestjs/common'
import { AuthModule }    from '../auth/auth.module'
import { PrismaModule }  from '../prisma/prisma.module'
import { AiService }     from './ai.service'
import { AiController }  from './ai.controller'

@Module({
  imports:     [AuthModule, PrismaModule],
  providers:   [AiService],
  controllers: [AiController],
  exports:     [AiService],
})
export class AiModule {}
