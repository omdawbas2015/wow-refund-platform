import { NextResponse } from 'next/server';
import { prisma } from '@wow/db';
import { auth } from '@/auth';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const excludeCaseId = searchParams.get('excludeCaseId') ?? undefined;

  if (!email) {
    return NextResponse.json({ priorCases: [], promos: [] });
  }

  const [priorCases, allocations] = await Promise.all([
    prisma.refundCase.findMany({
      where: {
        customerEmail: email,
        deletedAt: null,
        ...(excludeCaseId ? { id: { not: excludeCaseId } } : {}),
      },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        createdAt: true,
        totalRefundAmount: true,
        orderCurrency: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.promoAllocation.findMany({
      where: { customerEmail: email },
      include: {
        code: {
          include: {
            config: { select: { type: true, currency: true, value: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    priorCases: priorCases.map((pc) => ({
      id: pc.id,
      caseNumber: pc.caseNumber,
      status: pc.status,
      createdAt: pc.createdAt.toISOString(),
      totalRefundAmount: pc.totalRefundAmount,
      orderCurrency: pc.orderCurrency,
    })),
    promos: allocations.map((a) => ({
      id: a.id,
      code: a.code.code,
      type: a.code.config.type,
      amount: a.code.config.value,
      currency: a.code.config.currency,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}
