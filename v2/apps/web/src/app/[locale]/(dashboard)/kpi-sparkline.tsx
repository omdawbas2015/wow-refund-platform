'use client';

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from 'recharts';

export type SparkPoint = { date: string; value: number };

const TINTS: Record<string, { stroke: string; fill: string }> = {
  primary: { stroke: '#635bff', fill: 'rgba(99, 91, 255, 0.16)' },
  warning: { stroke: '#d97706', fill: 'rgba(217, 119, 6, 0.16)' },
  success: { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.16)' },
  destructive: { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.18)' },
};

/**
 * Tiny inline sparkline for KPI cards. Hides axes/grid; shows a single
 * value tooltip on hover. Falls back to nothing when there's no data so
 * the card stays clean.
 */
export function KpiSparkline({
  data,
  tint = 'primary',
  unitLabel,
}: {
  data: SparkPoint[];
  tint?: 'primary' | 'warning' | 'success' | 'destructive';
  unitLabel?: string;
}) {
  if (!data || data.length === 0) {
    return <div className="mt-3 h-9" aria-hidden="true" />;
  }
  const colors = TINTS[tint] ?? TINTS['primary']!;
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <div className="mt-3 h-9 w-full" aria-hidden={max === 0 ? true : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${tint}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={colors.stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, max === 0 ? 1 : 'dataMax']} />
          <Tooltip
            cursor={false}
            contentStyle={{
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              fontSize: 11,
              padding: '4px 8px',
            }}
            formatter={(value: number) => [
              `${value}${unitLabel ? ` ${unitLabel}` : ''}`,
              '',
            ]}
            labelFormatter={(label: string) => label}
            separator=""
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={colors.stroke}
            strokeWidth={1.5}
            fill={`url(#spark-${tint})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
