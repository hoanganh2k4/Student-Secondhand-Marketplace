import { Module }          from '@nestjs/common'
import { DemandsService }   from './demands.service'
import { DemandsController } from './demands.controller'
import { MatchingModule }   from '../matching/matching.module'

@Module({
  imports:     [MatchingModule],
  controllers: [DemandsController],
  providers:   [DemandsService],
  exports:     [DemandsService],
})
export class DemandsModule {}
