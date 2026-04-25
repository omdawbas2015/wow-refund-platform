import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';

const dbPath = path.resolve('dev.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const SQL = await initSqlJs();
const db = new SQL.Database();

db.run(`
PRAGMA foreign_keys = OFF;

CREATE TABLE User (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  countryId TEXT,
  isActive BOOLEAN NOT NULL DEFAULT 1,
  lastLoginAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Country (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'KWD',
  managerEmail TEXT,
  isActive BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE Branch (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  countryId TEXT NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT 1,
  UNIQUE(name, countryId)
);

CREATE TABLE RootCause (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  isActive BOOLEAN NOT NULL DEFAULT 1,
  displayOrder INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE RefundBatch (
  id TEXT PRIMARY KEY,
  batchNumber TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'SENT',
  exportedBy TEXT NOT NULL,
  caseCount INTEGER NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ApprovalBatch (
  id TEXT PRIMARY KEY,
  batchId TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  managerEmail TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decidedAt DATETIME,
  decidedBy TEXT
);

CREATE TABLE RefundCase (
  id TEXT PRIMARY KEY,
  caseNumber TEXT NOT NULL UNIQUE,
  agentId TEXT NOT NULL,
  createdById TEXT,
  closedById TEXT,
  orderDate DATETIME NOT NULL,
  orderNumber TEXT NOT NULL,
  orderAmount REAL NOT NULL,
  partialAmount REAL,
  paymentMethod TEXT,
  authCode TEXT,
  auraPoints TEXT,
  rootCauseId TEXT NOT NULL,
  refundReason TEXT NOT NULL,
  countryId TEXT NOT NULL,
  branchId TEXT NOT NULL,
  customerName TEXT NOT NULL,
  customerEmail TEXT NOT NULL,
  customerPhone TEXT NOT NULL,
  refundId TEXT,
  batchId TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  contactStatus TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
  auraStatus TEXT NOT NULL DEFAULT 'NONE',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approvedAt DATETIME,
  approverName TEXT,
  refundedAt DATETIME,
  auraProcessedAt DATETIME,
  refundBatchId TEXT
);

CREATE TABLE RefundComponent (
  id TEXT PRIMARY KEY,
  caseId TEXT NOT NULL,
  paymentMethod TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_EXECUTION',
  externalRef TEXT,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE PromoCode (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  value REAL NOT NULL,
  currency TEXT NOT NULL,
  countryId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  threshold INTEGER NOT NULL DEFAULT 5,
  expiresAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requestedBy TEXT
);

CREATE TABLE InternalPromoCode (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'INTERNAL_100',
  value REAL NOT NULL DEFAULT 100,
  currency TEXT NOT NULL,
  countryId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requestedBy TEXT
);

CREATE TABLE PromoUsage (
  id TEXT PRIMARY KEY,
  promoCodeId TEXT NOT NULL UNIQUE,
  caseId TEXT,
  caseNumber TEXT NOT NULL,
  orderNumber TEXT,
  usedBy TEXT NOT NULL,
  agentId TEXT,
  requestedBy TEXT,
  usedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT NOT NULL
);

CREATE TABLE InternalPromoUsage (
  id TEXT PRIMARY KEY,
  promoCodeId TEXT NOT NULL UNIQUE,
  caseNumber TEXT,
  orderNumber TEXT NOT NULL,
  customerName TEXT,
  customerEmail TEXT,
  usedBy TEXT NOT NULL,
  agentId TEXT,
  requestedBy TEXT,
  usedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT NOT NULL
);

CREATE TABLE EmailLog (
  id TEXT PRIMARY KEY,
  caseId TEXT,
  caseNumber TEXT,
  promoCode TEXT,
  type TEXT NOT NULL DEFAULT 'BATCH',
  subject TEXT,
  recipients TEXT,
  status TEXT NOT NULL,
  response TEXT,
  metadata TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE EmailTemplate (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ExternalTeam (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  emailGroup TEXT NOT NULL,
  slaHours INTEGER NOT NULL DEFAULT 48,
  escalationEmail TEXT,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE AutomationRule (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  triggerEvent TEXT NOT NULL,
  actionType TEXT NOT NULL,
  templateId TEXT,
  config TEXT,
  isActive BOOLEAN NOT NULL DEFAULT 1,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE RecipientGroup (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  emails TEXT NOT NULL,
  description TEXT
);

CREATE TABLE ApprovalToken (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  caseId TEXT,
  batchId TEXT UNIQUE,
  expiresAt DATETIME NOT NULL,
  isUsed BOOLEAN NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ContactAttempt (
  id TEXT PRIMARY KEY,
  caseId TEXT NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  result TEXT NOT NULL,
  agentId TEXT NOT NULL
);

CREATE TABLE AuditLog (
  id TEXT PRIMARY KEY,
  caseId TEXT,
  caseNumber TEXT,
  orderNumber TEXT,
  userId TEXT,
  actorName TEXT,
  entityType TEXT,
  entityId TEXT,
  actionType TEXT NOT NULL,
  description TEXT,
  previousState TEXT,
  newState TEXT,
  metadata TEXT,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Comment (
  id TEXT PRIMARY KEY,
  caseId TEXT NOT NULL,
  userId TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE SystemConfig (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Notification (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'INFO',
  isRead BOOLEAN NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE SystemLog (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  context TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE HelpDeskTicket (
  id TEXT PRIMARY KEY,
  caseNumber TEXT NOT NULL,
  storeEmail TEXT NOT NULL,
  reason TEXT NOT NULL,
  submittedBy TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SENT',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const id = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
const now = new Date().toISOString();
const password = await bcrypt.hash('admin123', 10);

const adminId = id('usr');
const agentId = id('usr');
const countryId = id('cty');
const branchId = id('br');
const rootCauseId = id('rc');
const caseId = id('case');
const caseId2 = id('case');
const caseId3 = id('case');

const insert = db.prepare('INSERT INTO User (id,email,password,name,role,countryId,isActive,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)');
insert.run([adminId, 'admin@alshaya.com', password, 'Alshaya Ops Admin', 'ADMIN', null, 1, now, now]);
insert.run([agentId, 'agent.ahmed@alshaya.com', password, 'Ahmed Mansour', 'AGENT', countryId, 1, now, now]);
insert.free();

db.run(`
INSERT INTO Country (id,name,code,currency,managerEmail,isActive) VALUES
('${countryId}','United Arab Emirates','AE','AED','uae.manager@alshaya.com',1);
INSERT INTO Branch (id,name,countryId,isActive) VALUES ('${branchId}','Dubai Mall','${countryId}',1);
INSERT INTO RootCause (id,name,description,isActive,displayOrder) VALUES ('${rootCauseId}','Payment captured after decline','Customer payment was captured despite decline state',1,1);
INSERT INTO SystemConfig (key,value,description) VALUES
('approvalBatchTime','12:00','Daily cron time for approval batches'),
('promoLowThreshold','10','Inventory threshold for low promo warning');
INSERT INTO EmailTemplate (id,name,category,subject,body,variables) VALUES
('${id('tpl')}','KNET Refund Request','KNET_REFUND','Refund request {{caseNumber}}','Please process refund for {{caseNumber}} / {{amount}}.','["caseNumber","amount"]');
INSERT INTO ExternalTeam (id,name,emailGroup,slaHours,escalationEmail) VALUES
('${id('team')}','KNET','knet-refunds@example.com',48,'knet-manager@example.com'),
('${id('team')}','AURA','aura-support@example.com',48,'aura-manager@example.com');
INSERT INTO AutomationRule (id,name,triggerEvent,actionType,config,isActive) VALUES
('${id('rule')}','Escalate delayed KNET refunds','DELAY','EMAIL','{"afterHours":48}',1);
`);

const caseSql = db.prepare(`
INSERT INTO RefundCase (
  id,caseNumber,agentId,createdById,orderDate,orderNumber,orderAmount,partialAmount,paymentMethod,
  authCode,auraPoints,rootCauseId,refundReason,countryId,branchId,customerName,customerEmail,customerPhone,
  status,contactStatus,auraStatus,createdAt,updatedAt,approvedAt,approverName
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

caseSql.run([caseId, 'REF-AE-2026-0001', agentId, adminId, now, 'ORD-784210', 122, null, 'CREDIT_CARD', '936118', null, rootCauseId, 'Captured payment after decline', countryId, branchId, 'Mohamed Hassan', 'mohamed@example.com', '+971501234567', 'APPROVED', 'CONTACTED', 'NONE', now, now, now, 'Ops Manager']);
caseSql.run([caseId2, 'REF-AE-2026-0002', agentId, adminId, now, 'ORD-784211', 245, null, 'KNET', '882100', null, rootCauseId, 'KNET settlement pending', countryId, branchId, 'Sarah Jenkins', 'sarah@example.com', '+971501234568', 'PENDING_EXTERNAL', 'NOT_CONTACTED', 'NONE', now, now, now, 'Ops Manager']);
caseSql.run([caseId3, 'REF-AE-2026-0003', agentId, adminId, now, 'ORD-784212', 90, null, 'AURA', null, '6000', rootCauseId, 'Aura points reversal required', countryId, branchId, 'Omar Al-Bakr', 'omar@example.com', '+971501234569', 'PROCESSING_EXECUTION', 'CONTACTED', 'PENDING', now, now, now, 'Ops Manager']);
caseSql.free();

const compSql = db.prepare('INSERT INTO RefundComponent (id,caseId,paymentMethod,amount,status,externalRef,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)');
compSql.run([id('cmp'), caseId, 'CREDIT_CARD', 80, 'COMPLETED', 'ARN-CC-00991', now, now]);
compSql.run([id('cmp'), caseId, 'AURA', 42, 'PENDING_EXECUTION', null, now, now]);
compSql.run([id('cmp'), caseId2, 'KNET', 245, 'PENDING_EXECUTION', null, now, now]);
compSql.run([id('cmp'), caseId3, 'AURA', 90, 'PENDING_EXECUTION', null, now, now]);
compSql.free();

db.run(`INSERT INTO AuditLog (id,caseId,caseNumber,userId,actorName,actionType,description,timestamp) VALUES
('${id('aud')}','${caseId}','REF-AE-2026-0001','${adminId}','Alshaya Ops Admin','CASE_CREATED','Demo case created for local trial','${now}'),
('${id('aud')}','${caseId2}','REF-AE-2026-0002','${adminId}','Alshaya Ops Admin','STATUS_CHANGE','Moved to external KNET execution','${now}');
INSERT INTO Notification (id,userId,title,message,type,isRead,createdAt) VALUES
('${id('not')}','${adminId}','Demo workspace ready','Local trial data has been prepared.','SUCCESS',0,'${now}');
`);

const data = db.export();
fs.writeFileSync(dbPath, Buffer.from(data));
db.close();

console.log(`Created local SQLite database at ${dbPath}`);
console.log('Login: admin@alshaya.com / admin123');
