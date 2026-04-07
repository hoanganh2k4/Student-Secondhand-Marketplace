import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService }   from '../prisma/prisma.service'
import { ResolveDisputeDto, SuspendUserDto } from './dto/admin.dto'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── DISPUTES ─────────────────────────────────────────────────────────────

  async listDisputes() {
    return this.prisma.dispute.findMany({
      include: {
        order:   { select: { id: true, finalPrice: true } },
        filedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { openedAt: 'desc' },
    })
  }

  async resolveDispute(adminId: string, disputeId: string, dto: ResolveDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } })
    if (!dispute) throw new NotFoundException('Dispute not found.')

    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        resolution:      dto.resolution,
        resolutionNotes: dto.resolutionNotes,
        status:          'resolved',
        resolvedAt:      new Date(),
        assignedAdminId: adminId,
      },
    })
  }

  // ─── USERS ────────────────────────────────────────────────────────────────

  async listUsers(status?: string) {
    return this.prisma.user.findMany({
      where:   status ? { status: status as any } : undefined,
      select:  { id: true, name: true, email: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async suspendUser(userId: string, _dto: SuspendUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found.')
    return this.prisma.user.update({ where: { id: userId }, data: { status: 'suspended' } })
  }

  async banUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found.')
    return this.prisma.user.update({ where: { id: userId }, data: { status: 'banned' } })
  }

  async reinstateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found.')
    return this.prisma.user.update({ where: { id: userId }, data: { status: 'active' } })
  }

  // ─── LISTINGS ─────────────────────────────────────────────────────────────

  async removeListing(listingId: string) {
    const listing = await this.prisma.productListing.findUnique({ where: { id: listingId } })
    if (!listing) throw new NotFoundException('Listing not found.')
    return this.prisma.productListing.update({
      where: { id: listingId },
      data:  { status: 'removed' },
    })
  }
}
