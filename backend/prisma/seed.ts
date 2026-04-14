import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const TOP_LEVEL_CATEGORIES = [
  { name: 'Textbooks' },
  { name: 'Electronics' },
  { name: 'Furniture' },
  { name: 'Clothing' },
  { name: 'Appliances' },
  { name: 'Sports Gear' },
  { name: 'Musical Instruments' },
  { name: 'Gaming' },
  { name: 'Stationery' },
  { name: 'Other' },
]

const ADMIN_EMAIL    = 'admin@marketplace.com'
const ADMIN_PASSWORD = 'Admin@123456'
const ADMIN_NAME     = 'System Admin'

async function main() {
  // ── Categories ────────────────────────────────────────────────────────────
  await prisma.category.createMany({
    data:           TOP_LEVEL_CATEGORIES.map((c) => ({ ...c, isActive: true })),
    skipDuplicates: true,
  })
  console.log(`Seeded ${TOP_LEVEL_CATEGORIES.length} categories.`)

  // ── Admin account ─────────────────────────────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (existing) {
    // Ensure the existing account has admin privileges
    if (!existing.isAdmin) {
      await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { isAdmin: true } })
      console.log(`Granted admin role to existing user: ${ADMIN_EMAIL}`)
    } else {
      console.log(`Admin account already exists: ${ADMIN_EMAIL}`)
    }
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
    await prisma.user.create({
      data: {
        email:         ADMIN_EMAIL,
        emailVerified: true,
        name:          ADMIN_NAME,
        passwordHash,
        isAdmin:       true,
      },
    })
    console.log(`Created admin account: ${ADMIN_EMAIL}  /  password: ${ADMIN_PASSWORD}`)
  }
}

main().finally(() => prisma.$disconnect())
