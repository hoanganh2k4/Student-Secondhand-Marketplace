import { ApiTags } from '@nestjs/swagger'
import { ApiBearerAuth } from '@nestjs/swagger'
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { DemandsService } from './demands.service'
import { CreateDemandDto, UpdateDemandDto } from './dto/demands.dto'

@ApiBearerAuth('access-token')
@ApiTags('Demands')
@Controller('demands')
@UseGuards(JwtAuthGuard)
export class DemandsController {
  constructor(private readonly demandsService: DemandsService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateDemandDto) {
    return this.demandsService.create(req.user.id, dto)
  }

  @Get()
  list(@Request() req: any) {
    return this.demandsService.list(req.user.id)
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.demandsService.findOne(req.user.id, id)
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateDemandDto,
  ) {
    return this.demandsService.update(req.user.id, id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@Request() req: any, @Param('id') id: string) {
    return this.demandsService.cancel(req.user.id, id)
  }
}
