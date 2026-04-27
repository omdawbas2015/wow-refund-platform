-- AlterTable
ALTER TABLE "aura_batch" ADD COLUMN "caseSnapshot" TEXT;

-- CreateTable
CREATE TABLE "module_toggle" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT
);

-- CreateTable
CREATE TABLE "backup_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cronExpr" TEXT NOT NULL DEFAULT '0 2 * * *',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuwait',
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "destination" TEXT NOT NULL DEFAULT 'local',
    "destinationPath" TEXT,
    "notifyEmail" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" DATETIME,
    "lastLoginAt" DATETIME,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "primaryCountryId" TEXT,
    "roleId" TEXT,
    "deputyUserId" TEXT,
    "outOfOfficeFrom" DATETIME,
    "outOfOfficeUntil" DATETIME,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "rejectedReason" TEXT,
    "preferredLocale" TEXT NOT NULL DEFAULT 'en',
    "preferredCurrency" TEXT,
    "preferredTheme" TEXT NOT NULL DEFAULT 'light',
    "mutedNotificationKinds" TEXT NOT NULL DEFAULT '',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "user_deputyUserId_fkey" FOREIGN KEY ("deputyUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "user_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_user" ("approvedAt", "approvedById", "avatarUrl", "createdAt", "deletedAt", "deputyUserId", "email", "emailVerified", "failedLoginAttempts", "id", "lastLoginAt", "lockedUntil", "mustChangePassword", "name", "nameAr", "outOfOfficeFrom", "outOfOfficeUntil", "passwordChangedAt", "passwordHash", "phone", "preferredCurrency", "preferredLocale", "preferredTheme", "primaryCountryId", "rejectedReason", "roleId", "status", "updatedAt") SELECT "approvedAt", "approvedById", "avatarUrl", "createdAt", "deletedAt", "deputyUserId", "email", "emailVerified", "failedLoginAttempts", "id", "lastLoginAt", "lockedUntil", "mustChangePassword", "name", "nameAr", "outOfOfficeFrom", "outOfOfficeUntil", "passwordChangedAt", "passwordHash", "phone", "preferredCurrency", "preferredLocale", "preferredTheme", "primaryCountryId", "rejectedReason", "roleId", "status", "updatedAt" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE INDEX "user_status_idx" ON "user"("status");
CREATE INDEX "user_roleId_idx" ON "user"("roleId");
CREATE INDEX "user_primaryCountryId_idx" ON "user"("primaryCountryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "promo_code_status_configId_idx" ON "promo_code"("status", "configId");

-- CreateIndex
CREATE INDEX "refund_case_status_countryId_createdAt_idx" ON "refund_case"("status", "countryId", "createdAt");
