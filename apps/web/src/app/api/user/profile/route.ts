import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/

export async function PATCH(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { username, displayName } = await req.json()

  if (username !== undefined) {
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: 'Pseudo invalide — 3 à 20 caractères, lettres, chiffres, _ ou -' },
        { status: 400 }
      )
    }
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { clerkId } },
      select: { id: true },
    })
    if (taken) return NextResponse.json({ error: 'Ce pseudo est déjà pris' }, { status: 409 })
  }

  if (displayName !== undefined && (typeof displayName !== 'string' || displayName.trim().length < 1 || displayName.length > 30)) {
    return NextResponse.json({ error: 'Nom affiché invalide (1-30 caractères)' }, { status: 400 })
  }

  const data: Record<string, string> = {}
  if (username !== undefined) data.username = username.toLowerCase()
  if (displayName !== undefined) data.displayName = displayName.trim()

  const user = await prisma.user.update({
    where: { clerkId },
    data,
    select: { username: true, displayName: true },
  })

  return NextResponse.json({ ok: true, ...user })
}
