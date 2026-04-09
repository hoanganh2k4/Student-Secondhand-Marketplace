import { Module }           from '@nestjs/common'
import { ListingsService }  from './listings.service'
import { ListingsController } from './listings.controller'
import { MatchingModule }   from '../matching/matching.module'
import { UploadModule }     from '../upload/upload.module'
import { AiModule }         from '../ai/ai.module'

@Module({
  imports:     [MatchingModule, UploadModule, AiModule],
  controllers: [ListingsController],
  providers:   [ListingsService],
  exports:     [ListingsService],
})
export class ListingsModule {}
