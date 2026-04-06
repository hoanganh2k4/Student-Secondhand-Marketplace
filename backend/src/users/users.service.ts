import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { studentProfile: true, buyerProfile: true, sellerProfile: true },
    })
    if (!user) throw new NotFoundException('User not found.')
    const { passwordHash, ...rest } = user
    return { ...rest, hasPassword: !!passwordHash }
  }

  async updateProfile(id: string, data: { name?: string; phone?: string }) {
    return this.prisma.user.update({ where: { id }, data })
  }
}
