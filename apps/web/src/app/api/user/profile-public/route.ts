import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { username: true, displayName: true, avatarUrl: true },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(user)
}
