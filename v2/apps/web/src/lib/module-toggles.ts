import { prisma } from '@wow/db';

/**
 * Stable list of toggleable modules. The key is what UI/sidebar checks
 * against; `defaultEnabled` is the value used until an admin saves a
 * different value into the DB.
 *
 * Adding a new entry here is the only way to expose a new toggle in
 * /admin/modules — the page lists exactly these definitions and merges
 * with whatever rows exist in `module_toggle`.
 */
export const MODULE_DEFINITIONS = [
  {
    key: 'promo',
    label: 'Promo codes',
    description: 'Allocation, pools, and promo-related fraud signals.',
    defaultEnabled: true,
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Reporting workspace under /reports (cases, refunds, SLA, audit, emails).',
    defaultEnabled: true,
  },
  {
    key: 'stores',
    label: 'Stores communication',
    description: 'Help desk for branch / store communications.',
    defaultEnabled: true,
  },
  {
    key: 'automation-rules',
    label: 'Automation rules',
    description: 'IF/THEN rules engine surfaces under /admin/automation-rules.',
    defaultEnabled: true,
  },
  {
    key: 'scheduled-reports',
    label: 'Scheduled reports',
    description: 'Cron-driven email summaries.',
    defaultEnabled: true,
  },
  {
    key: 'batch-schedules',
    label: 'Batch schedules',
    description: 'Approval / KNET / Aura batch schedule configuration.',
    defaultEnabled: true,
  },
  {
    key: 'fraud-signals',
    label: 'Fraud signals',
    description: 'Customer / agent / promo anomaly surfacing.',
    defaultEnabled: true,
  },
  {
    key: 'backup',
    label: 'Backup',
    description: 'Backup settings and manual-run history.',
    defaultEnabled: true,
  },
] as const;

export type ModuleKey = (typeof MODULE_DEFINITIONS)[number]['key'];

export type ModuleToggleStatus = {
  key: string;
  label: string;
  description: string | null;
  isEnabled: boolean;
  isDefault: boolean;
  updatedAt: Date | null;
};

/** Returns the merged status of every defined module. Stable order. */
export async function getModuleToggleStatuses(): Promise<ModuleToggleStatus[]> {
  const rows = await prisma.moduleToggle.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r] as const));
  return MODULE_DEFINITIONS.map((def) => {
    const row = byKey.get(def.key);
    return {
      key: def.key,
      label: row?.label ?? def.label,
      description: row?.description ?? def.description,
      isEnabled: row ? row.isEnabled : def.defaultEnabled,
      isDefault: !row,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

/** Cheap lookup for use inside a Server Component or middleware. */
export async function isModuleEnabled(key: ModuleKey): Promise<boolean> {
  const def = MODULE_DEFINITIONS.find((d) => d.key === key);
  if (!def) return false;
  const row = await prisma.moduleToggle.findUnique({ where: { key } });
  return row ? row.isEnabled : def.defaultEnabled;
}
