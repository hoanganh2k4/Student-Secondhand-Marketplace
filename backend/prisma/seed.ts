import { PrismaClient } from '@prisma/client'

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

async function main() {
  await prisma.category.createMany({
    data:           TOP_LEVEL_CATEGORIES.map((c) => ({ ...c, isActive: true })),
    skipDuplicates: true,
  })
  console.log(`Seeded ${TOP_LEVEL_CATEGORIES.length} categories.`)
}

main().finally(() => prisma.$disconnect())
