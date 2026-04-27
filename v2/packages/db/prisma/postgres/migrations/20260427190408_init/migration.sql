-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_EXECUTION', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ComponentStatus" AS ENUM ('PENDING', 'AWAITING_BATCH', 'AWAITING_ARN', 'ARN_RECEIVED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuraStatus" AS ENUM ('NONE', 'PENDING', 'IN_BATCH', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('DRAFT', 'SENT', 'AWAITING_RESPONSE', 'PARTIALLY_DECIDED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KnetBatchStatus" AS ENUM ('DRAFT', 'SENT', 'AWAITING_ARNS', 'ARNS_RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PromoType" AS ENUM ('CUSTOMER_COMPENSATION', 'SERVICE_RECOVERY');

-- CreateEnum
CREATE TYPE "PromoStatus" AS ENUM ('AVAILABLE', 'ALLOCATED', 'USED', 'EXPIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CASE_ASSIGNED', 'CASE_APPROVED', 'CASE_REJECTED', 'CASE_NOTE_MENTION', 'ARN_RECEIVED', 'AURA_CONFIRMED', 'CUSTOMER_REPLY', 'STORE_REPLY', 'SLA_WARNING', 'SLA_BREACHED', 'FRAUD_SIGNAL', 'USER_PENDING_APPROVAL', 'SYSTEM');

-- CreateTable
CREATE TABLE "country_registry" (
    "code" TEXT NOT NULL,
    "codeAlpha3" TEXT NOT NULL,
    "numericCode" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "dialCode" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "continent" TEXT NOT NULL,

    CONSTRAINT "country_registry_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "currency_registry" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,

    CONSTRAINT "currency_registry_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "country" (
    "id" TEXT NOT NULL,
    "registryCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "managerEmail" TEXT,
    "cutoffTime" TEXT NOT NULL DEFAULT '17:00',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "code" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "logoUrl" TEXT,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_country" (
    "brandId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_country_pkey" PRIMARY KEY ("brandId","countryId")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "primaryCountryId" TEXT,
    "roleId" TEXT,
    "deputyUserId" TEXT,
    "outOfOfficeFrom" TIMESTAMP(3),
    "outOfOfficeUntil" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "preferredLocale" TEXT NOT NULL DEFAULT 'en',
    "preferredCurrency" TEXT,
    "preferredTheme" TEXT NOT NULL DEFAULT 'light',
    "mutedNotificationKinds" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_token" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'PASSWORD_RESET',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_token" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_method" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT,
    "iconSlug" TEXT,
    "iconUrl" TEXT,
    "color" TEXT,
    "requiresAuthCode" BOOLEAN NOT NULL DEFAULT false,
    "executionType" TEXT NOT NULL DEFAULT 'MANUAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "root_cause" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT,
    "category" TEXT,
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "root_cause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_case" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "externalCaseNumber" TEXT,
    "countryId" TEXT NOT NULL,
    "branchId" TEXT,
    "brandId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerNotes" TEXT,
    "orderNumber" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "orderAmount" DOUBLE PRECISION NOT NULL,
    "orderCurrency" TEXT NOT NULL,
    "totalRefundAmount" DOUBLE PRECISION NOT NULL,
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "auraPoints" INTEGER,
    "auraStatus" "AuraStatus" NOT NULL DEFAULT 'NONE',
    "auraBatchId" TEXT,
    "auraProcessedAt" TIMESTAMP(3),
    "auraProcessedById" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
    "rootCauseId" TEXT,
    "rootCauseNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "cancelledReason" TEXT,
    "slaDueAt" TIMESTAMP(3),
    "slaBreachedAt" TIMESTAMP(3),
    "customerNotifiedAt" TIMESTAMP(3),
    "approvalBatchId" TEXT,
    "customFields" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_component" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "authCode" TEXT,
    "last4" TEXT,
    "status" "ComponentStatus" NOT NULL DEFAULT 'PENDING',
    "arn" TEXT,
    "arnSuggestedAt" TIMESTAMP(3),
    "arnVerifiedAt" TIMESTAMP(3),
    "refundedById" TEXT,
    "refundedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "batchId" TEXT,
    "customerNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_note" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_note_mention" (
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_note_mention_pkey" PRIMARY KEY ("noteId","userId")
);

-- CreateTable
CREATE TABLE "approval_batch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "recipientEmails" TEXT NOT NULL,
    "powerAutomateRunId" TEXT,
    "magicLinkToken" TEXT,
    "responseReceivedAt" TIMESTAMP(3),
    "responseRawBody" TEXT,
    "responseParsed" TEXT,
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "approvedCases" INTEGER NOT NULL DEFAULT 0,
    "rejectedCases" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knet_batch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "status" "KnetBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "recipientEmails" TEXT NOT NULL,
    "powerAutomateRunId" TEXT,
    "responseReceivedAt" TIMESTAMP(3),
    "responseRawBody" TEXT,
    "responseParsedArns" TEXT,
    "totalComponents" INTEGER NOT NULL DEFAULT 0,
    "arnsReceived" INTEGER NOT NULL DEFAULT 0,
    "verifiedComponents" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knet_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aura_batch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "recipientEmails" TEXT NOT NULL,
    "powerAutomateRunId" TEXT,
    "responseReceivedAt" TIMESTAMP(3),
    "responseRawBody" TEXT,
    "responseParsed" TEXT,
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "completedCases" INTEGER NOT NULL DEFAULT 0,
    "caseSnapshot" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aura_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_config" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "type" "PromoType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_code" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "PromoStatus" NOT NULL DEFAULT 'AVAILABLE',
    "expiresAt" TIMESTAMP(3),
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_allocation" (
    "id" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "caseId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT,
    "emailedAt" TIMESTAMP(3),
    "powerAutomateRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_message_template" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_message_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_message_log" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "storeEmail" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "note" TEXT,
    "renderedSubject" TEXT NOT NULL,
    "renderedBody" TEXT NOT NULL,
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "powerAutomateRunId" TEXT,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "failureReason" TEXT,

    CONSTRAINT "store_message_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_template" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "placeholders" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_log" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "templateKey" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "cc" TEXT,
    "bcc" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "contextType" TEXT,
    "contextId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "powerAutomateRunId" TEXT,
    "sentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_email" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'INBOUND',
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "rawBody" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parseStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "parsedIntent" TEXT,
    "parsedPayload" TEXT,
    "parseError" TEXT,
    "parsedAt" TIMESTAMP(3),
    "linkedCaseId" TEXT,
    "linkedBatchId" TEXT,
    "linkedComponentId" TEXT,
    "powerAutomateRunId" TEXT,

    CONSTRAINT "inbound_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "contextType" TEXT,
    "contextId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "beforeData" TEXT,
    "afterData" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_view" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'exchangerate.host',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "feature_flag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "automation_rule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_rule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT,
    "brandId" TEXT,
    "rootCauseId" TEXT,
    "thresholdHours" INTEGER NOT NULL,
    "warningHours" INTEGER,
    "escalateToRole" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_schedule" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "countryId" TEXT,
    "cronExpr" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuwait',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_toggle" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "module_toggle_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "backup_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cronExpr" TEXT NOT NULL DEFAULT '0 2 * * *',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuwait',
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "destination" TEXT NOT NULL DEFAULT 'local',
    "destinationPath" TEXT,
    "notifyEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "backup_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_log" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "destination" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "triggeredById" TEXT,

    CONSTRAINT "backup_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_signal" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_report" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "cronExpr" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuwait',
    "scope" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'XLSX',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "country_registry_codeAlpha3_key" ON "country_registry"("codeAlpha3");

-- CreateIndex
CREATE INDEX "country_registry_currencyCode_idx" ON "country_registry"("currencyCode");

-- CreateIndex
CREATE INDEX "country_registry_continent_idx" ON "country_registry"("continent");

-- CreateIndex
CREATE UNIQUE INDEX "country_registryCode_key" ON "country"("registryCode");

-- CreateIndex
CREATE INDEX "country_isActive_idx" ON "country"("isActive");

-- CreateIndex
CREATE INDEX "branch_countryId_idx" ON "branch"("countryId");

-- CreateIndex
CREATE INDEX "branch_isActive_idx" ON "branch"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "branch_countryId_name_key" ON "branch"("countryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "brand_name_key" ON "brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "brand_slug_key" ON "brand"("slug");

-- CreateIndex
CREATE INDEX "brand_isActive_idx" ON "brand"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_status_idx" ON "user"("status");

-- CreateIndex
CREATE INDEX "user_roleId_idx" ON "user"("roleId");

-- CreateIndex
CREATE INDEX "user_primaryCountryId_idx" ON "user"("primaryCountryId");

-- CreateIndex
CREATE UNIQUE INDEX "role_key_key" ON "role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permission_key_key" ON "permission"("key");

-- CreateIndex
CREATE INDEX "permission_category_idx" ON "permission"("category");

-- CreateIndex
CREATE UNIQUE INDEX "session_sessionToken_key" ON "session"("sessionToken");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "otp_token_userId_idx" ON "otp_token"("userId");

-- CreateIndex
CREATE INDEX "otp_token_expiresAt_idx" ON "otp_token"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_token_tokenHash_key" ON "password_reset_token"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_token_userId_idx" ON "password_reset_token"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_method_key_key" ON "payment_method"("key");

-- CreateIndex
CREATE INDEX "payment_method_isActive_idx" ON "payment_method"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "root_cause_key_key" ON "root_cause"("key");

-- CreateIndex
CREATE INDEX "root_cause_isActive_idx" ON "root_cause"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "refund_case_caseNumber_key" ON "refund_case"("caseNumber");

-- CreateIndex
CREATE INDEX "refund_case_countryId_idx" ON "refund_case"("countryId");

-- CreateIndex
CREATE INDEX "refund_case_brandId_idx" ON "refund_case"("brandId");

-- CreateIndex
CREATE INDEX "refund_case_status_idx" ON "refund_case"("status");

-- CreateIndex
CREATE INDEX "refund_case_createdById_idx" ON "refund_case"("createdById");

-- CreateIndex
CREATE INDEX "refund_case_assignedToId_idx" ON "refund_case"("assignedToId");

-- CreateIndex
CREATE INDEX "refund_case_customerEmail_idx" ON "refund_case"("customerEmail");

-- CreateIndex
CREATE INDEX "refund_case_orderNumber_idx" ON "refund_case"("orderNumber");

-- CreateIndex
CREATE INDEX "refund_case_externalCaseNumber_idx" ON "refund_case"("externalCaseNumber");

-- CreateIndex
CREATE INDEX "refund_case_createdAt_idx" ON "refund_case"("createdAt");

-- CreateIndex
CREATE INDEX "refund_case_deletedAt_idx" ON "refund_case"("deletedAt");

-- CreateIndex
CREATE INDEX "refund_case_status_countryId_createdAt_idx" ON "refund_case"("status", "countryId", "createdAt");

-- CreateIndex
CREATE INDEX "refund_component_caseId_idx" ON "refund_component"("caseId");

-- CreateIndex
CREATE INDEX "refund_component_paymentMethodId_idx" ON "refund_component"("paymentMethodId");

-- CreateIndex
CREATE INDEX "refund_component_status_idx" ON "refund_component"("status");

-- CreateIndex
CREATE INDEX "refund_component_batchId_idx" ON "refund_component"("batchId");

-- CreateIndex
CREATE INDEX "case_note_caseId_idx" ON "case_note"("caseId");

-- CreateIndex
CREATE INDEX "case_note_authorId_idx" ON "case_note"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_batch_batchNumber_key" ON "approval_batch"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "approval_batch_magicLinkToken_key" ON "approval_batch"("magicLinkToken");

-- CreateIndex
CREATE INDEX "approval_batch_countryId_idx" ON "approval_batch"("countryId");

-- CreateIndex
CREATE INDEX "approval_batch_status_idx" ON "approval_batch"("status");

-- CreateIndex
CREATE INDEX "approval_batch_scheduledFor_idx" ON "approval_batch"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "knet_batch_batchNumber_key" ON "knet_batch"("batchNumber");

-- CreateIndex
CREATE INDEX "knet_batch_status_idx" ON "knet_batch"("status");

-- CreateIndex
CREATE INDEX "knet_batch_scheduledFor_idx" ON "knet_batch"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "aura_batch_batchNumber_key" ON "aura_batch"("batchNumber");

-- CreateIndex
CREATE INDEX "aura_batch_status_idx" ON "aura_batch"("status");

-- CreateIndex
CREATE INDEX "aura_batch_scheduledFor_idx" ON "aura_batch"("scheduledFor");

-- CreateIndex
CREATE INDEX "promo_config_brandId_idx" ON "promo_config"("brandId");

-- CreateIndex
CREATE INDEX "promo_config_countryId_idx" ON "promo_config"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "promo_config_brandId_countryId_type_value_key" ON "promo_config"("brandId", "countryId", "type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "promo_code_code_key" ON "promo_code"("code");

-- CreateIndex
CREATE INDEX "promo_code_configId_idx" ON "promo_code"("configId");

-- CreateIndex
CREATE INDEX "promo_code_status_idx" ON "promo_code"("status");

-- CreateIndex
CREATE INDEX "promo_code_status_configId_idx" ON "promo_code"("status", "configId");

-- CreateIndex
CREATE INDEX "promo_allocation_codeId_idx" ON "promo_allocation"("codeId");

-- CreateIndex
CREATE INDEX "promo_allocation_caseId_idx" ON "promo_allocation"("caseId");

-- CreateIndex
CREATE INDEX "promo_allocation_customerEmail_idx" ON "promo_allocation"("customerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "store_message_template_key_key" ON "store_message_template"("key");

-- CreateIndex
CREATE INDEX "store_message_template_isActive_idx" ON "store_message_template"("isActive");

-- CreateIndex
CREATE INDEX "store_message_log_sentById_idx" ON "store_message_log"("sentById");

-- CreateIndex
CREATE INDEX "store_message_log_sentAt_idx" ON "store_message_log"("sentAt");

-- CreateIndex
CREATE INDEX "store_message_log_caseNumber_idx" ON "store_message_log"("caseNumber");

-- CreateIndex
CREATE INDEX "email_template_category_idx" ON "email_template"("category");

-- CreateIndex
CREATE UNIQUE INDEX "email_template_key_locale_key" ON "email_template"("key", "locale");

-- CreateIndex
CREATE INDEX "email_log_contextType_contextId_idx" ON "email_log"("contextType", "contextId");

-- CreateIndex
CREATE INDEX "email_log_status_idx" ON "email_log"("status");

-- CreateIndex
CREATE INDEX "email_log_createdAt_idx" ON "email_log"("createdAt");

-- CreateIndex
CREATE INDEX "inbound_email_parseStatus_idx" ON "inbound_email"("parseStatus");

-- CreateIndex
CREATE INDEX "inbound_email_receivedAt_idx" ON "inbound_email"("receivedAt");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notification_createdAt_idx" ON "notification"("createdAt");

-- CreateIndex
CREATE INDEX "audit_log_actorId_idx" ON "audit_log"("actorId");

-- CreateIndex
CREATE INDEX "audit_log_entityType_entityId_idx" ON "audit_log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "activity_log_caseId_idx" ON "activity_log"("caseId");

-- CreateIndex
CREATE INDEX "activity_log_kind_idx" ON "activity_log"("kind");

-- CreateIndex
CREATE INDEX "activity_log_createdAt_idx" ON "activity_log"("createdAt");

-- CreateIndex
CREATE INDEX "saved_view_userId_scope_idx" ON "saved_view"("userId", "scope");

-- CreateIndex
CREATE INDEX "exchange_rate_fetchedAt_idx" ON "exchange_rate"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_fromCurrency_toCurrency_key" ON "exchange_rate"("fromCurrency", "toCurrency");

-- CreateIndex
CREATE INDEX "automation_rule_scope_isActive_idx" ON "automation_rule"("scope", "isActive");

-- CreateIndex
CREATE INDEX "batch_schedule_type_isActive_idx" ON "batch_schedule"("type", "isActive");

-- CreateIndex
CREATE INDEX "backup_log_status_idx" ON "backup_log"("status");

-- CreateIndex
CREATE INDEX "backup_log_startedAt_idx" ON "backup_log"("startedAt");

-- CreateIndex
CREATE INDEX "fraud_signal_kind_idx" ON "fraud_signal"("kind");

-- CreateIndex
CREATE INDEX "fraud_signal_subjectType_subjectId_idx" ON "fraud_signal"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "fraud_signal_createdAt_idx" ON "fraud_signal"("createdAt");

-- CreateIndex
CREATE INDEX "scheduled_report_isActive_idx" ON "scheduled_report"("isActive");

-- AddForeignKey
ALTER TABLE "country_registry" ADD CONSTRAINT "country_registry_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currency_registry"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "country" ADD CONSTRAINT "country_registryCode_fkey" FOREIGN KEY ("registryCode") REFERENCES "country_registry"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch" ADD CONSTRAINT "branch_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_country" ADD CONSTRAINT "brand_country_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_country" ADD CONSTRAINT "brand_country_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_deputyUserId_fkey" FOREIGN KEY ("deputyUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_token" ADD CONSTRAINT "otp_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_case" ADD CONSTRAINT "refund_case_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_case" ADD CONSTRAINT "refund_case_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_case" ADD CONSTRAINT "refund_case_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_case" ADD CONSTRAINT "refund_case_orderCurrency_fkey" FOREIGN KEY ("orderCurrency") REFERENCES "currency_registry"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_case" ADD CONSTRAINT "refund_case_auraBatchId_fkey" FOREIGN KEY ("auraBatchId") REFERENCES "aura_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_case" ADD CONSTRAINT "refund_case_rootCauseId_fkey" FOREIGN KEY ("rootCauseId") REFERENCES "root_cause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_case" ADD CONSTRAINT "refund_case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_case" ADD CONSTRAINT "refund_case_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_case" ADD CONSTRAINT "refund_case_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_case" ADD CONSTRAINT "refund_case_approvalBatchId_fkey" FOREIGN KEY ("approvalBatchId") REFERENCES "approval_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_component" ADD CONSTRAINT "refund_component_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "refund_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_component" ADD CONSTRAINT "refund_component_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_method"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_component" ADD CONSTRAINT "refund_component_refundedById_fkey" FOREIGN KEY ("refundedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_component" ADD CONSTRAINT "refund_component_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "knet_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_note" ADD CONSTRAINT "case_note_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "refund_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_note" ADD CONSTRAINT "case_note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_note_mention" ADD CONSTRAINT "case_note_mention_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "case_note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_note_mention" ADD CONSTRAINT "case_note_mention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_batch" ADD CONSTRAINT "approval_batch_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_batch" ADD CONSTRAINT "approval_batch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_config" ADD CONSTRAINT "promo_config_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_config" ADD CONSTRAINT "promo_config_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_configId_fkey" FOREIGN KEY ("configId") REFERENCES "promo_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_allocation" ADD CONSTRAINT "promo_allocation_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "promo_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_allocation" ADD CONSTRAINT "promo_allocation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "refund_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_allocation" ADD CONSTRAINT "promo_allocation_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_message_log" ADD CONSTRAINT "store_message_log_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "store_message_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_message_log" ADD CONSTRAINT "store_message_log_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "email_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "refund_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_view" ADD CONSTRAINT "saved_view_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rate" ADD CONSTRAINT "exchange_rate_fromCurrency_fkey" FOREIGN KEY ("fromCurrency") REFERENCES "currency_registry"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rate" ADD CONSTRAINT "exchange_rate_toCurrency_fkey" FOREIGN KEY ("toCurrency") REFERENCES "currency_registry"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
