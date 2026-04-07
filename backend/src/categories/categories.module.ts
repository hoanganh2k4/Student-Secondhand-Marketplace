import { Module }              from '@nestjs/common'
import { PrismaModule }        from '../prisma/prisma.module'
import { CategoriesController } from './categories.controller'

@Module({
  imports:     [PrismaModule],
  controllers: [CategoriesController],
})
export class CategoriesModule {}
