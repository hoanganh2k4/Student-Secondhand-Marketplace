import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
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
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { DemandsService } from './demands.service'
import { CreateDemandDto, UpdateDemandDto } from './dto/demands.dto'

const DEMAND_EXAMPLE = {
  id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  buyerProfileId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  title: 'Cần mua laptop sinh viên',
  categoryId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  description: 'Dùng để lập trình và học tập. Cần pin tốt, RAM ≥ 8GB.',
  budgetMin: '5000000',
  budgetMax: '10000000',
  preferredCondition: 'good',
  quantityNeeded: 1,
  location: 'Quận 10, TP.HCM',
  urgency: 'within_week',
  specialRequirements: 'Ưu tiên MacBook hoặc ThinkPad.',
  status: 'draft',
  expiresAt: '2026-05-11T00:00:00.000Z',
  createdAt: '2026-04-11T08:00:00.000Z',
  matches: [],
}

@ApiBearerAuth('access-token')
@ApiTags('Demands')
@Controller('demands')
@UseGuards(JwtAuthGuard)
export class DemandsController {
  constructor(private readonly demandsService: DemandsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new demand request', description: 'Creates demand in draft status. Activate via PATCH /demands/:id/activate to trigger matching.' })
  @ApiResponse({ status: 201, description: 'Demand created', schema: { example: DEMAND_EXAMPLE } })
  @ApiResponse({ status: 400, description: 'Validation error', schema: { example: { statusCode: 400, message: ['budgetMin must not be less than 0'], error: 'Bad Request' } } })
  create(@Request() req: any, @Body() dto: CreateDemandDto) {
    return this.demandsService.create(req.user.id, dto)
  }

  @Get()
  @ApiOperation({ summary: 'List all demands for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Array of demands with match counts',
    schema: {
      example: [
        { ...DEMAND_EXAMPLE, status: 'active', matches: [{ id: 'match-uuid', matchScore: 78, matchConfidence: 'high', status: 'proposed' }] },
        { ...DEMAND_EXAMPLE, id: 'other-uuid', title: 'Cần mua điện thoại cũ', status: 'draft', matches: [] },
      ],
    },
  })
  list(@Request() req: any) {
    return this.demandsService.list(req.user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single demand with its matches' })
  @ApiResponse({
    status: 200,
    description: 'Demand with full match list',
    schema: {
      example: {
        ...DEMAND_EXAMPLE,
        status: 'active',
        category: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', name: 'Laptop' },
        matches: [{
          id: 'match-uuid',
          matchScore: 78,
          matchConfidence: 'high',
          status: 'proposed',
          productListing: { id: 'listing-uuid', title: 'MacBook Air M1', priceExpectation: '18500000', condition: 'like_new' },
        }],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Demand not found', schema: { example: { statusCode: 404, message: 'Demand not found', error: 'Not Found' } } })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.demandsService.findOne(req.user.id, id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a demand (draft only)' })
  @ApiResponse({ status: 200, description: 'Updated demand', schema: { example: { ...DEMAND_EXAMPLE, title: 'Cần mua laptop sinh viên giá rẻ' } } })
  @ApiResponse({ status: 400, description: 'Cannot update — demand not in draft', schema: { example: { statusCode: 400, message: 'Only draft demands can be updated', error: 'Bad Request' } } })
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateDemandDto,
  ) {
    return this.demandsService.update(req.user.id, id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel / delete a demand' })
  @ApiResponse({
    status: 200,
    description: 'Demand cancelled',
    schema: { example: { deleted: true, id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' } },
  })
  @ApiResponse({ status: 404, description: 'Demand not found', schema: { example: { statusCode: 404, message: 'Demand not found', error: 'Not Found' } } })
  cancel(@Request() req: any, @Param('id') id: string) {
    return this.demandsService.cancel(req.user.id, id)
  }
}
