import express from 'express';
import { authenticate } from '../middlewares.js';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { startOfDay, endOfDay, subDays, format, parse } from 'date-fns';
import { getExchangeRates, convertToKWD, CURRENCY_MAP } from '../utils/currency.js';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();
const router = express.Router();

router.get('/analytics', async (req: any, res) => {
  try {
    const { range, countries, agentId, startDate, endDate } = req.query;
    const where: any = {};

    if (range && range !== 'custom') {
      if (range === 'today') {
        where.createdAt = { gte: startOfDay(new Date()), lte: endOfDay(new Date()) };
      } else if (range === '7d') {
        where.createdAt = { gte: startOfDay(subDays(new Date(), 7)) };
      } else if (range === '30d') {
        where.createdAt = { gte: startOfDay(subDays(new Date(), 30)) };
      }
    } else if (startDate && endDate) {
      where.createdAt = { gte: new Date(startDate as string), lte: new Date(endDate as string) };
    }

    if (countries) {
      const countryList = (countries as string).split(',').filter(Boolean);
      if (countryList.length > 0) {
        where.country = { code: { in: countryList } };
      }
    }

    if (agentId && agentId !== 'all') {
      where.agentId = agentId as string;
    }

    const rates = await getExchangeRates();

    const [cases, promoUsages] = await Promise.all([
      prisma.refundCase.findMany({
        where,
        include: { country: true, components: true }
      }),
      prisma.promoUsage.findMany({
        where: { case: where },
        include: { promoCode: true }
      })
    ]);

    const kpis = {
      totalCases: cases.length,
      pendingApproval: cases.filter(c => c.status === 'PENDING_APPROVAL').length,
      pendingRefund: cases.filter(c => c.status === 'PENDING_REFUND' || c.status === 'APPROVED' || c.status === 'PENDING_EXTERNAL').length,
      refundedCases: cases.filter(c => c.status === 'REFUNDED' || c.status === 'PARTIALLY_REFUNDED').length,
      totalRefundAmountKWD: cases.reduce((acc, c) => {
        if (c.status !== 'REFUNDED' && c.status !== 'PARTIALLY_REFUNDED') return acc;
        const currency = CURRENCY_MAP[c.country.code] || 'KWD';
        
        let actualRefundValue = c.orderAmount;
        if (c.components && c.components.length > 0) {
           actualRefundValue = c.components.filter((comp:any) => comp.status === 'COMPLETED').reduce((sum:number, comp:any) => sum + comp.amount, 0);
        } else if (c.partialAmount) {
           actualRefundValue = c.partialAmount;
        }

        return acc + convertToKWD(actualRefundValue, currency, rates);
      }, 0),
      grossRequestedAmountKWD: cases.reduce((acc, c) => {
        const currency = CURRENCY_MAP[c.country.code] || 'KWD';
        return acc + convertToKWD(c.orderAmount, currency, rates);
      }, 0),
      avgResolutionTime: cases.filter(c => c.refundedAt).length > 0 
        ? cases.filter(c => c.refundedAt).reduce((acc, c) => {
            const diff = (c.refundedAt!.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            return acc + diff;
          }, 0) / cases.filter(c => c.refundedAt).length
        : 0,
      totalPromosUsed: promoUsages.length,
      totalPromoValueKWD: promoUsages.reduce((acc, p) => {
        return acc + convertToKWD(p.promoCode.value, p.promoCode.currency, rates);
      }, 0)
    };

    // Charts - Group by day properly
    const volumeByDate: Record<string, number> = {};
    const valueByDate: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};

    cases.forEach(c => {
      const dateKey = format(c.createdAt, 'yyyy-MM-dd');
      volumeByDate[dateKey] = (volumeByDate[dateKey] || 0) + 1;
      
      if (c.status === 'REFUNDED' || c.status === 'PARTIALLY_REFUNDED') {
        const currency = CURRENCY_MAP[c.country.code] || 'KWD';
        let actualRefundValue = c.orderAmount;
        if (c.components && c.components.length > 0) {
           actualRefundValue = c.components.filter((comp:any)=>comp.status === 'COMPLETED').reduce((sum:number, comp:any) => sum + comp.amount, 0);
        } else if (c.partialAmount) {
           actualRefundValue = c.partialAmount;
        }
        const kwd = convertToKWD(actualRefundValue, currency, rates);
        valueByDate[dateKey] = (valueByDate[dateKey] || 0) + kwd;
      }

      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });

    const volumeChart = Object.entries(volumeByDate)
      .map(([dateKey, count]) => ({ dateKey, date: format(new Date(dateKey), 'MMM dd'), count }))
      .sort((a,b) => a.dateKey.localeCompare(b.dateKey));

    const valueChart = Object.entries(valueByDate)
      .map(([dateKey, amount]) => ({ dateKey, date: format(new Date(dateKey), 'MMM dd'), amount }))
      .sort((a,b) => a.dateKey.localeCompare(b.dateKey));

    const statusDist = Object.entries(statusCounts).map(([status, _count]) => ({ status, _count }));

    const rootCauseDist = await prisma.refundCase.groupBy({
      by: ['rootCauseId'],
      where,
      _count: true
    });

    const rootCausesMetadata = await prisma.rootCause.findMany();
    const rootCauseChart = rootCauseDist.map(rd => {
      const rc = rootCausesMetadata.find(m => m.id === rd.rootCauseId);
      return {
        name: rc?.name || 'Unknown',
        count: rd._count
      };
    });

    const promoUsageDist = promoUsages.reduce((acc: any, p) => {
      const val = p.promoCode.value;
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
    const promoChart = Object.entries(promoUsageDist).map(([value, count]) => ({ value: `${value} KWD`, count }));

    // Agent Performance
    const agents = await prisma.user.findMany({
      where: {
        role: 'AGENT',
        id: agentId && agentId !== 'all' ? (agentId as string) : undefined
      },
      include: {
        cases: {
          where: {
            createdAt: where.createdAt,
            country: where.country
          }
        }
      }
    });

    const agentPerformance = agents.map(a => {
      const aCases = a.cases;
      const approved = aCases.filter(c => ['PENDING_REFUND', 'REFUNDED', 'PENDING_APPROVAL'].includes(c.status));
      const refunded = aCases.filter(c => c.status === 'REFUNDED');
      
      return {
        name: a.name,
        total: aCases.length,
        approved: approved.length,
        refunded: refunded.length,
        avgResTime: refunded.length > 0 ? refunded.reduce((acc, c) => {
          return acc + (c.refundedAt!.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / refunded.length : 0
      };
    });

    // Insights
    const insights: string[] = [];
    const topRC = [...rootCauseChart].sort((a,b) => b.count - a.count)[0];
    if (kpis.totalCases > 0 && topRC) {
      insights.push(`Top root cause: ${topRC.name} (${Math.round((topRC.count / kpis.totalCases) * 100)}% of cases)`);
    }

    const countryDist = await prisma.refundCase.groupBy({
      by: ['countryId'],
      where,
      _count: true
    });
    if (countryDist.length > 0) {
      const countriesFull = await prisma.country.findMany();
      const topCountryRecord = [...countryDist].sort((a,b) => b._count - a._count)[0];
      const topCountry = countriesFull.find(c => c.id === topCountryRecord.countryId);
      insights.push(`Highest volume country: ${topCountry?.name || 'Unknown'} with ${topCountryRecord._count} cases.`);
    }

    if (kpis.avgResolutionTime > 0) {
      const benchmark = 3;
      const diff = kpis.avgResolutionTime - benchmark;
      if (diff > 0) {
        insights.push(`Avg resolution time is ${kpis.avgResolutionTime.toFixed(1)} days (higher than 3-day target by ${diff.toFixed(1)} days).`);
      } else {
        insights.push(`Excellent efficiency: Avg resolution time is ${kpis.avgResolutionTime.toFixed(1)} days (within 3-day target).`);
      }
    }

    if (kpis.totalPromosUsed > 0) {
      const promoIntensity = (kpis.totalPromosUsed / kpis.totalCases) * 100;
      insights.push(`Promo distribution intensity: ${promoIntensity.toFixed(1)}% of cases receive a digital compensation code.`);
    }

    res.json({
      kpis,
      charts: {
        volumeChart,
        valueChart,
        statusDist,
        rootCauseChart,
        promoChart
      },
      agentPerformance,
      insights
    });
  } catch (err: any) {
    console.error('Analytics Error:', err);
    res.status(500).json({ error: 'Failed to aggregate analytics data' });
  }
});

router.get('/export', authenticate, async (req: any, res) => {
  const { startDate, endDate, range, countries, agentId } = req.query;
  const where: any = {};
  if (range && range !== 'custom') {
    if (range === 'today') {
      where.createdAt = { gte: startOfDay(new Date()), lte: endOfDay(new Date()) };
    } else if (range === '7d') {
      where.createdAt = { gte: subDays(new Date(), 7) };
    } else if (range === '30d') {
      where.createdAt = { gte: subDays(new Date(), 30) };
    }
  } else if (startDate && endDate) {
    where.createdAt = {
      gte: new Date(startDate as string),
      lte: new Date(endDate as string)
    };
  }
  if (countries) {
    const countryList = (countries as string).split(',');
    where.country = { code: { in: countryList } };
  }
  if (agentId && agentId !== 'all') {
    where.agentId = agentId as string;
  }

  const rates = await getExchangeRates();
  const cases = await prisma.refundCase.findMany({
    where,
    include: { country: true, agent: true, rootCause: true }
  });

  const promoUsages = await prisma.promoUsage.findMany({
    where: { case: where },
    include: { 
      promoCode: true, 
      case: { include: { country: true } } 
    }
  });

  const workbook = new ExcelJS.Workbook();
  
  // Sheet 1: Executive Summary
  const summarySheet = workbook.addWorksheet('Executive Summary');
  summarySheet.columns = [
    { header: 'Country', key: 'country', width: 25 },
    { header: 'Total Cases', key: 'total', width: 15 },
    { header: 'Refunded', key: 'refunded', width: 15 },
    { header: 'Value (KWD)', key: 'value', width: 20 },
    { header: 'Avg Resolution Time', key: 'avg', width: 20 }
  ];
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

  // Group by country for summary
  const summaryMap: Record<string, any> = {};
  cases.forEach(c => {
    const country = c.country.name;
    if (!summaryMap[country]) {
      summaryMap[country] = { name: country, total: 0, refunded: 0, value: 0, resTimes: [] };
    }
    summaryMap[country].total++;
    if (c.status === 'REFUNDED') {
      summaryMap[country].refunded++;
      const currency = CURRENCY_MAP[c.country.code] || 'KWD';
      summaryMap[country].value += convertToKWD(c.orderAmount, currency, rates);
      if (c.refundedAt) {
        summaryMap[country].resTimes.push((c.refundedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
  });

  Object.values(summaryMap).forEach((s: any) => {
    summarySheet.addRow({
      country: s.name,
      total: s.total,
      refunded: s.refunded,
      value: s.value.toFixed(3),
      avg: s.resTimes.length > 0 ? (s.resTimes.reduce((a: any, b: any) => a + b, 0) / s.resTimes.length).toFixed(1) + ' days' : 'N/A'
    });
  });

  // Dedicated Sheets per Country
  const uniqueCountries = [...new Set(cases.map(c => c.country.name))];
  uniqueCountries.forEach(countryName => {
    const countryCases = cases.filter(c => c.country.name === countryName);
    const countryCode = countryCases[0]?.country.code || 'UNKNOWN';
    const localCurrency = CURRENCY_MAP[countryCode] || 'KWD';

    const sheet = workbook.addWorksheet(countryName.substring(0, 31)); // Max 31 chars
    sheet.columns = [
      { header: 'Case Number', key: 'caseNumber', width: 20 },
      { header: 'Customer', key: 'customerName', width: 25 },
      { header: 'Order Number', key: 'orderNumber', width: 20 },
      { header: `Local Amount (${localCurrency})`, key: 'localAmount', width: 20 },
      { header: 'KWD Equivalent', key: 'kwdAmount', width: 20 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Payment', key: 'paymentMethod', width: 15 },
      { header: 'Date', key: 'createdAt', width: 20 }
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } };

    countryCases.forEach(c => {
      sheet.addRow({
        caseNumber: c.caseNumber,
        customerName: c.customerName,
        orderNumber: c.orderNumber,
        localAmount: c.orderAmount.toFixed(localCurrency === 'KWD' ? 3 : 2),
        kwdAmount: convertToKWD(c.orderAmount, localCurrency, rates).toFixed(3),
        status: c.status,
        paymentMethod: c.paymentMethod,
        createdAt: format(c.createdAt, 'yyyy-MM-dd HH:mm')
      });
    });
  });

  // Final Sheet: Promo Statistics
  const promoSheet = workbook.addWorksheet('Promo Tracking');
  promoSheet.columns = [
    { header: 'Promo Code', key: 'code', width: 20 },
    { header: 'Local Value', key: 'value', width: 15 },
    { header: 'KWD Value', key: 'kwd', width: 15 },
    { header: 'Related Case', key: 'case', width: 20 },
    { header: 'Used At', key: 'date', width: 20 }
  ];
  promoSheet.getRow(1).font = { bold: true };
  
  promoUsages.forEach(p => {
    promoSheet.addRow({
      code: p.promoCode.code,
      value: `${p.promoCode.value} ${p.promoCode.currency}`,
      kwd: convertToKWD(p.promoCode.value, p.promoCode.currency, rates).toFixed(3),
      case: p.caseNumber,
      date: format(p.usedAt, 'yyyy-MM-dd HH:mm')
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=Alshaya-Analytics-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
});

export default router;
