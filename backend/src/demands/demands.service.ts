import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MatchingService } from '../matching/matching.service'
import { transitionDemand } from '../common/state-machines'
import { CreateDemandDto, UpdateDemandDto } from './dto/demands.dto'
import { DemandStatus } from '@prisma/client'

@Injectable()
export class DemandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
  ) {}

  async create(userId: string, dto: CreateDemandDto) {
    const buyerProfile = await this.prisma.buyerProfile.findUnique({
      where: { userId },
    })
    if (!buyerProfile) throw new NotFoundException('Buyer profile not found.')

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    })
    if (!category) throw new NotFoundException('Category not found.')

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const demand = await this.prisma.demandRequest.create({
      data: {
        buyerProfileId: buyerProfile.id,
        title: dto.title,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        description: dto.description,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        preferredCondition: dto.preferredCondition,
        quantityNeeded: dto.quantityNeeded ?? 1,
        location: dto.location,
        urgency: dto.urgency,
        specialRequirements: dto.specialRequirements,
        status: 'active',
        expiresAt,
      },
    })

    // fire-and-forget matching
    this.matching.runForDemand(demand.id).catch(() => null)

    return demand
  }

  async list(userId: string) {
    const buyerProfile = await this.prisma.buyerProfile.findUnique({
      where: { userId },
    })
    if (!buyerProfile) throw new NotFoundException('Buyer profile not found.')

    return this.prisma.demandRequest.findMany({
      where:   { buyerProfileId: buyerProfile.id },
      include: { matches: { select: { id: true, matchScore: true, matchConfidence: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(userId: string, id: string) {
    const demand = await this.prisma.demandRequest.findUnique({
      where: { id },
      include: { matches: true },
    })
    if (!demand) throw new NotFoundException('Demand not found.')

    const buyerProfile = await this.prisma.buyerProfile.findUnique({
      where: { userId },
    })
    if (!buyerProfile || demand.buyerProfileId !== buyerProfile.id)
      throw new ForbiddenException('Access denied.')

    return demand
  }

  async update(userId: string, id: string, dto: UpdateDemandDto) {
    const demand = await this.findOne(userId, id)

    const editableStatuses: DemandStatus[] = ['draft', 'active']
    if (!editableStatuses.includes(demand.status)) {
      throw new UnprocessableEntityException(
        `Cannot edit demand with status '${demand.status}'.`,
      )
    }

    return this.prisma.demandRequest.update({
      where: { id },
      data: {
        title: dto.title,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        description: dto.description,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        preferredCondition: dto.preferredCondition,
        quantityNeeded: dto.quantityNeeded,
        location: dto.location,
        urgency: dto.urgency,
        specialRequirements: dto.specialRequirements,
      },
    })
  }

  async cancel(userId: string, id: string) {
    const demand = await this.findOne(userId, id)
    const nextStatus = transitionDemand(demand.status, 'cancelled')

    return this.prisma.demandRequest.update({
      where: { id },
      data: { status: nextStatus },
    })
  }
}
