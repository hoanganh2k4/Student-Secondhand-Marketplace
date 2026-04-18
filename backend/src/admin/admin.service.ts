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

  async getDispute(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        filedBy: { select: { id: true, name: true, email: true } },
        order: {
          select: {
            id: true,
            finalPrice: true,
            status: true,
            buyer:  { select: { id: true, name: true, email: true } },
            seller: { select: { id: true, name: true, email: true } },
            match: {
              select: {
                productListing: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    })
    if (!dispute) throw new NotFoundException('Dispute not found.')
    return dispute
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

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
        buyerProfile: { select: { buyerRating: true, totalOrdersCompleted: true, trustTier: true } },
        sellerProfile: { select: { sellerRating: true, totalListingsCreated: true, totalOrdersCompleted: true } },
        buyerOrders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, finalPrice: true, createdAt: true },
        },
        sellerOrders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, finalPrice: true, createdAt: true },
        },
        filedDisputes: {
          take: 5,
          orderBy: { openedAt: 'desc' },
          select: { id: true, status: true, description: true, openedAt: true },
        },
        _count: {
          select: { buyerOrders: true, sellerOrders: true, filedDisputes: true },
        },
      },
    })
    if (!user) throw new NotFoundException('User not found.')
    return user
  }

  async listUsers(status?: string) {
    return this.prisma.user.findMany({
      where:   status ? { status: status as any } : undefined,
      select: {
        id: true, name: true, email: true, status: true, createdAt: true,
        buyerProfile:  { select: { buyerRating: true } },
        sellerProfile: { select: { sellerRating: true } },
        _count: { select: { buyerOrders: true, sellerOrders: true } },
      },
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

  async listListings(params: {
    status?: string;
    categoryId?: string;
    condition?: string;
    search?: string;
    limit: number;
    offset: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { status, categoryId, condition, search, limit, offset, sortBy, sortOrder } = params;

    const where: any = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (condition) where.condition = condition;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { sellerProfile: { user: { email: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [total, listings] = await Promise.all([
      this.prisma.productListing.count({ where }),
      this.prisma.productListing.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { [sortBy ?? 'createdAt']: sortOrder ?? 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          sellerProfile: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          proofAssets: true, 
          _count: { select: { matches: true } },
        },
      }),
    ]);

    return {
      total,
      limit,
      offset,
      listings: listings.map((l) => ({
        id: l.id,
        title: l.title,
        status: l.status,
        condition: l.condition,
        priceExpectation: l.priceExpectation,
        location: l.location,
        proofCompletenessScore: l.proofCompletenessScore,
        imageCount: l.proofAssets?.length || 0,
        hasVision: l.proofAssets?.some((p) => p.aiAttributes != null) || false,
        expiresAt: l.expiresAt,
        createdAt: l.createdAt,
        matchCount: l._count.matches,
        thumbnailUrl: l.proofAssets?.[0]?.fileUrl || null, 
        category: l.category,
        seller: l.sellerProfile.user,
      })),
    };
  }

  async getListing(id: string) {
    const listing = await this.prisma.productListing.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        sellerProfile: {
          include: {
            user: {
              select: {
                id: true, name: true, email: true,
                buyerProfile: { select: { buyerRating: true } },
              },
            },
          },
        },
        proofAssets: {
          select: {
            id: true,
            fileUrl: true,
            aiAttributes: true,
          },
        },
        matches: {
          include: {
            demandRequest: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException(`ProductListing with ID ${id} not found`);
    }

    return {
      id: listing.id,
      title: listing.title,
      status: listing.status,
      condition: listing.condition,
      priceExpectation: listing.priceExpectation,
      location: listing.location,
      proofCompletenessScore: listing.proofCompletenessScore,
      expiresAt: listing.expiresAt,
      createdAt: listing.createdAt,
      description: listing.description,
      conditionNotes: listing.conditionNotes,
      priceFlexible: listing.priceFlexible,
      quantityAvailable: listing.quantityAvailable,
      quantityRemaining: listing.quantityRemaining,
      category: listing.category,
      proofAssets: listing.proofAssets,
      sellerProfile: {
        id: listing.sellerProfile.id,
        userId: listing.sellerProfile.user.id,
        name: listing.sellerProfile.user.name,
        email: listing.sellerProfile.user.email,
        sellerRating: listing.sellerProfile.sellerRating,
        buyerRating: listing.sellerProfile.user.buyerProfile?.buyerRating ?? null,
        totalOrdersCompleted: listing.sellerProfile.totalOrdersCompleted,
        trustTier: listing.sellerProfile.trustTier,
      },
      matches: listing.matches.map((match) => ({
        id: match.id,
        matchScore: match.matchScore,
        status: match.status,
        createdAt: match.createdAt,
        demandRequest: match.demandRequest,
      })),
    };
  }

  async removeListing(listingId: string) {
    const listing = await this.prisma.productListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found.');

    await this.prisma.$transaction([
      this.prisma.productListing.update({ where: { id: listingId }, data: { status: 'removed' } }),
      this.prisma.match.updateMany({
        where: {
          productListingId: listingId,
          status: { notIn: ['closed_failed', 'closed_success'] },
        },
        data: { status: 'closed_failed' },
      }),
    ]);

    return { id: listingId, status: 'removed' };
  }

  async removeDemand(demandId: string) {
    const demand = await this.prisma.demandRequest.findUnique({ where: { id: demandId } });
    if (!demand) throw new NotFoundException('Demand not found.');

    await this.prisma.$transaction([
      this.prisma.demandRequest.update({ where: { id: demandId }, data: { status: 'cancelled' } }),
      this.prisma.match.updateMany({
        where: {
          demandRequestId: demandId,
          status: { notIn: ['closed_failed', 'closed_success'] },
        },
        data: { status: 'closed_failed' },
      }),
    ]);

    return { id: demandId, status: 'cancelled' };
  }

  // ─── DEMANDS ──────────────────────────────────────────────────────────────

  async listDemands(params: {
    status?: string;
    categoryId?: string;
    search?: string;
    limit: number;
    offset: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { status, categoryId, search, limit, offset, sortBy, sortOrder } = params;

    const where: any = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { buyerProfile: { user: { email: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [total, demands] = await Promise.all([
      this.prisma.demandRequest.count({ where }),
      this.prisma.demandRequest.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { [sortBy ?? 'createdAt']: sortOrder ?? 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          buyerProfile: { 
            include: { user: { select: { id: true, name: true, email: true } } }
          },
          _count: { select: { matches: true } },
        },
      }),
    ]);

    return {
      total,
      limit,
      offset,
      demands: demands.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        budgetMin: d.budgetMin,
        budgetMax: d.budgetMax,
        preferredCondition: d.preferredCondition,
        location: d.location,
        urgency: d.urgency,
        expiresAt: d.expiresAt,
        createdAt: d.createdAt,
        matchCount: d._count.matches,
        category: d.category,
        buyer: d.buyerProfile.user, 
      })),
    };
  }

  async getDemand(id: string) {
    const demand = await this.prisma.demandRequest.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        buyerProfile: {
          include: {
            user: {
              select: {
                id: true, name: true, email: true,
                studentProfile: { select: { university: true } },
                sellerProfile: { select: { sellerRating: true } },
              },
            },
          },
        },
        matches: {
          include: {
            productListing: {
              select: { id: true, title: true, status: true },
            },
          },
        },
      },
    });

    if (!demand) {
      throw new NotFoundException(`DemandRequest with ID ${id} not found`);
    }

    return {
      id: demand.id,
      title: demand.title,
      status: demand.status,
      budgetMin: demand.budgetMin,
      budgetMax: demand.budgetMax,
      preferredCondition: demand.preferredCondition,
      location: demand.location,
      urgency: demand.urgency,
      expiresAt: demand.expiresAt,
      createdAt: demand.createdAt,
      description: demand.description,
      specialRequirements: demand.specialRequirements,
      quantityNeeded: demand.quantityNeeded,
      fulfilledQuantity: demand.fulfilledQuantity,
      category: demand.category,
      buyerProfile: {
        id: demand.buyerProfile.id,
        userId: demand.buyerProfile.user.id,
        name: demand.buyerProfile.user.name,
        email: demand.buyerProfile.user.email,
        trustTier: demand.buyerProfile.trustTier,
        buyerRating: demand.buyerProfile.buyerRating,
        sellerRating: demand.buyerProfile.user.sellerProfile?.sellerRating ?? null,
        totalOrdersCompleted: demand.buyerProfile.totalOrdersCompleted,
        university: demand.buyerProfile.user.studentProfile?.university ?? null,
      },
      matches: demand.matches.map((match) => ({
        id: match.id,
        matchScore: match.matchScore,
        matchConfidence: match.matchConfidence,
        status: match.status,
        createdAt: match.createdAt,
        productListing: match.productListing,
      })),
    };
  }

  // ─── ORDERS ───────────────────────────────────────────────────────────────

  async listOrders(params: {
    status?: string;
    fulfillmentMethod?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    limit: number;
    offset: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { status, fulfillmentMethod, search, fromDate, toDate, limit, offset, sortBy, sortOrder } = params;

    const where: any = {};
    if (status) where.status = status;
    if (fulfillmentMethod) where.fulfillmentMethod = fulfillmentMethod;

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    if (search) {
      where.OR = [
        { buyer: { email: { contains: search, mode: 'insensitive' } } },
        { seller: { email: { contains: search, mode: 'insensitive' } } },
        { match: { productListing: { title: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { [sortBy ?? 'createdAt']: sortOrder ?? 'desc' },
        include: {
          match: {
            include: {
              productListing: { select: { id: true, title: true } }
            }
          },
          buyer: { select: { id: true, name: true, email: true } },
          seller: { select: { id: true, name: true, email: true } },
          dispute: { select: { id: true } },
          _count: { select: { ratingReviews: true } }, 
        },
      }),
    ]);

    return {
      total,
      limit,
      offset,
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        finalPrice: o.finalPrice,
        quantity: o.quantity,
        fulfillmentMethod: o.fulfillmentMethod,
        buyerConfirmedComplete: o.buyerConfirmedComplete,
        sellerConfirmedComplete: o.sellerConfirmedComplete,
        completedAt: o.completedAt,
        createdAt: o.createdAt,
        hasDispute: o.dispute !== null,
        reviewCount: o._count?.ratingReviews || 0,
        listing: o.match?.productListing,
        buyer: o.buyer,
        seller: o.seller,
      })),
    };
  }

  async getOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        match: {
          include: {
            demandRequest: { select: { id: true, title: true } },
            productListing: { select: { id: true, title: true } },
          },
        },
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
        offer: {
          select: { proposedPrice: true, fulfillmentMethod: true },
        },
        dispute: true,
        ratingReviews: {
          select: { roleOfReviewer: true, rating: true, comment: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return {
      id: order.id,
      status: order.status,
      finalPrice: order.finalPrice,
      quantity: order.quantity,
      fulfillmentMethod: order.fulfillmentMethod,
      buyerConfirmedComplete: order.buyerConfirmedComplete,
      sellerConfirmedComplete: order.sellerConfirmedComplete,
      completedAt: order.completedAt,
      createdAt: order.createdAt,
      hasDispute: order.dispute !== null,
      listing: order.match?.productListing,
      buyer: order.buyer,
      seller: order.seller,
      
      meetupDetails: order.meetupDetails,
      cancellationReason: order.cancellationReason,
      match: order.match ? {
        id: order.match.id,
        matchScore: order.match.matchScore,
        demandRequest: order.match.demandRequest,
        productListing: order.match.productListing,
      } : null,
      offer: order.offer,
      dispute: order.dispute,
      ratingReviews: order.ratingReviews,
    };
  }

  // ─── STATS ────────────────────────────────────────────────────────────────

  async getStats() {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const [
      totalDemands, activeDemands, fulfilledDemands, expiringSoonDemands,
      totalListings, activeListings, removedListings, lowProofScoreListings,
      totalOrders, completedOrders, disputedOrders, inProgressOrders, totalVolumeResult,
      totalMatches, successfulMatches
    ] = await Promise.all([
      // --- DEMANDS ---
      this.prisma.demandRequest.count(),
      this.prisma.demandRequest.count({ where: { status: 'active' } }),
      this.prisma.demandRequest.count({ where: { status: 'fulfilled' } }),
      this.prisma.demandRequest.count({ 
        where: { 
          status: 'active', 
          expiresAt: { lte: threeDaysFromNow, gte: new Date() } 
        } 
      }),

      // --- LISTINGS ---
      this.prisma.productListing.count(),
      this.prisma.productListing.count({ where: { status: 'active' } }),
      this.prisma.productListing.count({ where: { status: 'removed' } }),
      this.prisma.productListing.count({ where: { proofCompletenessScore: { lt: 50 } } }),

      // --- ORDERS ---
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'completed' } }),
      this.prisma.order.count({ where: { dispute: { isNot: null } } }),
      this.prisma.order.count({ where: { status: 'in_progress' } }),
      this.prisma.order.aggregate({
        _sum: { finalPrice: true },
        where: { status: 'completed' } 
      }),

      this.prisma.match.count(),
      this.prisma.match.count({ where: { status: 'closed_success' } })
    ]);

    const conversionRate = totalMatches > 0 ? (successfulMatches / totalMatches) : 0;

    return {
      demands: {
        total: totalDemands,
        active: activeDemands,
        fulfilled: fulfilledDemands,
        expiringSoon: expiringSoonDemands,
      },
      listings: {
        total: totalListings,
        active: activeListings,
        removed: removedListings,
        lowProofScore: lowProofScoreListings,
      },
      orders: {
        total: totalOrders,
        completed: completedOrders,
        disputed: disputedOrders,
        inProgress: inProgressOrders,
        totalVolume: Number(totalVolumeResult._sum.finalPrice || 0),
      },
      matches: {
        total: totalMatches,
        conversionRate: Number(conversionRate.toFixed(2)),
      }
    };
  }
}
