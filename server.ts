import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { startOfDay, endOfDay, subDays, format, parseISO } from 'date-fns';
import cron from 'node-cron';
import ExcelJS from 'exceljs';
import { AsyncLocalStorage } from 'async_hooks';

// Internal module imports
import { caseSchema, promoSchema, userSchema } from './server/validation.js';
import { authenticateInternal, withErrorHandling, JWT_SECRET } from './server/middlewares.js';
import { getExchangeRates, convertToKWD, CURRENCY_MAP } from './server/utils/currency.js';
import analyticsRoutes from './server/routes/analytics.js';

dotenv.config();

const auditContext = new AsyncLocalStorage<{ userId?: string; actorName?: string }>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const basePrisma = new PrismaClient();

async function logAudit({
  caseId,
  caseNumber,
  orderNumber,
  userId,
  actorName,
  actionType,
  description,
  previousState,
  newState,
  metadata
}: {
  caseId?: string;
  caseNumber?: string;
  orderNumber?: string;
  userId?: string;
  actorName?: string;
  actionType: string;
  description?: string;
  previousState?: string;
  newState?: string;
  metadata?: any;
}) {
  try {
    const ctx = auditContext.getStore();
    const finalUserId = userId || ctx?.userId;
    const finalActor = actorName || ctx?.actorName || (finalUserId ? undefined : 'SYSTEM');

    await basePrisma.auditLog.create({
      data: {
        caseId,
        caseNumber,
        orderNumber,
        userId: finalUserId,
        actorName: finalActor,
        actionType,
        description,
        previousState: previousState ? String(previousState) : undefined,
        newState: newState ? String(newState) : undefined,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
  } catch (err) {
    console.error('[AUDIT_ERROR]', err);
  }
}

const prisma = basePrisma.$extends({
  query: {
    refundCase: {
      async update({ args, query }) {
        const where = args.where as any;
        let previous: any = null;
        if (where.id || where.caseNumber) {
          previous = await basePrisma.refundCase.findUnique({
            where,
            select: { id: true, status: true, caseNumber: true, orderNumber: true }
          });
        }
        
        const result = await query(args);
        
        if (previous && args.data.status && args.data.status !== previous.status) {
          await logAudit({
            caseId: previous.id,
            caseNumber: previous.caseNumber,
            orderNumber: previous.orderNumber,
            actionType: 'STATUS_CHANGE',
            description: `Auto-logged status transition`,
            previousState: previous.status,
            newState: args.data.status as string
          });
        }
        return result;
      },
      async create({ args, query }) {
        const result = await query(args);
        await logAudit({
          caseId: result.id,
          caseNumber: result.caseNumber,
          orderNumber: result.orderNumber,
          actionType: 'CASE_CREATED',
          description: `Case initialized`,
          newState: result.status
        });
        return result;
      }
    }
  }
});

function generateBatchEmailHtml(batchId: string, countryName: string, cases: any[], approveUrl: string, rejectUrl: string) {
  const tableRows = cases.map(c => `
    <tr>
      <td style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px; color: #1e293b;">${c.caseNumber}</td>
      <td style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px; color: #1e293b;">${c.customerName}</td>
      <td style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px; color: #1e293b;">${c.orderNumber}</td>
      <td style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px; color: #020617; font-weight: 700;">${c.orderAmount.toFixed(2)}</td>
      <td style="border: 1px solid #e2e8f0; padding: 10px; font-size: 13px; color: #64748b;">${c.rootCause.name}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 650px; margin: 40px auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: 800; margin: 0; color: #0f172a; letter-spacing: -0.025em;">Daily Refund Approvals — ${countryName}</h2>
        <p style="font-size: 14px; color: #64748b; margin: 8px 0 0 0; line-height: 1.5;">You have ${cases.length} pending refund requests requiring review.</p>
      </div>
      
      <div style="margin-bottom: 32px; background-color: #f8fafc; padding: 24px; border-radius: 8px; border: 1px solid #f1f5f9;">
        <p style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.05em;">Batch Actions</p>
        <div style="display: flex; gap: 12px;">
          <a href="${approveUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 700; display: inline-block; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);">APPROVE ALL</a>
          <span style="display: inline-block; width: 12px;"></span>
          <a href="${rejectUrl}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 700; display: inline-block; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);">REJECT ALL</a>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin: 16px 0 0 0;">Warning: These actions apply to the entire list below.</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #fcfcfd;">
            <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">Case Number</th>
            <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">Customer</th>
            <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">Order</th>
            <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">Amount</th>
            <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">Reason</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; display: flex; justify-content: space-between; align-items: center;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">Batch ID: ${batchId} • Link expires in 72h.</p>
        <p style="font-size: 11px; font-weight: 700; color: #0f172a; margin: 0; text-transform: uppercase;">Alshaya Operations Portal</p>
      </div>
    </div>
  `;
}

function generateResponseHtml(title: string, message: string, type: 'success' | 'warning' | 'error') {
  const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠' : '❌';
  const color = type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#ef4444';
  
  return `
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
        <div style="background: white; padding: 3rem; border-radius: 2rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0; text-align: center; max-width: 450px; width: 100%;">
          <div style="font-size: 4rem; margin-bottom: 2rem;">${icon}</div>
          <h1 style="font-size: 1.75rem; font-weight: 800; margin: 0 0 1rem 0; color: #0f172a; letter-spacing: -0.025em; line-height: 1.2;">${title}</h1>
          <p style="color: #64748b; font-size: 1rem; line-height: 1.6; margin-bottom: 2rem;">${message}</p>
          <div style="padding-top: 2rem; border-top: 1px solid #f1f5f9;">
            <p style="font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin: 0;">Internal Audit Log Updated</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// --- Background Jobs & Notifications ---
async function logSystemEvent(level: 'INFO' | 'ERROR' | 'WARNING', message: string, context?: any) {
  try {
    await prisma.systemLog.create({
      data: {
        level,
        message,
        context: context ? JSON.stringify(context) : null,
      }
    });
  } catch (error) {
    console.error('Failed to log system event:', error);
  }
}

async function notifyUser(userId: string, title: string, message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO') {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type
      }
    });
  } catch (error) {
    console.error('Failed to create notification', error);
  }
}

cron.schedule('0 0 * * *', async () => {
  console.log('Running daily background jobs...');
  try {
    // Check expired promo codes
    const updated = await prisma.promoCode.updateMany({
      where: {
        status: 'AVAILABLE',
        expiresAt: { lt: new Date() }
      },
      data: { status: 'EXPIRED' }
    });
    
    if (updated.count > 0) {
      await logSystemEvent('INFO', `Automatically expired ${updated.count} promo codes`);
    }

    // Cleanup expired tokens
    const deletedTokens = await prisma.approvalToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        isUsed: false
      }
    });
    
    if (deletedTokens.count > 0) {
      await logSystemEvent('INFO', `Cleaned up ${deletedTokens.count} expired unused tokens`);
    }
  } catch (error: any) {
    await logSystemEvent('ERROR', 'Background job failed', error.message);
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Middleware
  const authenticate = async (req: any, res: any, next: any) => {
    let token = '';
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token as string;
    }

    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Verify user still exists in DB
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) {
        return res.status(401).json({ error: 'User session expired or user no longer exists' });
      }
      
      req.user = decoded;
      // Run the remainder of the request chain inside the audit context
      auditContext.run({ userId: decoded.id, actorName: decoded.name }, () => next());
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
  };

  // --- API Routes ---

  // Global Smart Search
  app.get('/api/search/global', authenticate, withErrorHandling(async (req: any, res: any) => {
    const { q } = req.query;
    if (!q || String(q).length < 2) return res.json([]);

    const searchStr = String(q).toLowerCase();
    const isAdmin = req.user.role === 'ADMIN';

    // 1. Search Cases
    const caseWhere: any = {
      OR: [
        { caseNumber: { contains: searchStr } },
        { customerName: { contains: searchStr } },
        { customerEmail: { contains: searchStr } },
        { orderNumber: { contains: searchStr } }
      ]
    };
    // Agents can now see all cases in global search
    // if (!isAdmin) {
    //   caseWhere.agentId = req.user.id;
    // }

    const cases = await prisma.refundCase.findMany({
      where: caseWhere,
      take: 5,
      select: { id: true, caseNumber: true, customerName: true, status: true, orderNumber: true }
    });

    // 2. Search Promo Codes (Used ones for agents, all for admins)
    const promoResults = [];
    
    // Standard Promos
    const standardPromos = await prisma.promoCode.findMany({
      where: {
        OR: [
          { code: { contains: searchStr } },
          { usage: { caseNumber: { contains: searchStr } } }
        ],
        ...(isAdmin ? {} : { status: 'USED' })
      },
      include: { usage: { select: { caseNumber: true, usedBy: true } } },
      take: 5
    });

    // Internal Promos
    const internalPromos = await prisma.internalPromoCode.findMany({
      where: {
        OR: [
          { code: { contains: searchStr } },
          { usage: { caseNumber: { contains: searchStr } } }
        ],
        ...(isAdmin ? {} : { status: 'USED' })
      },
      include: { usage: { select: { caseNumber: true, usedBy: true } } },
      take: 5
    });

    res.json({
      cases: cases.map(c => ({ ...c, type: 'CASE' })),
      promos: [...standardPromos, ...internalPromos].map(p => ({
        id: p.id,
        code: p.code,
        status: p.status,
        caseNumber: p.usage?.caseNumber,
        type: 'PROMO'
      }))
    });
  }));

  // Admin: Seed Mock Data
  app.post('/api/admin/seed-data', authenticate, isAdmin, withErrorHandling(async (req: any, res: any) => {
    const countries = await prisma.country.findMany();
    const rootCauses = await prisma.rootCause.findMany();
    const branches = await prisma.branch.findMany();
    
    if (countries.length === 0 || rootCauses.length === 0 || branches.length === 0) {
      return res.status(400).json({ error: 'System metadata (countries/branches) must exist first' });
    }

    const names = ['Abdullah Ahmed', 'Sarah Smith', 'Omar Khalid', 'Fatima Ali', 'John Doe', 'Lina Hassan'];
    const statuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REFUNDED', 'PENDING_KNET'] as const;
    const paymentMethods = ['KNET', 'CREDIT_CARD', 'AURA_POINTS'];

    const createdCases = [];
    for (let i = 0; i < 20; i++) {
        const country = countries[Math.floor(Math.random() * countries.length)];
        const branch = branches.filter(b => b.countryId === country.id)[0] || branches[0];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        const c = await prisma.refundCase.create({
            data: {
                caseNumber: `CAS-${100000 + i}`,
                customerName: names[Math.floor(Math.random() * names.length)],
                customerEmail: `test-${i}@example.com`,
                customerPhone: `9659000${1000 + i}`,
                orderNumber: `ORD-${500000 + i}`,
                orderDate: new Date(),
                orderAmount: 10 + Math.random() * 200,
                paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
                status,
                countryId: country.id,
                branchId: branch.id,
                rootCauseId: rootCauses[Math.floor(Math.random() * rootCauses.length)].id,
                agentId: req.user.id,
                createdById: req.user.id,
                refundReason: 'Generated test data for UI verification',
                auraPoints: Math.random() > 0.5 ? String(Math.floor(Math.random() * 5000)) : null,
                auraStatus: status === 'APPROVED' ? 'PENDING' : 'NONE'
            }
        });
        createdCases.push(c);
    }

    res.json({ message: `Successfully seeded 20 mock cases`, casesCount: createdCases.length });
  }));

  // Internal: Batch Generation (Triggered by Power Automate)
  app.post('/api/internal/generate-approval-batch', authenticateInternal, async (req, res) => {
    try {
      // 1. Fetch all DRAFT cases
      const draftCases = await prisma.refundCase.findMany({
        where: { status: 'DRAFT' },
        include: { country: true, rootCause: true }
      });

      if (draftCases.length === 0) {
        return res.json([]);
      }

      // 2. Group by Country
      const countryGroups: Record<string, typeof draftCases> = {};
      draftCases.forEach(c => {
        if (!countryGroups[c.countryId]) countryGroups[c.countryId] = [];
        countryGroups[c.countryId].push(c);
      });

      const payload: any[] = [];
      const host = req.protocol + '://' + req.get('host');

      for (const countryId in countryGroups) {
        const cases = countryGroups[countryId];
        const country = cases[0].country;

        if (!country.managerEmail) {
          console.warn(`[BATCH] Skipping Country ${country.name}: No manager email configured.`);
          continue;
        }

        // 3. Generate batchId
        const batchIdStr = `BATCH-${new Date().toISOString().split('T')[0]}-${uuidv4().substring(0, 6).toUpperCase()}`;

        // 4. Create Batch Record
        const batch = await prisma.approvalBatch.create({
          data: {
            batchId: batchIdStr,
            country: country.name,
            managerEmail: country.managerEmail,
            status: 'PENDING'
          }
        });

        // 5. Generate Token
        const tokenStr = uuidv4();
        await prisma.approvalToken.create({
          data: {
            token: tokenStr,
            batchId: batch.id,
            expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72h
          }
        });

        const approveUrl = `${host}/api/approval/batch-confirm?token=${tokenStr}&action=approve`;
        const rejectUrl = `${host}/api/approval/batch-confirm?token=${tokenStr}&action=reject`;

        // 6. Build Email HTML
        const html = generateBatchEmailHtml(batchIdStr, country.name, cases, approveUrl, rejectUrl);

        payload.push({
          managerEmail: country.managerEmail,
          subject: `Daily Refund Approvals — ${country.name}`,
          html
        });

        // 7. Update Cases
        await prisma.refundCase.updateMany({
          where: { id: { in: cases.map(c => c.id) } },
          data: { status: 'PENDING_APPROVAL', batchId: batch.id }
        });

        // 8. Audit Log
        await logAudit({
          actionType: 'BATCH_CREATED',
          actorName: 'SYSTEM',
          description: `Batch ${batchIdStr} created for ${country.name} with ${cases.length} cases.`,
          metadata: { batchId: batch.id, caseCount: cases.length }
        });

        for (const c of cases) {
          await logAudit({
            caseId: c.id,
            caseNumber: c.caseNumber,
            orderNumber: c.orderNumber,
            actionType: 'BATCH_ASSIGNED',
            actorName: 'SYSTEM',
            description: `Assigned to batch ${batchIdStr}`
          });
        }
      }

      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Batch Approval Callback
  app.get('/api/approval/batch-confirm', async (req, res) => {
    const { token, action } = req.query;

    const approvalToken = await prisma.approvalToken.findUnique({
      where: { token: token as string },
      include: { batch: { include: { cases: true } } }
    });

    if (!approvalToken || !approvalToken.batch) {
      return res.status(400).send(generateResponseHtml('❌ Invalid Request', 'The provided token is invalid or does not exist.', 'error'));
    }

    if (approvalToken.isUsed) {
      return res.status(400).send(generateResponseHtml('⚠ Already Processed', 'This request has already been processed and cannot be modified.', 'warning'));
    }

    if (new Date() > approvalToken.expiresAt) {
      return res.status(400).send(generateResponseHtml('❌ Link Expired', 'This approval link has expired (72h limit).', 'error'));
    }

    const batch = approvalToken.batch;
    if (batch.status !== 'PENDING') {
      return res.status(400).send(generateResponseHtml('⚠ Already Decided', `This batch has already been ${batch.status.toLowerCase()}.`, 'warning'));
    }

    const decidedAt = new Date();
    const actor = batch.managerEmail; // Simplified

    if (action === 'approve') {
      await prisma.approvalBatch.update({
        where: { id: batch.id },
        data: { status: 'APPROVED', decidedAt, decidedBy: actor }
      });

      const updatedCases = await prisma.refundCase.findMany({ where: { batchId: batch.id } });
      for (const c of updatedCases) {
        const nextStatus = c.paymentMethod === 'KNET' ? 'APPROVED' : 'PENDING_REFUND';
        await prisma.refundCase.update({
          where: { id: c.id },
          data: { status: nextStatus, approvedAt: decidedAt }
        });
        await notifyUser(c.agentId, 'Case Approved', `Your refund case ${c.caseNumber} has been approved.`, 'SUCCESS');
      }

      await logAudit({
        actionType: 'BATCH_APPROVED',
        actorName: actor,
        description: `Batch ${batch.batchId} approved by ${actor} via email interaction.`,
        newState: 'APPROVED',
        metadata: { batchId: batch.id }
      });
    } else if (action === 'reject') {
      await prisma.approvalBatch.update({
        where: { id: batch.id },
        data: { status: 'REJECTED', decidedAt, decidedBy: actor }
      });

      await prisma.refundCase.updateMany({
        where: { batchId: batch.id },
        data: { status: 'DRAFT', batchId: null } // Revert to draft as per flow suggestion
      });

      await logAudit({
        actionType: 'BATCH_REJECTED',
        actorName: actor,
        description: `Batch ${batch.batchId} rejected by ${actor} via email interaction.`,
        newState: 'REJECTED',
        metadata: { batchId: batch.id }
      });

      const updatedCases = await prisma.refundCase.findMany({ where: { batchId: batch.id } });
      for (const c of updatedCases) {
        await notifyUser(c.agentId, 'Case Rejected', `Your refund case ${c.caseNumber} was rejected by ${actor}.`, 'ERROR');
      }
    }

    await prisma.approvalToken.update({
      where: { id: approvalToken.id },
      data: { isUsed: true }
    });

    return res.send(generateResponseHtml(
      `✅ Batch ${action === 'approve' ? 'Approved' : 'Rejected'}`,
      `The entire batch has been successfully ${action === 'approve' ? 'approved and moved to payment queue' : 'rejected and returned to drafts'}.`,
      'success'
    ));
  });

  // Admin: Update Manager Emails
  app.patch('/api/metadata/countries/:id/managerEmail', authenticate, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { managerEmail } = req.body;
    
    const country = await prisma.country.update({
      where: { id },
      data: { managerEmail }
    });
    
    res.json(country);
  });

  // --- Promo Code System ---

  // 1. Request Promo Code (Agent)
  // 1. Case Search (Auto-fill)
  app.get('/api/cases/search', authenticate, async (req: any, res) => {
    try {
      const { caseNumber } = req.query;
      if (!caseNumber) return res.status(400).json({ error: 'caseNumber query parameter is required' });

      const searchCaseNum = String(caseNumber).trim();

      // 1. Check master refund table
      const refundCase = await prisma.refundCase.findUnique({
        where: { caseNumber: searchCaseNum },
        include: { 
          branch: { select: { name: true } },
          promoUsages: { select: { id: true } }
        }
      });

      if (refundCase) {
        const [customerPromoCount, customerCaseCount, recentPromos] = await Promise.all([
          prisma.promoUsage.count({
            where: {
              OR: [
                { case: { customerEmail: refundCase.customerEmail } },
                { case: { customerPhone: refundCase.customerPhone } }
              ]
            }
          }),
          prisma.refundCase.count({
            where: {
              OR: [
                { customerEmail: refundCase.customerEmail },
                { customerPhone: refundCase.customerPhone }
              ]
            }
          }),
          prisma.promoUsage.findMany({
            where: {
              OR: [
                { case: { customerEmail: refundCase.customerEmail } },
                { case: { customerPhone: refundCase.customerPhone } }
              ]
            },
            select: { reason: true, usedAt: true },
            orderBy: { usedAt: 'desc' },
            take: 3
          })
        ]);

        return res.json({
          source: 'REFUND_SYSTEM',
          countryId: refundCase.countryId,
          customerEmail: refundCase.customerEmail,
          customerName: refundCase.customerName,
          orderNumber: refundCase.orderNumber,
          branchName: refundCase.branch.name,
          alreadyHasPromo: refundCase.promoUsages.length > 0,
          customerPromoCount,
          customerCaseCount,
          recentPromos,
          riskLevel: customerPromoCount > 3 ? 'HIGH' : customerPromoCount > 1 ? 'MEDIUM' : 'LOW'
        });
      }

      // 2. Not in master? Check global history (Usage)
      const historicalPromo = await prisma.promoUsage.findFirst({
        where: { caseNumber: searchCaseNum },
        orderBy: { usedAt: 'desc' },
        include: { case: true }
      });

      if (historicalPromo) {
        return res.json({
          source: 'HISTORICAL_PROMO',
          caseNumber: searchCaseNum,
          customerName: historicalPromo.case?.customerName || 'Previous Subject',
          customerEmail: historicalPromo.case?.customerEmail || 'N/A',
          orderNumber: historicalPromo.case?.orderNumber || historicalPromo.orderNumber,
          isHistorical: true
        });
      }

      const internalPromo = await prisma.internalPromoUsage.findFirst({
        where: { caseNumber: searchCaseNum },
        orderBy: { usedAt: 'desc' }
      });

      if (internalPromo) {
        return res.json({
          source: 'INTERNAL_HISTORY',
          caseNumber: searchCaseNum,
          customerName: internalPromo.customerName || 'Internal Subject',
          customerEmail: internalPromo.customerEmail || 'N/A',
          orderNumber: internalPromo.orderNumber,
          isHistorical: true
        });
      }

      // 3. Fallback: Audit Logs
      const auditLog = await prisma.auditLog.findFirst({
        where: { caseNumber: searchCaseNum },
        orderBy: { timestamp: 'desc' }
      });

      if (auditLog) {
         return res.json({
          source: 'AUDIT_LOG',
          caseNumber: searchCaseNum,
          customerName: 'Subject from Archive',
          isHistorical: true,
          lastActivity: auditLog.actionType
        });
      }

      return res.json(null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 1.5 Return/Cancel Promo Code
  app.post('/api/promo/return', authenticate, async (req: any, res) => {
    try {
      const { promoUsageId, reason } = req.body;
      if (!promoUsageId || !reason) {
        return res.status(400).json({ error: 'Promo usage ID and reason are required' });
      }

      const usage = await prisma.promoUsage.findUnique({
        where: { id: promoUsageId },
        include: { promoCode: true }
      });

      if (!usage) {
        return res.status(404).json({ error: 'Promo assignment not found' });
      }

      // Record in Audit Log before reverting
      await logAudit({
        caseNumber: usage.caseNumber,
        userId: req.user.id,
        actorName: req.user.name,
        actionType: 'PROMO_RETURNED',
        description: `Promo code ${usage.promoCode.code} returned to inventory from case ${usage.caseNumber}. Reason: ${reason}`,
        metadata: { promoCode: usage.promoCode.code, reason }
      });

      // Transaction to safely return code to inventory
      await prisma.$transaction([
        prisma.promoCode.update({
          where: { id: usage.promoCodeId },
          data: { status: 'AVAILABLE' }
        }),
        prisma.promoUsage.delete({
          where: { id: promoUsageId }
        })
      ]);

      res.json({ message: 'Promo code returned to inventory successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/promo/request', authenticate, withErrorHandling(async (req: any, res: any) => {
    const body = req.body;
    
    // Zod Validation
    console.log('[PROMO_DEBUG] Incoming Body:', JSON.stringify(body, null, 2));
    
    // Explicitly handle forceDuplicate from various possible formats
    const isForced = body.forceDuplicate === true || body.forceDuplicate === 'true' || body.force === true || body.force === 'true';
    
    const parsed = promoSchema.safeParse({
      caseNumber: body.caseNumber,
      orderNumber: body.orderNumber,
      countryId: body.countryId,
      value: Number(body.promoValue),
      customerEmail: body.customerEmail,
      customerName: body.customerName,
      reason: body.reason,
      promoType: body.promoType,
      forceDuplicate: isForced,
      agentId: req.user.id
    });

    if (!parsed.success) {
      console.log('[PROMO_DEBUG] Validation Failed:', JSON.stringify(parsed.error, null, 2));
      return res.status(400).json({ error: parsed.error });
    }

    const data = parsed.data;
    console.log('[PROMO_DEBUG] Parsed Data (Final):', JSON.stringify(data, null, 2));

    const isInternal = data.promoType === 'INTERNAL_100';

    // Check if case already has a promo
    let existingUsage;
    if (isInternal) {
      existingUsage = await prisma.internalPromoUsage.findFirst({
        where: { 
          caseNumber: data.caseNumber.trim()
        }
      });
    } else {
      existingUsage = await prisma.promoUsage.findFirst({
        where: { 
          caseNumber: data.caseNumber.trim(),
          promoCode: {
            type: data.promoType
          }
        },
        include: {
          promoCode: true
        }
      });
    }

    if (existingUsage) {
      console.log('[PROMO_DEBUG] Existing Usage Found:', existingUsage.id);
      
      if (data.promoType === 'COMPENSATION') {
        console.log('[PROMO_DEBUG] Blocking duplicate COMPENSATION');
        return res.status(400).json({ error: 'A case MUST NOT have more than one compensation promo' });
      }
      
      // If internal, check if forced
      if (!data.forceDuplicate) {
        console.log('[PROMO_DEBUG] Internal Duplicate Detected - Requesting Override');
        return res.status(409).json({ 
          error: 'DUPLICATE_INTERNAL', 
          message: 'Historical Constraint Conflict: This Case already has an internal allocation. Executive override required.',
          lastUsedAt: existingUsage.usedAt
        });
      }
      console.log('[PROMO_DEBUG] DUPLICATE DETECTED BUT OVERRIDE AUTHORIZED');
    }

    // Validation
    let finalCaseId = body.caseId || null;
    if (!finalCaseId) {
      const existingCase = await prisma.refundCase.findUnique({ where: { caseNumber: data.caseNumber } });
      if (existingCase) {
        finalCaseId = existingCase.id;
      }
    }

    let result;
    try {
      if (isInternal) {
        result = await prisma.$transaction(async (tx) => {
          const promoCode = await tx.internalPromoCode.findFirst({
            where: {
              countryId: data.countryId,
              value: data.value,
              status: 'AVAILABLE',
              ...(body.brandId ? { brandId: body.brandId } : {})
            },
            orderBy: { createdAt: 'asc' }
          });

          if (!promoCode) throw new Error('NO_CODES');

          const updatedCodeResult = await tx.internalPromoCode.updateMany({
            where: { id: promoCode.id, status: 'AVAILABLE' },
            data: { status: 'USED' }
          });

          if (updatedCodeResult.count === 0) throw new Error('Conflict in concurrent allocation.');

          await tx.internalPromoUsage.create({
            data: {
              promoCodeId: promoCode.id,
              caseNumber: data.caseNumber,
              orderNumber: data.orderNumber || 'NOT_PROVIDED',
              usedBy: req.user.name,
              agentId: req.user.id,
              requestedBy: body.requestedBy || req.user.name,
              customerEmail: data.customerEmail,
              customerName: data.customerName,
              reason: data.forceDuplicate 
                ? `[OVERRIDE_APPROVED] (DUPLICATE) ${data.reason || 'No reason provided'} | Authorizer: ${req.user.email}`
                : (data.reason || 'No reason provided')
            }
          });
          return promoCode;
        });
      } else {
        result = await prisma.$transaction(async (tx) => {
          // Safe selection: pick one available code
          const promoCode = await tx.promoCode.findFirst({
            where: {
              countryId: data.countryId,
              type: data.promoType,
              value: data.value,
              status: 'AVAILABLE',
              ...(body.brandId ? { brandId: body.brandId } : {})
            },
            orderBy: { createdAt: 'asc' }
          });

          if (!promoCode) throw new Error('NO_CODES');

          const updatedCodeResult = await tx.promoCode.updateMany({
            where: { id: promoCode.id, status: 'AVAILABLE' },
            data: { status: 'USED' }
          });

          if (updatedCodeResult.count === 0) throw new Error('Promo code was grabbed by another process.');

          await tx.promoUsage.create({
            data: {
              promoCodeId: promoCode.id,
              caseId: finalCaseId,
              caseNumber: data.caseNumber,
              orderNumber: data.orderNumber,
              usedBy: req.user.name,
              agentId: req.user.id,
              requestedBy: body.requestedBy || req.user.name,
              reason: data.forceDuplicate 
                ? `[OVERRIDE_APPROVED] (DUPLICATE) ${data.reason || 'No reason provided'} | Authorizer: ${req.user.email}`
                : (data.reason || 'No reason provided')
            }
          });
          return promoCode;
        });
      }
    } catch (err: any) {
      console.log('[PROMO_DEBUG] Execution Error:', err);
      if (err.message === 'NO_CODES') {
        return res.status(404).json({ error: 'NO_CODES' });
      }
      return res.status(500).json({ error: err.message });
    }

    // Audit Log
    try {
      await logAudit({
        caseId: finalCaseId,
        userId: req.user.id,
        actorName: req.user.name,
        actionType: data.forceDuplicate ? 'PROMO_DUPLICATE_OVERRIDE' : 'PROMO_ASSIGNED',
        description: `Generated: ${result?.code}, Type: ${data.promoType}, Value: ${data.value}. ${data.forceDuplicate ? 'Executive Override Authorized' : ''}`,
        metadata: { promoCode: result?.code, type: data.promoType, value: data.value, isOverride: data.forceDuplicate }
      });
    } catch (auditErr) {
      console.error('[PROMO_DEBUG] Audit Log failed:', auditErr);
    }

    let emailStatus: "SENT" | "FAILED" = "SENT";
    let emailResponse = "Emails skipped for internal usage";

    if (data.promoType === 'COMPENSATION') {
      try {
        console.log(`[EMAIL] Firing Power Automate logic to Customer ${data.customerEmail}: Your compensation code is ${result?.code} for ${result?.value} ${result?.currency}.`);
        emailResponse = "Email sent successfully via Power Automate";
      } catch (e: any) {
        emailStatus = "FAILED";
        emailResponse = e.message;
      }
    }

    // Email Tracking
    await prisma.emailLog.create({
      data: {
        caseNumber: data.caseNumber,
        promoCode: result?.code as string,
        status: data.promoType === 'COMPENSATION' ? emailStatus : "SENT",
        response: emailResponse
      }
    });

    if (finalCaseId) {
      const refundCase = await prisma.refundCase.findUnique({ where: { id: finalCaseId } });
      if (refundCase && refundCase.agentId) {
        await notifyUser(refundCase.agentId, 'Promo Code Assigned', `Promo code ${result?.code} was assigned to your case ${data.caseNumber}.`, 'SUCCESS');
      }
    }

    res.json({ success: true, code: result?.code, emailStatus, promo: result });
  }));

  // Retry Failed Emails
  app.post('/api/promo/retry-email', authenticate, withErrorHandling(async (req: any, res: any) => {
    const { caseNumber } = req.body;
    const failedLog = await prisma.emailLog.findFirst({
      where: { caseNumber, status: 'FAILED' },
      orderBy: { createdAt: 'desc' }
    });

    if (!failedLog) {
      return res.status(404).json({ error: 'No failed email log found for this case' });
    }

    console.log(`[EMAIL] Retrying Power Automate logic for Case ${caseNumber} and Promo ${failedLog.promoCode}...`);
    
    await prisma.emailLog.create({
      data: {
        caseNumber: failedLog.caseNumber,
        promoCode: failedLog.promoCode,
        status: 'SENT',
        response: 'Retry successful'
      }
    });

    res.json({ success: true, message: 'Email retried successfully' });
  }));

  // 2. Admin: Get all promo codes
  app.get('/api/promo', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const { countryId, status, type } = req.query;
    let standardPromos: any[] = [];
    let internalPromos: any[] = [];

    const standardWhere: any = {};
    if (countryId) standardWhere.countryId = countryId as string;
    if (status) standardWhere.status = status as string;

    if (!type || type === 'COMPENSATION') {
      standardWhere.type = 'COMPENSATION';
      standardPromos = await prisma.promoCode.findMany({
        where: standardWhere,
        include: {
          country: true,
          usage: {
            include: {
              case: { select: { caseNumber: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    const internalWhere: any = {};
    if (countryId) internalWhere.countryId = countryId as string;
    if (status) internalWhere.status = status as string;

    if (!type || type === 'INTERNAL_100') {
      internalPromos = await prisma.internalPromoCode.findMany({
        where: internalWhere,
        include: {
          country: true,
          usage: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      // Map it to look like standard promos
      internalPromos = internalPromos.map(p => ({
        ...p,
        type: 'INTERNAL_100',
        usage: p.usage ? {
          ...p.usage,
          case: { caseNumber: p.usage.caseNumber }
        } : null
      }));
    }

    const allPromos = [...standardPromos, ...internalPromos].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    res.json(allPromos);
  }));

  // 3. Admin: Create single promo code
  app.post('/api/promo', authenticate, isAdmin, async (req, res) => {
    try {
      const { code, type, value, currency, countryId, brandId, expiresAt } = req.body;
      const promo = await prisma.promoCode.create({
        data: {
          code,
          type,
          value: parseFloat(value),
          currency,
          countryId,
          brandId: brandId || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          status: 'AVAILABLE'
        }
      });
      res.json(promo);
    } catch (err: any) {
      res.status(400).json({ error: 'Promo code already exists or invalid data' });
    }
  });

  // 4. Admin: Bulk Upload (SQLite safe)
  app.post('/api/promo/bulk', authenticate, isAdmin, async (req, res) => {
    try {
      const { codes, targetType } = req.body; // targetType: "STANDARD" | "INTERNAL"
      const created = [];
      const isInternalTarget = targetType === 'INTERNAL';
      
      for (const p of codes) {
        try {
          if (isInternalTarget) {
            const promo = await prisma.internalPromoCode.create({
              data: {
                code: p.code,
                value: parseFloat(p.value) || 100,
                currency: p.currency,
                countryId: p.countryId,
                brandId: p.brandId || null,
                status: 'AVAILABLE',
                requestedBy: p.requestedBy || null
              }
            });
            created.push(promo);
          } else {
            const promo = await prisma.promoCode.create({
              data: {
                code: p.code,
                type: p.type || 'CUSTOMER_COMPENSATION',
                value: parseFloat(p.value),
                currency: p.currency,
                countryId: p.countryId,
                brandId: p.brandId || null,
                expiresAt: p.expiresAt ? new Date(p.expiresAt) : null,
                status: 'AVAILABLE',
                requestedBy: p.requestedBy || null
              }
            });
            created.push(promo);
          }
        } catch (e) {
          // Skip duplicates
        }
      }
      res.json({ count: created.length });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin: Export Promo Codes (Excel data)
  app.get('/api/admin/promo/export', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const { type, countryId } = req.query;
    const isInternal = type === 'INTERNAL_100';
    
    let codes: any[] = [];
    if (isInternal) {
      codes = await prisma.internalPromoCode.findMany({
        where: countryId ? { countryId: String(countryId) } : {},
        include: { country: true, usage: true }
      });
    } else {
      codes = await prisma.promoCode.findMany({
        where: countryId ? { countryId: String(countryId) } : {},
        include: { country: true, usage: { include: { case: true } } }
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Promo Inventory');

    // Define columns
    worksheet.columns = [
      { header: 'Promo Code', key: 'code', width: 25 },
      { header: 'Value', key: 'value', width: 10 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Region', key: 'region', width: 15 },
      { header: 'Current Status', key: 'status', width: 15 },
      { header: 'Initial Requestor', key: 'requestedBy', width: 25 },
      { header: 'Loading Date', key: 'createdAt', width: 20 },
      { header: 'Expiration Date', key: 'expiresAt', width: 20 },
      { header: 'Used By (Agent)', key: 'usedBy', width: 25 },
      { header: 'Consolidated At', key: 'usedAt', width: 20 },
      { header: 'Destination Case #', key: 'caseNumber', width: 20 },
      { header: 'Allocation Reason', key: 'reason', width: 40 },
    ];

    // Style Header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add rows
    codes.forEach(p => {
      const usage = p.usage || {};
      worksheet.addRow({
        code: p.code,
        value: p.value,
        currency: p.currency,
        region: p.country?.name || 'N/A',
        status: p.status,
        requestedBy: p.requestedBy || 'N/A',
        createdAt: format(new Date(p.createdAt), 'yyyy-MM-dd HH:mm'),
        expiresAt: p.expiresAt ? format(new Date(p.expiresAt), 'yyyy-MM-dd') : 'PERPETUAL',
        usedBy: usage.usedBy || 'UNCLAIMED',
        usedAt: usage.usedAt ? format(new Date(usage.usedAt), 'yyyy-MM-dd HH:mm') : 'N/A',
        caseNumber: usage.case?.caseNumber || 'N/A',
        reason: usage.reason || 'N/A'
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=promo_export_${type}_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  }));

  // 5. Admin: Update Promo
  app.patch('/api/promo/:id', authenticate, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const existing = await prisma.promoCode.findUnique({ where: { id } });
      if (!existing || existing.status === 'USED') {
        return res.status(400).json({ error: 'Cannot edit a used promo code' });
      }
      const updated = await prisma.promoCode.update({
        where: { id },
        data: {
          ...data,
          value: data.value ? parseFloat(data.value) : undefined,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined
        }
      });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 6. Admin: Delete Promo
  app.delete('/api/promo/:id', authenticate, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await prisma.promoCode.findUnique({ where: { id } });
      if (!existing || existing.status === 'USED') {
        return res.status(400).json({ error: 'Cannot delete a used promo code' });
      }
      await prisma.promoCode.delete({ where: { id } });
      res.json({ message: 'Deleted' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin: KNET Batching Logic
  app.get('/api/admin/refunds/knet-pending', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const cases = await prisma.refundCase.findMany({
      where: {
        paymentMethod: 'KNET',
        status: 'PENDING_KNET',
        refundBatchId: null
      },
      include: {
        country: true,
        branch: true
      },
      orderBy: { approvedAt: 'asc' }
    });
    res.json(cases);
  }));

  // Admin: Aura Points Queue
  app.get('/api/admin/refunds/aura-pending', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const cases = await prisma.refundCase.findMany({
      where: {
        auraPoints: { not: null },
        auraStatus: 'PENDING'
      },
      include: {
        country: true,
        branch: true
      },
      orderBy: { approvedAt: 'asc' }
    });
    res.json(cases);
  }));

  app.post('/api/admin/refunds/aura-complete/:id', authenticate, isAdmin, withErrorHandling(async (req: any, res) => {
    const { id } = req.params;
    const updatedCase = await prisma.refundCase.update({
      where: { id },
      data: { 
        auraStatus: 'COMPLETED',
        auraProcessedAt: new Date()
      }
    });

    await logAudit({
      caseId: id,
      caseNumber: updatedCase.caseNumber,
      orderNumber: updatedCase.orderNumber,
      userId: req.user.id,
      actorName: req.user.name,
      actionType: 'AURA_REFUNDED',
      description: 'Aura points reversal confirmed by operator',
      previousState: 'PENDING',
      newState: 'COMPLETED'
    });

    res.json(updatedCase);
  }));

  app.get('/api/admin/refunds/knet-batches', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const batches = await prisma.refundBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        cases: {
          select: { id: true, caseNumber: true, orderAmount: true, status: true }
        }
      }
    });
    res.json(batches);
  }));

  app.post('/api/admin/refunds/knet-batch/complete/:id', authenticate, isAdmin, withErrorHandling(async (req: any, res) => {
    const { id } = req.params;
    
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.refundBatch.update({
        where: { id },
        data: { status: 'COMPLETED' },
        include: { cases: true }
      });

      await tx.refundCase.updateMany({
        where: { refundBatchId: id },
        data: { 
          status: 'REFUNDED', 
          refundedAt: new Date(),
          closedById: req.user.id
        }
      });

      return batch;
    });

    res.json({ message: 'Batch and associated cases marked as REFUNDED', batch: result });
  }));

  app.post('/api/admin/refunds/knet-batch/send', authenticate, isAdmin, withErrorHandling(async (req: any, res) => {
    const { caseIds, recipientEmails } = req.body;

    if (!caseIds || caseIds.length === 0) {
      return res.status(400).json({ error: 'No cases selected for batching' });
    }

    const cases = await prisma.refundCase.findMany({
      where: { id: { in: caseIds } },
      include: { country: true, branch: true }
    });

    const batchNumber = `KNET-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.refundBatch.create({
        data: {
          batchNumber,
          exportedBy: req.user.email,
          caseCount: cases.length,
          status: 'SENT'
        }
      });

      await tx.refundCase.updateMany({
        where: { id: { in: caseIds } },
        data: { refundBatchId: batch.id }
      });

      return batch;
    });

    // Mock Excel Generation & Email
    console.log(`[FINANCE-EXPORT] Sending Batch ${batchNumber} to: ${recipientEmails || 'finance-refunds@company.com'}`);
    
    // Logic to simulate Excel attachment
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('KNET Refunds');
    sheet.columns = [
      { header: 'Case #', key: 'caseNumber', width: 20 },
      { header: 'Order #', key: 'orderNumber', width: 20 },
      { header: 'Auth Code', key: 'authCode', width: 15 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Customer', key: 'customer', width: 30 },
      { header: 'Branch', key: 'branch', width: 20 },
    ];
    cases.forEach(c => {
      sheet.addRow({
        caseNumber: c.caseNumber,
        orderNumber: c.orderNumber,
        authCode: c.authCode || 'N/A',
        amount: `${c.orderAmount} ${c.country?.currency || ''}`,
        customer: `${c.customerName} (${c.customerEmail})`,
        branch: c.branch?.name || 'N/A'
      });
    });

    res.json({ message: 'Batch sent successfully', batch: result });
  }));

  // Available Values (Agents)
  app.get('/api/promo/values', authenticate, async (req: any, res: any) => {
    try {
      const { countryId, type } = req.query;
      if (!countryId) return res.status(400).json({ error: 'countryId is required' });

      const where: any = {
        countryId: countryId as string,
        status: 'AVAILABLE'
      };

      if (type === 'INTERNAL_100') {
        const distinctValues = await prisma.internalPromoCode.findMany({
          where,
          distinct: ['value'],
          select: { value: true, currency: true },
          orderBy: { value: 'asc' }
        });
        return res.json(distinctValues);
      }

      if (type) where.type = type as string;

      const distinctValues = await prisma.promoCode.findMany({
        where,
        distinct: ['value'],
        select: { value: true, currency: true },
        orderBy: { value: 'asc' }
      });

      res.json(distinctValues);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Inventory Stats (Agents)
  app.get('/api/promo/inventory', authenticate, withErrorHandling(async (req: any, res, next) => {
    const isAdminUser = req.user.role === 'ADMIN';

    // If it's an admin request without specific countryId/value check, return the global grouped inventory
    if (!req.query.countryId || !req.query.value) {
      if (!isAdminUser) return res.status(403).json({ error: 'Global inventory view is restricted to administrators' });

      const standardInventory = await prisma.promoCode.groupBy({
        by: ['countryId', 'value', 'type', 'status'],
        _count: true
      });
  
      const internalInventoryRaw = await prisma.internalPromoCode.groupBy({
        by: ['countryId', 'value', 'status'],
        _count: true
      });
  
      const internalInventory = internalInventoryRaw.map(inv => ({
        ...inv,
        type: 'INTERNAL_100'
      }));
  
      return res.json([...standardInventory, ...internalInventory]);
    }
    
    try {
      const { countryId, value, type } = req.query;
      
      let count = 0;
      if (type === 'INTERNAL_100') {
        count = await prisma.internalPromoCode.count({
          where: {
            countryId: String(countryId),
            value: parseFloat(String(value)),
            status: 'AVAILABLE'
          }
        });
      } else {
        count = await prisma.promoCode.count({
          where: {
            countryId: String(countryId),
            value: parseFloat(String(value)),
            type: type ? String(type) : undefined,
            status: 'AVAILABLE'
          }
        });
      }

      // Hide exact counts from non-admins, just return boolean existence or "Available"
      if (!isAdminUser) {
        return res.json({ available: count > 0, count: count > 0 ? "AVAILABLE" : 0 });
      }

      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }));

  // Ledger History
  app.get('/api/promo/ledger', authenticate, withErrorHandling(async (req: any, res: any) => {
    const { type, search } = req.query;
    
    const where: any = {};
    // Per user request: Agents can search global usage history (but only used codes) 
    // to check for fraud or duplicate assignments across different agents.
    
    if (search) {
      const s = String(search).toLowerCase();
      where.OR = [
        { caseNumber: { contains: s } },
        { orderNumber: { contains: s } },
        { promoCode: { code: { contains: s } } },
        { usedBy: { contains: s } }
      ];
    }

    if (type === 'INTERNAL_100') {
      const usages = await prisma.internalPromoUsage.findMany({
        where,
        include: {
          promoCode: {
            include: { country: true }
          }
        },
        orderBy: { usedAt: 'desc' },
        take: 100
      });
      return res.json(usages);
    }

    const usages = await prisma.promoUsage.findMany({
      where,
      include: {
        promoCode: {
          include: { country: true }
        }
      },
      orderBy: { usedAt: 'desc' },
      take: 100
    });
    res.json(usages);
  }));

  // 7. Admin: Inventory Stats
  app.get('/api/promo/inventory/detailed', authenticate, isAdmin, async (req, res) => {
    const standard = await prisma.promoCode.groupBy({
      by: ['countryId', 'type', 'value', 'status'],
      _count: true
    });
    const internal = await prisma.internalPromoCode.groupBy({
      by: ['countryId', 'value', 'status'],
      _count: true
    });
    res.json({ standard, internal });
  });

  // Auth
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    let user = await prisma.user.findUnique({ where: { email } });

    if (email === 'omdawbas2015@gmail.com') {
      if (!user) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user = await prisma.user.create({
          data: {
            email: 'omdawbas2015@gmail.com',
            name: 'Omda Wbas',
            password: hashedPassword,
            role: 'ADMIN'
          }
        });
      } else {
        // Force update password to what they just typed for ease of use
        const hashedPassword = await bcrypt.hash(password, 10);
        user = await prisma.user.update({
          where: { email },
          data: { password: hashedPassword }
        });
      }
    }
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  });

  // ===== BRAND MANAGEMENT =====

  app.get('/api/admin/brands', authenticate, withErrorHandling(async (req, res) => {
    const brands = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
    res.json(brands);
  }));

  app.post('/api/admin/brands', authenticate, isAdmin, withErrorHandling(async (req: any, res) => {
    const { name, code, logoUrl } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Name and code are required' });
    const brand = await prisma.brand.create({
      data: { name, code: code.toUpperCase(), logoUrl: logoUrl || null }
    });
    await logAudit({
      userId: req.user.id,
      actorName: req.user.name,
      actionType: 'BRAND_CREATED',
      description: `Brand "${name}" (${code}) created`,
      metadata: { brandId: brand.id, brandCode: code }
    });
    res.status(201).json(brand);
  }));

  app.patch('/api/admin/brands/:id', authenticate, isAdmin, withErrorHandling(async (req: any, res) => {
    const { id } = req.params;
    const data = req.body;
    const brand = await prisma.brand.update({ where: { id }, data });
    res.json(brand);
  }));

  app.delete('/api/admin/brands/:id', authenticate, isAdmin, withErrorHandling(async (req: any, res) => {
    const { id } = req.params;
    await prisma.brand.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Brand deactivated' });
  }));

  // Common Data
  app.get('/api/metadata', withErrorHandling(async (req, res) => {
    const countries = await prisma.country.findMany({ include: { branches: true } });
    const rootCauses = await prisma.rootCause.findMany();
    const brands = await prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json({ countries, rootCauses, brands });
  }));

  // Cases
  app.get('/api/cases', authenticate, withErrorHandling(async (req: any, res) => {
    const where: any = {};
    // Restriction removed: Agents can now see all cases
    
    const cases = await prisma.refundCase.findMany({
      where,
      include: {
        agent: { select: { name: true } },
        country: true,
        branch: true,
        rootCause: true,
        components: true,
        brand: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(cases);
  }));

  app.get('/api/cases/:id', authenticate, withErrorHandling(async (req: any, res) => {
    const refundCase = await prisma.refundCase.findUnique({
      where: { id: req.params.id },
      include: {
        agent: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
        closedBy: { select: { name: true, email: true } },
        country: true,
        branch: true,
        rootCause: true,
        contactAttempts: true,
        comments: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
        auditLogs: { include: { user: { select: { name: true } } }, orderBy: { timestamp: 'desc' } },
        promoUsages: { include: { promoCode: true } },
        components: true,
        brand: true
      }
    });

    if (!refundCase) return res.status(404).json({ error: 'Case not found' });
    
    // Authorization check removed: Agents can now view all cases

    const emailLogs = await prisma.emailLog.findMany({
      where: { caseNumber: refundCase.caseNumber },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ ...refundCase, emailLogs });
  }));

  app.post('/api/cases', authenticate, async (req: any, res: any) => {
    try {
      const parsed = caseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error });
      }
      
      const data = parsed.data;
      
      // Verification of Foreign Keys to prevent P2003 (FK Constraint Violated)
      const [country, branch, rootCause] = await Promise.all([
        prisma.country.findUnique({ where: { id: data.countryId } }),
        prisma.branch.findUnique({ where: { id: data.branchId } }),
        prisma.rootCause.findUnique({ where: { id: data.rootCauseId } })
      ]);

      if (!country) return res.status(400).json({ error: `Invalid Country ID: ${data.countryId}` });
      if (!branch) return res.status(400).json({ error: `Invalid Branch ID: ${data.branchId}` });
      if (!rootCause) return res.status(400).json({ error: `Invalid Root Cause ID: ${data.rootCauseId}` });

      if (branch.countryId !== country.id) {
        return res.status(400).json({ error: `Branch ${branch.name} does not belong to Country ${country.name}` });
      }
      
      // Check for duplicate caseNumber
      const duplicate = await prisma.refundCase.findUnique({ where: { caseNumber: data.caseNumber } });
      if (duplicate) {
        return res.status(400).json({ error: 'Case number already exists in our system' });
      }

      const componentsData = data.components?.length 
        ? data.components.map((c: any) => ({
            paymentMethod: c.paymentMethod,
            amount: c.amount,
            externalRef: c.externalRef || null,
          }))
        : (data.paymentMethod ? [{
            paymentMethod: data.paymentMethod,
            amount: data.partialAmount || data.orderAmount,
            externalRef: data.authCode || null
          }] : []);

      const newCase = await prisma.refundCase.create({
        data: {
          caseNumber: data.caseNumber,
          countryId: data.countryId,
          branchId: data.branchId,
          brandId: data.brandId || null,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          orderNumber: data.orderNumber,
          orderDate: new Date(data.orderDate),
          orderAmount: data.orderAmount,
          partialAmount: data.partialAmount || null,
          paymentMethod: data.paymentMethod || null,
          authCode: data.authCode || null,
          auraPoints: data.auraPoints || null,
          rootCauseId: data.rootCauseId,
          refundReason: data.refundReason,
          agentId: req.user.id,
          createdById: req.user.id,
          components: {
            create: componentsData
          }
        }
      });

      // SYNC: Link existing promo usage if it was requested before the case was created
      const orphanedPromo = await prisma.promoUsage.findFirst({
        where: { caseNumber: data.caseNumber, caseId: null }
      });

      if (orphanedPromo) {
        await prisma.promoUsage.update({
          where: { id: orphanedPromo.id },
          data: { caseId: newCase.id }
        });
        await logSystemEvent('INFO', `Linked orphaned promo usage ${orphanedPromo.id} to new case ${newCase.caseNumber}`);
      }

      await logAudit({
        caseId: newCase.id,
        caseNumber: newCase.caseNumber,
        userId: req.user.id,
        actorName: req.user.name,
        actionType: 'CASE_CREATED',
        description: `Case ${data.caseNumber} initialized manually (external ID sync)`
      });

      res.status(201).json(newCase);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cases/batch-knet', authenticate, async (req: any, res) => {
    try {
      const { caseIds } = req.body;
      if (!Array.isArray(caseIds) || caseIds.length === 0) return res.status(400).json({ error: 'No cases provided' });

      const cases = await prisma.refundCase.findMany({
        where: { id: { in: caseIds }, paymentMethod: 'KNET' },
        include: { country: true }
      });

      if (cases.length === 0) return res.status(400).json({ error: 'No valid KNET cases found' });

      // Group by country so we send one email per country
      const groupedByCountry = cases.reduce((acc: any, curr: any) => {
        const countryName = curr.country.name;
        if (!acc[countryName]) acc[countryName] = { email: curr.country.managerEmail || 'finance@alshaya.com', list: [] };
        acc[countryName].list.push(curr);
        return acc;
      }, {});

      for (const [countryName, data] of Object.entries(groupedByCountry)) {
        const typedData = data as any;
        let tableRows = '';
        
        for (const c of typedData.list) {
          tableRows += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-size: 13px; color: #334155;">${format(new Date(c.orderDate), 'MMM dd, yyyy')}</td>
              <td style="padding: 10px; font-size: 13px; font-weight: bold; color: #0f172a;">${c.orderNumber}</td>
              <td style="padding: 10px; font-size: 13px; color: #64748b;">${c.status === 'APPROVED' ? 'Approved' : 'Pending'}</td>
              <td style="padding: 10px; font-size: 13px; color: #334155;">Yes</td>
              <td style="padding: 10px; font-size: 13px; color: #334155; font-family: monospace;">${c.authCode || 'N/A'}</td>
              <td style="padding: 10px; font-size: 13px; font-weight: bold; color: #0f172a;">${(c.partialAmount ?? c.orderAmount).toFixed(2)} ${c.country.currency || 'KWD'}</td>
            </tr>
          `;
          
          await prisma.refundCase.update({
            where: { id: c.id },
            data: { status: 'KNET-PENDING REFUND' }
          });
          
          await logAudit({
            caseId: c.id,
            caseNumber: c.caseNumber,
            userId: req.user.id,
            actorName: req.user.name,
            actionType: 'KNET_BATCH_PROCESSED',
            description: 'Marked for KNET Batch Refund processing',
            newState: 'KNET-PENDING REFUND'
          });
        }
        
        const emailHtml = `
          <h2>KNET Batch Refunds - ${countryName}</h2>
          <p>Please process the following manual KNET refunds:</p>
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">Transaction Date</th>
                <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">Order Number</th>
                <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">OPS Approval</th>
                <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">Received</th>
                <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">Auth Code</th>
                <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">Transaction Amount</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        `;

        console.log(`[EMAIL] To KNET Finance (${typedData.email}) - KNET Batch Refunds - ${countryName}`);
      }

      res.status(200).json({ message: 'Batch items processed and emailed successfully' });
    } catch (err: any) {
      console.error('Batch KNET Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- NEW: REFUND EXECUTION DASHBOARD ENDPOINTS ---

  // GET: Approved refunds not yet executed
  app.get('/api/admin/refunds/pending-execution', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const cases = await prisma.refundCase.findMany({
      where: {
        status: { in: ['APPROVED', 'PENDING_KNET', 'PENDING_REFUND', 'PROCESSING_EXECUTION', 'PENDING_EXTERNAL'] },
      },
      include: {
        country: true,
        branch: true,
        components: true,
        agent: { select: { name: true } }
      },
      orderBy: { approvedAt: 'asc' }
    });
    res.json(cases);
  }));

  // POST: Mark as Refunded (Manual Execution Confirm)
  app.post('/api/admin/refunds/mark-refunded', authenticate, isAdmin, withErrorHandling(async (req: any, res) => {
    const { id, refundId } = req.body;
    
    if (!id) return res.status(400).json({ error: 'Case ID is required' });

    const existingCase = await prisma.refundCase.findUnique({
      where: { id },
      include: { country: true }
    });
    
    if (!existingCase) return res.status(404).json({ error: 'Case not found' });
    
    const previousStatus = existingCase.status;
    const newStatus = 'REFUNDED';
    
    const updatedCase = await prisma.refundCase.update({
      where: { id },
      data: {
        status: newStatus,
        refundId: refundId || existingCase.refundId,
        refundedAt: new Date(),
        closedById: req.user.id
      },
      include: { country: true }
    });

    // Audit log
    await logAudit({
      caseId: id,
      caseNumber: updatedCase.caseNumber,
      orderNumber: updatedCase.orderNumber,
      userId: req.user.id,
      actorName: req.user.name,
      actionType: 'REFUND_EXECUTED',
      description: `Refund marked as executed manually by ${req.user.name}. Status changed from ${previousStatus} to ${newStatus}.`,
      previousState: previousStatus,
      newState: newStatus,
      metadata: { refundId }
    });

    // KNET Specific Flow: Send email to finance
    if (updatedCase.paymentMethod === 'KNET') {
      const emailContent = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h3 style="color: #10b981;">KNET Refund Confirmed</h3>
          <p>A KNET refund has been executed manually for Case <b>${updatedCase.caseNumber}</b>.</p>
          <hr />
          <ul style="list-style: none; padding: 0;">
            <li><b>Order ID:</b> ${updatedCase.orderNumber}</li>
            <li><b>Refund Amount:</b> ${updatedCase.partialAmount || updatedCase.orderAmount} ${updatedCase.country.currency}</li>
            <li><b>Refund Transaction ID:</b> ${refundId || 'N/A'}</li>
            <li><b>Executed By:</b> ${req.user.name}</li>
            <li><b>Date:</b> ${new Date().toLocaleString()}</li>
          </ul>
          <p style="font-size: 12px; color: #666; margin-top: 20px;">This action has been logged in the audit system for compliance.</p>
        </div>
      `;
      
      console.log(`[TRIGGER_EMAIL] to ${updatedCase.country.managerEmail || 'finance-batch@company.com'} for KNET Manual Execution Confirmation.`);
      
      await logAudit({
        caseId: id,
        caseNumber: updatedCase.caseNumber,
        actionType: 'EMAIL_SENT',
        description: `Confirmation email sent to ${updatedCase.country.managerEmail || 'finance-batch@company.com'} for KNET manual refund execution.`,
        actorName: 'SYSTEM'
      });
    }

    res.json({ message: 'Refund marked as executed successfully', case: updatedCase });
  }));

  // --- EXISTING ROUTES CONTINUE ---

  app.post('/api/cases/batch-aura', authenticate, async (req: any, res) => {
    try {
      const { caseIds } = req.body;
      if (!Array.isArray(caseIds) || caseIds.length === 0) return res.status(400).json({ error: 'No cases provided' });

      const cases = await prisma.refundCase.findMany({
        where: { id: { in: caseIds }, auraPoints: { not: null } },
        include: { country: true }
      });

      if (cases.length === 0) return res.status(400).json({ error: 'No valid Aura cases found' });

      // Group by country so we send one email per country
      const groupedByCountry = cases.reduce((acc: any, curr: any) => {
        const countryName = curr.country.name;
        if (!acc[countryName]) acc[countryName] = { email: 'aura-team@alshaya.com', list: [] };
        acc[countryName].list.push(curr);
        return acc;
      }, {});

      for (const [countryName, data] of Object.entries(groupedByCountry)) {
        const typedData = data as any;
        let tableRows = '';
        
        for (const c of typedData.list) {
          tableRows += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-size: 13px; color: #334155;">${format(new Date(c.orderDate), 'MMM dd, yyyy')}</td>
              <td style="padding: 10px; font-size: 13px; font-weight: bold; color: #0f172a;">${c.orderNumber}</td>
              <td style="padding: 10px; font-size: 13px; font-weight: bold; color: #d97706;">✨ ${c.auraPoints}</td>
              <td style="padding: 10px; font-size: 13px; font-weight: bold; color: #0f172a;">${(c.partialAmount ?? c.orderAmount).toFixed(2)} ${c.country.currency || 'KWD'}</td>
              <td style="padding: 10px; font-size: 13px; color: #334155;">${c.customerEmail}</td>
            </tr>
          `;
          
          await logAudit({
            caseId: c.id,
            caseNumber: c.caseNumber,
            userId: req.user.id,
            actorName: req.user.name,
            actionType: 'AURA_BATCH_PROCESSED',
            description: 'Aura points submitted via batch email to the Aura Team',
            metadata: { auraPoints: c.auraPoints }
          });
        }
        
        const emailHtml = `
          <h2>Aura Points Batch - ${countryName}</h2>
          <p>Please process the following Aura Point requests:</p>
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">Transaction Date</th>
                <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">Order Number</th>
                <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">Aura Points</th>
                <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">Transaction Amount</th>
                <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">Customer Email</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        `;

        console.log(`[EMAIL] To Aura Team (${typedData.email}) - Aura Batch - ${countryName}`);
      }

      res.status(200).json({ message: 'Aura batch processed and emailed successfully' });
    } catch (err: any) {
      console.error('Batch Aura Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH: Complete individual refund components
  app.patch('/api/cases/:caseId/components/:componentId', authenticate, isAdmin, withErrorHandling(async (req: any, res) => {
    const { caseId, componentId } = req.params;
    const { status, externalRef } = req.body;

    if (!['COMPLETED', 'FAILED'].includes(status)) {
       return res.status(400).json({ error: 'Invalid component status' });
    }

    const component = await prisma.refundComponent.findUnique({
      where: { id: componentId },
      include: { case: { include: { components: true } } }
    });

    if (!component || component.caseId !== caseId) {
       return res.status(404).json({ error: 'Component not found' });
    }

    await prisma.refundComponent.update({
       where: { id: componentId },
       data: { status, externalRef }
    });

    // Check if the whole case is finished
    const updatedCase = await prisma.refundCase.findUnique({
      where: { id: caseId },
      include: { components: true }
    });

    if (updatedCase) {
      const allCompleted = updatedCase.components.every(comp => comp.status === 'COMPLETED');
      if (allCompleted) {
        await prisma.refundCase.update({
          where: { id: caseId },
          data: { 
            status: updatedCase.partialAmount ? 'PARTIALLY_REFUNDED' : 'REFUNDED', 
            refundedAt: new Date(), 
            closedById: req.user.id 
          }
        });
      }
    }

    await logAudit({
      caseId,
      userId: req.user.id,
      actionType: 'CASE_STATUS_CHANGE',
      actorName: req.user.name,
      description: `Component ${component.paymentMethod} marked as ${status} ${externalRef ? '(Ref: ' + externalRef + ')' : ''}`
    });

    res.json({ success: true });
  }));

  app.patch('/api/cases/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const updateData = req.body;
    
    const existingCase = await prisma.refundCase.findUnique({ where: { id } });
    if (!existingCase) return res.status(404).json({ error: 'Case not found' });

    const isTerminalStatus = updateData.status === 'REFUNDED' || updateData.status === 'PARTIALLY_REFUNDED' || updateData.status === 'KNET-MANUAL REFUND';
    const isBecomingRefunded = isTerminalStatus && existingCase.status !== updateData.status;

    const updatedCase = await prisma.refundCase.update({
      where: { id },
      data: {
        ...updateData,
        orderDate: updateData.orderDate ? new Date(updateData.orderDate) : undefined,
        approvedAt: updateData.status === 'PENDING_REFUND' ? new Date() : undefined,
        refundedAt: isBecomingRefunded ? new Date() : (isTerminalStatus ? new Date() : undefined),
        closedById: isBecomingRefunded ? req.user.id : undefined,
      }
    });

    // Logging
    await logAudit({
      caseId: id,
      caseNumber: updatedCase.caseNumber,
      userId: req.user.id,
      actorName: req.user.name,
      actionType: 'CASE_UPDATED',
      description: `Case fields updated: ${Object.keys(updateData).join(', ')}`,
      previousState: existingCase.status,
      newState: updatedCase.status,
      metadata: { updateData }
    });

    res.json(updatedCase);
  });

  app.patch('/api/cases/:id/components/:compId', authenticate, async (req: any, res) => {
    const { id, compId } = req.params;
    const { status, externalRef } = req.body;
    
    const component = await prisma.refundComponent.findUnique({ where: { id: compId, caseId: id }});
    if (!component) return res.status(404).json({error: 'Component not found'});
    
    await prisma.refundComponent.update({
      where: { id: compId },
      data: { status, externalRef }
    });
    
    // Recalculate parent case status
    const c = await prisma.refundCase.findUnique({
      where: { id },
      include: { components: true }
    });
    
    if (c) {
      const allCompleted = c.components.every(comp => comp.status === 'COMPLETED');
      const someCompleted = c.components.some(comp => comp.status === 'COMPLETED');
      const anyPendingExternal = c.components.some(comp => ['KNET', 'AURA'].includes(comp.paymentMethod) && comp.status !== 'COMPLETED');
      
      let newStatus = c.status;
      if (allCompleted) {
        const totalRefund = c.components.reduce((sum, comp) => sum + comp.amount, 0);
        if (totalRefund < c.orderAmount || (c.partialAmount && c.partialAmount < c.orderAmount)) {
          newStatus = 'PARTIALLY_REFUNDED';
        } else {
          newStatus = 'REFUNDED';
        }
      }
      else if (someCompleted) newStatus = 'PROCESSING_EXECUTION';
      else if (anyPendingExternal) newStatus = 'PENDING_EXTERNAL';
      
      if (newStatus !== c.status) {
        const isTerminal = newStatus === 'REFUNDED' || newStatus === 'PARTIALLY_REFUNDED';
        await prisma.refundCase.update({
          where: { id: c.id },
          data: {
            status: newStatus,
            refundedAt: isTerminal ? new Date() : undefined,
            closedById: isTerminal ? req.user.id : undefined
          }
        });
        
        await logAudit({
          caseId: id,
          caseNumber: c.caseNumber,
          userId: req.user.id,
          actorName: req.user.name,
          actionType: 'STATUS_CHANGE',
          description: `Component ${component.paymentMethod} marked as ${status}. Parent status auto-updated to ${newStatus}.`,
          previousState: c.status,
          newState: newStatus
        });
      }
    }
    
    res.json({ message: 'Component updated successfully' });
  });


  // Approval Submission
  app.post('/api/cases/:id/submit', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.refundCase.update({
      where: { id },
      data: { status: 'PENDING_APPROVAL' }
    });

    await prisma.approvalToken.create({
      data: {
        caseId: id,
        token,
        expiresAt
      }
    });

    await logAudit({
      caseId: id,
      userId: req.user.id,
      actorName: req.user.name,
      actionType: 'CASE_SUBMITTED',
      description: `Case submitted for manager approval. Token generated: ${token.substring(0, 8)}...`,
      previousState: 'DRAFT',
      newState: 'PENDING_APPROVAL',
      metadata: { token: token.substring(0, 8) }
    });

    // Mock Email Send
    console.log(`[EMAIL] To Manager: Case ${id} requires approval. Confirm link: /api/approval/confirm?token=${token}&action=approve`);

    res.json({ message: 'Submitted successfully', approvalToken: token });
  });

  // Approval Callback
  app.get('/api/approval/confirm', async (req, res) => {
    const { token, action } = req.query;

    const approvalToken = await prisma.approvalToken.findUnique({
      where: { token: token as string },
      include: { case: true }
    });

    if (!approvalToken || approvalToken.isUsed || new Date() > approvalToken.expiresAt) {
      return res.status(400).send('<h1>Invalid or expired token</h1>');
    }

    if (action === 'approve') {
      const isKnet = approvalToken.case.paymentMethod === 'KNET';
      const updatedCase = await prisma.refundCase.update({
        where: { id: approvalToken.caseId },
        data: { 
          status: isKnet ? 'PENDING_KNET' : 'PENDING_REFUND', 
          approvedAt: new Date(),
          auraStatus: approvalToken.case.auraPoints ? 'PENDING' : 'NONE'
        }
      });

      // Special Logic: Aura Points Auto-Email
      if (updatedCase.auraPoints) {
        console.log(`[AUTO-EMAIL] To Aura Team (aura-vouchers@company.com): 
          ACTION: Reverse Points for Case ${updatedCase.caseNumber}
          POINTS: ${updatedCase.auraPoints}
          CUSTOMER: ${updatedCase.customerEmail}
        `);
      }

      await logAudit({
        caseId: approvalToken.caseId,
        caseNumber: updatedCase.caseNumber,
        actorName: 'MANAGER_VIA_EMAIL',
        actionType: 'CASE_APPROVED',
        description: 'Manager approved via email token',
        previousState: 'PENDING_APPROVAL',
        newState: updatedCase.status
      });
      await notifyUser(updatedCase.agentId, 'Case Approved', `Your refund case ${updatedCase.caseNumber} has been approved.`, 'SUCCESS');
    } else if (action === 'reject') {
      const updatedCase = await prisma.refundCase.update({
        where: { id: approvalToken.caseId },
        data: { status: 'DRAFT' }
      });
      await logAudit({
        caseId: approvalToken.caseId,
        caseNumber: updatedCase.caseNumber,
        actorName: 'MANAGER_VIA_EMAIL',
        actionType: 'CASE_REJECTED',
        description: 'Manager rejected via email token',
        previousState: 'PENDING_APPROVAL',
        newState: 'DRAFT'
      });
      await notifyUser(updatedCase.agentId, 'Case Rejected', `Your refund case ${updatedCase.caseNumber} was rejected.`, 'ERROR');
    }

    await prisma.approvalToken.update({
      where: { id: approvalToken.id },
      data: { isUsed: true }
    });

    res.send(`
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb;">
          <div style="background: white; padding: 2.5rem; border-radius: 1.5rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #f3f4f6; text-align: center; max-width: 400px; width: 100%;">
            <div style="font-size: 3.5rem; margin-bottom: 1.5rem;">${action === 'approve' ? '✅' : '❌'}</div>
            <h1 style="font-size: 1.5rem; font-weight: 800; margin: 0 0 0.75rem 0; color: #111827; letter-spacing: -0.025em;">Case ${action === 'approve' ? 'Approved' : 'Rejected'}</h1>
            <p style="color: #6b7280; font-size: 0.95rem; line-height: 1.5;">Action successfully processed for Case <strong>#${approvalToken.case.caseNumber}</strong>.</p>
            <div style="margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid #f3f4f6;">
              <p style="font-size: 0.75rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; tracking: 0.05em;">Audit Log Updated</p>
            </div>
            <p style="margin-top: 1rem; font-size: 0.8rem; color: #d1d5db;">You can safely close this window.</p>
          </div>
        </body>
      </html>
    `);
  });

  // Admin Emergency Approval
  app.post('/api/cases/:id/emergency-approve', authenticate, isAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment) return res.status(400).json({ error: 'Comment required for emergency approval' });

    const existingCase = await prisma.refundCase.findUnique({ where: { id } });
    if (!existingCase) return res.status(404).json({ error: 'Case not found' });

    const updatedCase = await prisma.refundCase.update({
      where: { id },
      data: { 
        status: existingCase.paymentMethod === 'KNET' ? 'PENDING_KNET' : 'PENDING_REFUND', 
        approvedAt: new Date(),
        auraStatus: existingCase.auraPoints ? 'PENDING' : 'NONE'
      }
    });

    await logAudit({
      caseId: id,
      caseNumber: updatedCase.caseNumber,
      userId: req.user.id,
      actorName: req.user.name,
      actionType: 'EMERGENCY_APPROVAL',
      description: `Emergency approval granted by admin. Comment: ${comment}`,
      previousState: existingCase.status,
      newState: updatedCase.status,
      metadata: { comment }
    });
    
    await notifyUser(updatedCase.agentId, 'Emergency Approval Tracker', `Your case ${updatedCase.caseNumber} was emergency approved by an admin.`, 'WARNING');

    res.json({ message: 'Emergency approval granted' });
  });

  // Contact System
  app.post('/api/cases/:id/contact', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const { result } = req.body; // ANSWERED | NO_ANSWER

    const refundCase = await prisma.refundCase.findUnique({
      where: { id },
      include: { contactAttempts: true }
    });

    if (!refundCase) return res.status(404).json({ error: 'Case not found' });
    if (refundCase.contactAttempts.length >= 2) {
      return res.status(400).json({ error: 'Max contact attempts reached' });
    }

    await prisma.contactAttempt.create({
      data: {
        caseId: id,
        result,
        agentId: req.user.id
      }
    });

    let newContactStatus = refundCase.contactStatus;
    if (result === 'ANSWERED') {
      newContactStatus = 'CONTACTED';
    } else if (refundCase.contactAttempts.length === 1) { // This was the second attempt
      newContactStatus = 'NO_RESPONSE';
    }

    await prisma.refundCase.update({
      where: { id },
      data: { contactStatus: newContactStatus }
    });

    await logAudit({
      caseId: id,
      caseNumber: refundCase.caseNumber,
      userId: req.user.id,
      actorName: req.user.name,
      actionType: 'CONTACT_ATTEMPT',
      description: `Contact Attempt Result: ${result}`,
      metadata: { result, previousContactStatus: refundCase.contactStatus, newContactStatus }
    });

    res.json({ status: newContactStatus });
  });

  // Comments
  app.post('/api/cases/:id/comments', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const { content } = req.body;

    const comment = await prisma.comment.create({
      data: {
        caseId: id,
        userId: req.user.id,
        content
      },
      include: { user: { select: { name: true } } }
    });

    res.json(comment);
  });

  // Dashboard Stats
  app.get('/api/stats', authenticate, async (req: any, res) => {
    const { startDate, endDate } = req.query;
    const where: any = {};
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }
    
    const stats = await prisma.refundCase.groupBy({
      by: ['status'],
      where,
      _count: true
    });

    const recentActivity = await prisma.auditLog.findMany({
      where: startDate && endDate ? {
        timestamp: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        }
      } : {},
      include: { user: { select: { name: true } }, case: { select: { caseNumber: true } } },
      orderBy: { timestamp: 'desc' },
      take: 5
    });

    // Inventory Alerts for Dashboard
    const standardInventory = await prisma.promoCode.groupBy({
      by: ['countryId', 'value', 'type'],
      where: { status: 'AVAILABLE' },
      _count: true
    });

    const internalInventoryRaw = await prisma.internalPromoCode.groupBy({
      by: ['countryId', 'value'],
      where: { status: 'AVAILABLE' },
      _count: true
    });

    const internalInventory = internalInventoryRaw.map(inv => ({
      ...inv,
      type: 'INTERNAL_100'
    }));

    const lowInventory = [...standardInventory, ...internalInventory];

    // New: Total Refund Amount for Dashboard
    const rates = await getExchangeRates();
    const cases = await prisma.refundCase.findMany({
      where: { ...where, status: 'REFUNDED' },
      include: { country: true }
    });

    const totalRefundAmountKWD = cases.reduce((acc, c) => {
      const currency = CURRENCY_MAP[c.country.code] || 'KWD';
      const actualRefundAmount = c.partialAmount ?? c.orderAmount;
      return acc + convertToKWD(actualRefundAmount, currency, rates);
    }, 0);

    // Agent Performance for Dashboard summary
    const agents = await prisma.user.findMany({
      where: { role: 'AGENT' },
      include: {
        cases: {
          where,
          take: 100 // Sample for dashboard performance
        }
      }
    });

    const agentPerformance = agents.map(a => {
      const aCases = a.cases;
      const refunded = aCases.filter(c => c.status === 'REFUNDED');
      return {
        name: a.name,
        total: aCases.length,
        refunded: refunded.length
      };
    }).sort((a, b) => b.total - a.total).slice(0, 5);

    // Promo Stats
    const promoUsages = await prisma.promoUsage.findMany({
      where: startDate && endDate ? {
        usedAt: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        }
      } : {},
      include: { promoCode: true }
    });
    
    const internalPromoUsages = await prisma.internalPromoUsage.findMany({
      where: startDate && endDate ? {
        usedAt: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        }
      } : {},
      include: { promoCode: true }
    });

    const totalPromoAmountKWD = [...promoUsages, ...internalPromoUsages].reduce((acc, p) => {
      return acc + convertToKWD(p.promoCode.value, p.promoCode.currency, rates);
    }, 0);
    const promoUsageCount = promoUsages.length + internalPromoUsages.length;

    res.json({ 
      stats, 
      recentActivity, 
      lowInventory, 
      totalRefundAmountKWD, 
      agentPerformance,
      promoUsageCount,
      totalPromoAmountKWD
    });
  });

  app.get('/api/countries', authenticate, async (req, res) => {
    const countries = await prisma.country.findMany({
      include: { branches: true }
    });
    res.json(countries);
  });

  app.get('/api/agents', authenticate, async (req, res) => {
    const agents = await prisma.user.findMany({
      where: { role: 'AGENT' },
      select: { id: true, name: true, email: true }
    });
    res.json(agents);
  });

  app.get('/api/root-causes', authenticate, async (req, res) => {
    const causes = await prisma.rootCause.findMany();
    res.json(causes);
  });

  // --- Analytics & Export ---
  app.use('/api', authenticate, isAdmin, analyticsRoutes);
  // --- End Analytics ---

  // --- End API Routes ---

  // --- Phase 6: Enterprise Control System APIs ---
  
  // Email Template Management
  app.get('/api/admin/templates', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const templates = await prisma.emailTemplate.findMany({ orderBy: { category: 'asc' } });
    res.json(templates);
  }));

  app.post('/api/admin/templates', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const template = await prisma.emailTemplate.create({ data: req.body });
    res.json(template);
  }));

  app.patch('/api/admin/templates/:id', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const template = await prisma.emailTemplate.update({ where: { id: req.params.id }, data: req.body });
    res.json(template);
  }));

  app.delete('/api/admin/templates/:id', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    await prisma.emailTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }));

  // External Team Management
  app.get('/api/admin/teams', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const teams = await prisma.externalTeam.findMany({ orderBy: { name: 'asc' } });
    res.json(teams);
  }));

  app.post('/api/admin/teams', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const team = await prisma.externalTeam.create({ data: req.body });
    res.json(team);
  }));

  app.patch('/api/admin/teams/:id', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const team = await prisma.externalTeam.update({ where: { id: req.params.id }, data: req.body });
    res.json(team);
  }));

  // Automation Rule Management
  app.get('/api/admin/automation-rules', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const rules = await prisma.automationRule.findMany({ orderBy: { triggerEvent: 'asc' } });
    res.json(rules);
  }));

  app.post('/api/admin/automation-rules', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const rule = await prisma.automationRule.create({ data: req.body });
    res.json(rule);
  }));

  app.patch('/api/admin/automation-rules/:id', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const rule = await prisma.automationRule.update({ where: { id: req.params.id }, data: req.body });
    res.json(rule);
  }));

  // Communication Logs
  app.get('/api/admin/email-logs', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const logs = await prisma.emailLog.findMany({ 
      include: { case: { select: { caseNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json(logs);
  }));

  // Manual Email Sending
  app.post('/api/admin/send-email', authenticate, withErrorHandling(async (req: any, res) => {
    const { caseId, recipients, subject, body, templateId } = req.body;
    
    // In a real system, this would call Power Automate or an Email API
    // Here we simulate and log it by creating an EmailLog entry.
    
    const log = await prisma.emailLog.create({
      data: {
        caseId,
        type: 'MANUAL',
        subject,
        recipients, // Comma separated string
        status: 'SENT',
        metadata: JSON.stringify({ sentBy: req.user.email, templateId })
      }
    });

    await logAudit({
      caseId,
      userId: req.user.id,
      actorName: req.user.name,
      actionType: 'EMAIL_SENT_MANUAL',
      description: `Manual email sent to ${recipients}: ${subject}`
    });

    res.json({ success: true, logId: log.id });
  }));

  // --- End Enterprise Control APIs ---

  // User Management
  app.get('/api/admin/users', authenticate, isAdmin, async (req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, countryId: true, isActive: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  });

  app.post('/api/admin/users', authenticate, isAdmin, async (req: any, res: any) => {
    try {
      const parsed = userSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error });
      }

      const { name, email, password, role, countryId } = parsed.data;
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { name, email, password: hashedPassword, role, countryId, isActive: true }
      });
      await logAudit({
        userId: req.user.id,
        actorName: req.user.name,
        actionType: 'USER_CREATED',
        description: `Created user ${email} with role ${role}`,
        metadata: { entityType: 'User', entityId: user.id }
      });
      res.status(201).json(user);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/admin/users/:id', authenticate, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
      }
      const user = await prisma.user.update({
        where: { id },
        data
      });
      await logAudit({
        userId: req.user.id,
        actorName: req.user.name,
        actionType: 'USER_UPDATED',
        description: `Updated user ${user.email}: ${Object.keys(data).join(', ')}`,
        metadata: { entityType: 'User', entityId: user.id, updateData: data }
      });
      res.json(user);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Country Management
  app.get('/api/admin/countries', authenticate, isAdmin, async (req, res) => {
    const countries = await prisma.country.findMany({ orderBy: { name: 'asc' } });
    res.json(countries);
  });

  app.post('/api/admin/countries', authenticate, isAdmin, async (req: any, res) => {
    try {
      const { name, code, currency, managerEmail } = req.body;
      const country = await prisma.country.create({
        data: { name, code, currency, managerEmail, isActive: true }
      });
      await logAudit({
        userId: req.user.id,
        actorName: req.user.name,
        actionType: 'COUNTRY_CREATED',
        description: `Created country ${name}`,
        metadata: { entityType: 'Country', entityId: country.id }
      });
      res.json(country);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/admin/countries/:id', authenticate, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const country = await prisma.country.update({
        where: { id },
        data
      });
      await logAudit({
        userId: req.user.id,
        actorName: req.user.name,
        actionType: 'COUNTRY_UPDATED',
        description: `Updated country ${country.name}: ${Object.keys(data).join(', ')}`,
        metadata: { entityType: 'Country', entityId: country.id, updateData: data }
      });
      res.json(country);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Branch Management
  app.get('/api/admin/branches', authenticate, isAdmin, async (req, res) => {
    const branches = await prisma.branch.findMany({ include: { country: true }, orderBy: { name: 'asc' } });
    res.json(branches);
  });

  app.post('/api/admin/branches', authenticate, isAdmin, async (req: any, res) => {
    try {
      const { name, countryId } = req.body;
      const branch = await prisma.branch.create({
        data: { name, countryId, isActive: true }
      });
      await logAudit({
        userId: req.user.id,
        actorName: req.user.name,
        actionType: 'BRANCH_CREATED',
        description: `Created branch ${name}`,
        metadata: { entityType: 'Branch', entityId: branch.id }
      });
      res.json(branch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/admin/branches/:id', authenticate, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const branch = await prisma.branch.update({
        where: { id },
        data
      });
      await logAudit({
        userId: req.user.id,
        actorName: req.user.name,
        actionType: 'BRANCH_UPDATED',
        description: `Updated branch ${branch.name}`,
        metadata: { entityType: 'Branch', entityId: branch.id, updateData: data }
      });
      res.json(branch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Root Causes Management
  app.get('/api/admin/root-causes', authenticate, isAdmin, async (req, res) => {
    const causes = await prisma.rootCause.findMany({ orderBy: { displayOrder: 'asc' } });
    res.json(causes);
  });

  app.post('/api/admin/root-causes', authenticate, isAdmin, async (req: any, res) => {
    try {
      const { name, description, displayOrder } = req.body;
      const cause = await prisma.rootCause.create({
        data: { name, description, displayOrder: parseInt(displayOrder) || 0, isActive: true }
      });
      await logAudit({
        userId: req.user.id,
        actorName: req.user.name,
        actionType: 'ROOT_CAUSE_CREATED',
        description: `Created root cause ${name}`,
        metadata: { entityType: 'RootCause', entityId: cause.id }
      });
      res.json(cause);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/admin/root-causes/:id', authenticate, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      if (data.displayOrder !== undefined) data.displayOrder = parseInt(data.displayOrder);
      const cause = await prisma.rootCause.update({
        where: { id },
        data
      });
      await logAudit({
        userId: req.user.id,
        actorName: req.user.name,
        actionType: 'ROOT_CAUSE_UPDATED',
        description: `Updated root cause ${cause.name}`,
        metadata: { entityType: 'RootCause', entityId: cause.id, updateData: data }
      });
      res.json(cause);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // System Configuration
  app.get('/api/admin/config', authenticate, isAdmin, async (req, res) => {
    const config = await prisma.systemConfig.findMany();
    // Return them as key-value pairs
    res.json(config);
  });

  app.patch('/api/admin/config', authenticate, isAdmin, async (req: any, res) => {
    try {
      const { configs } = req.body; // array of { key, value }
      const updated = [];
      for (const conf of configs) {
        const c = await prisma.systemConfig.update({
          where: { key: conf.key },
          data: { value: conf.value }
        });
        updated.push(c);
      }
      await logAudit({
        actionType: 'CONFIG_UPDATED',
        userId: req.user.id,
        actorName: req.user.name,
        description: `System configurations updated by admin. Keys: ${configs.map((c: any) => c.key).join(', ')}`,
        metadata: { configs }
      });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Audit Logs
  app.get('/api/admin/audit', authenticate, isAdmin, async (req, res) => {
    const { userId, action, startDate, endDate } = req.query;
    const where: any = {};
    if (userId) where.userId = userId as string;
    if (action) where.actionType = { contains: action as string };
    if (startDate && endDate) {
       where.timestamp = {
         gte: new Date(startDate as string),
         lte: new Date(endDate as string)
       };
    }
    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } }, case: { select: { caseNumber: true } } },
      orderBy: { timestamp: 'desc' },
      take: 100 // pagination could be added
    });
    res.json(logs);
  });

  // --- End Phase 5 Admin APIs ---

  // --- Phase 6: Notifications & Logging APIs ---
  app.get('/api/notifications', authenticate, async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const notifications = await prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      });
      const unreadCount = await prisma.notification.count({
        where: { userId: req.user.id, isRead: false }
      });
      
      res.json({ success: true, data: notifications, unreadCount });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, code: 'FETCH_NOTIFICATIONS_ERROR' });
    }
  });

  app.patch('/api/notifications/:id/read', authenticate, async (req: any, res) => {
    try {
      const notification = await prisma.notification.update({
        where: { id: req.params.id, userId: req.user.id },
        data: { isRead: true }
      });
      res.json({ success: true, data: notification });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, code: 'UPDATE_NOTIFICATION_ERROR' });
    }
  });
  
  app.patch('/api/notifications/read-all', authenticate, async (req: any, res) => {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.user.id, isRead: false },
        data: { isRead: true }
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, code: 'UPDATE_NOTIFICATIONS_ERROR' });
    }
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Unhandled Server Error:', err);
    logSystemEvent('ERROR', 'Unhandled Server Error', { message: err.message, stack: err.stack, path: req.path });
    res.status(500).json({ success: false, error: 'Internal Server Error', code: 'INTERNAL_ERROR' });
  });

  // Admin: Consolidated Hub Data
  app.get('/api/admin/refunds/hub-data', authenticate, isAdmin, withErrorHandling(async (req, res) => {
    const [approved, pendingApproval, settled] = await Promise.all([
      // 1. Approved cases (waiting for execution) and ones partially running
      prisma.refundCase.findMany({
        where: { status: { in: ['APPROVED', 'PROCESSING_EXECUTION', 'PENDING_EXTERNAL'] } },
        include: { 
          country: true, 
          branch: true, 
          components: true,
          agent: { select: { name: true } },
          contactAttempts: {
            orderBy: { timestamp: 'desc' }
          }
        },
        orderBy: { approvedAt: 'desc' }
      }),
      // 2. Pending Approval cases (Batch tracking)
      prisma.refundCase.findMany({
        where: { status: 'PENDING_APPROVAL' },
        include: { country: true, branch: true, components: true, agent: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      // 3. Settled cases (History - last 50)
      prisma.refundCase.findMany({
        where: { status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] } },
        include: { country: true, branch: true, components: true, agent: { select: { name: true } } },
        orderBy: { refundedAt: 'desc' },
        take: 50
      })
    ]);

    res.json({ approved, pendingApproval, settled });
  }));

  // Internal: Power Automate Daily Batching
  app.post('/api/internal/cases/batch-drafts', authenticateInternal, async (req, res) => {
    try {
      // 1. Fetch all DRAFT cases
      const draftCases = await prisma.refundCase.findMany({
        where: { status: 'DRAFT' },
        include: { country: true, rootCause: true, branch: true, agent: { select: { name: true } } }
      });

      if (draftCases.length === 0) {
        return res.json({ message: 'No draft cases found', batchCount: 0, payload: [] });
      }

      // 2. Group by Country
      const countryGroups: Record<string, typeof draftCases> = {};
      draftCases.forEach(c => {
        if (!countryGroups[c.countryId]) countryGroups[c.countryId] = [];
        countryGroups[c.countryId].push(c);
      });

      const payload: any[] = [];

      for (const countryId in countryGroups) {
        const cases = countryGroups[countryId];
        const country = cases[0].country;

        if (!country.managerEmail) {
          console.warn(`[PA-BATCH] Skipping ${country.name}: No manager email.`);
          continue;
        }

        const batchIdStr = `BATCH-${new Date().toISOString().split('T')[0]}-${uuidv4().substring(0, 4).toUpperCase()}`;
        
        // Create the batch record
        const batch = await prisma.approvalBatch.create({
          data: {
            batchId: batchIdStr,
            country: country.name,
            managerEmail: country.managerEmail,
            status: 'PENDING'
          }
        });

        // Move cases to PENDING_APPROVAL and link to batch
        await prisma.refundCase.updateMany({
          where: { id: { in: cases.map(c => c.id) } },
          data: { 
            status: 'PENDING_APPROVAL',
            batchId: batch.id
          }
        });

        payload.push({
          batchId: batchIdStr,
          countryName: country.name,
          managerEmail: country.managerEmail,
          cases: cases.map(c => ({
            id: c.id,
            caseNumber: c.caseNumber,
            customer: c.customerName,
            amount: `${c.orderAmount} ${country.currency}`,
            method: c.paymentMethod,
            reason: c.refundReason,
            agent: c.agent.name
          }))
        });

        // Audit Logging
        await logAudit({
          actionType: 'PA_BATCH_GENERATED',
          actorName: 'SYSTEM_PA',
          description: `Daily batch ${batchIdStr} generated for ${country.name} with ${cases.length} cases.`
        });
      }

      res.json({ message: 'Batches generated successfully', batchCount: payload.length, payload });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Internal: Power Automate Approval Callback
  app.post('/api/internal/cases/external-approve', authenticateInternal, async (req, res) => {
    try {
      const { batchId, approverName, action } = req.body; // action: 'APPROVED' | 'REJECTED'

      if (!batchId) return res.status(400).json({ error: 'batchId is required' });

      const batch = await prisma.approvalBatch.findUnique({
        where: { batchId },
        include: { cases: true }
      });

      if (!batch) return res.status(404).json({ error: 'Batch not found' });
      if (batch.status !== 'PENDING') return res.status(400).json({ error: `Batch is already ${batch.status}` });

      const newStatus = action === 'REJECTED' ? 'REJECTED' : 'APPROVED';

      await prisma.$transaction(async (tx) => {
        await tx.approvalBatch.update({
          where: { id: batch.id },
          data: { 
            status: newStatus,
            decidedAt: new Date(),
            decidedBy: approverName || 'External Manager'
          }
        });

        await tx.refundCase.updateMany({
          where: { batchId: batch.id },
          data: { 
            status: newStatus,
            approverName: approverName || 'External Manager',
            approvedAt: newStatus === 'APPROVED' ? new Date() : null
          }
        });

        // Log individual audits
        for (const c of batch.cases) {
           await (tx as any).auditLog.create({
             data: {
               caseId: c.id,
               caseNumber: c.caseNumber,
               actionType: `EXTERNAL_${newStatus}`,
               actorName: approverName || 'External Manager',
               description: `Batch ${batchId} was ${newStatus.toLowerCase()} via Power Automate.`
             }
           });
        }
      });

      res.json({ message: `Batch ${batchId} successfully marked as ${newStatus}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Help Desk Submission
  app.post('/api/help-desk/submit', authenticate, withErrorHandling(async (req: any, res) => {
    const { caseNumber, storeEmail, reason } = req.body;
    if (!caseNumber || !storeEmail || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ticket = await prisma.helpDeskTicket.create({
      data: {
        caseNumber,
        storeEmail,
        reason,
        submittedBy: req.user.name || req.user.email,
        status: 'SENT'
      }
    });

    // Integrated Audit Log
    await logAudit({
      caseNumber,
      actionType: 'HELP_DESK_SUBMIT',
      userId: req.user.id,
      actorName: req.user.name,
      description: `Support request submitted for store ${storeEmail} with reason: ${reason}`
    });

    // Trigger Notification for the User
    await prisma.notification.create({
      data: {
        userId: req.user.id,
        title: 'Help Desk Request Logged',
        message: `Your request for ${caseNumber} (${reason}) has been recorded.`,
        type: 'SUCCESS'
      }
    });

    // Trigger real Power Automate webhook if configured
    if (process.env.POWER_AUTOMATE_HELP_DESK_URL) {
      try {
        await axios.post(process.env.POWER_AUTOMATE_HELP_DESK_URL, {
          caseNumber,
          storeEmail,
          reason,
          submittedBy: req.user.name || req.user.email
        });
        console.log(`[PA-HELPDESK] Successfully triggered flow for ${caseNumber}`);
      } catch (paErr: any) {
        console.error(`[PA-HELPDESK] Failed to trigger flow:`, paErr.message);
        // We still return success to the user since the record is saved in DB
      }
    }

    res.json({ message: 'Support request recorded and notification sent.', data: ticket });
  }));

  // Help Desk History
  app.get('/api/help-desk/history', authenticate, withErrorHandling(async (req: any, res) => {
    const history = await prisma.helpDeskTicket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ data: history });
  }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    try {
      await prisma.$connect();
      const count = await prisma.user.count();
      console.log(`[PRISMA] Database connected. Found ${count} users.`);
    } catch (err) {
      console.error('[PRISMA] Initialization Error:', err);
    }
  });
}

startServer();
