import { Injectable, NotFoundException } from '@nestjs/common'
import { Notification } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(
    userId: string,
    type: string,
    body: string,
    referenceType?: string,
    referenceId?: string,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        type,
        body,
        referenceType,
        referenceId,
      },
    })
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    })
    if (!notification) throw new NotFoundException('Notification not found.')
    if (notification.userId !== userId)
      throw new NotFoundException('Notification not found.')

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    })
  }

  async list(userId: string): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }
}
