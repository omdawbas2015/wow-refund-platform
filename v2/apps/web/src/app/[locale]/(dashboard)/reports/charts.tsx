'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface DailyPoint {
  date: string;
  created: number;
  refunded: number;
}

/**
 * Stacked-area chart of daily case volume: created vs refunded.
 * Renders client-side; the parent RSC pre-aggregates the points.
 */
export function DailyVolumeChart({ data }: { data: DailyPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="created-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#635bff" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#635bff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="refunded-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(v: string) => v.slice(5)}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--border))' }}
            contentStyle={{
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="created"
            name="Created"
            stroke="#635bff"
            strokeWidth={2}
            fill="url(#created-gradient)"
          />
          <Area
            type="monotone"
            dataKey="refunded"
            name="Refunded"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#refunded-gradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface SliceData {
  name: string;
  value: number;
  color: string;
}

/**
 * Donut chart of case-status distribution.
 */
export function StatusDonut({ data }: { data: SliceData[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={56}
            outerRadius={88}
            paddingAngle={1}
            dataKey="value"
            nameKey="name"
            stroke="hsl(var(--background))"
            strokeWidth={2}
          >
            {data.map((slice, i) => (
              <Cell key={i} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            cursor={false}
            contentStyle={{
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number, n: string) => [
              `${v} (${total > 0 ? ((v / total) * 100).toFixed(1) : '0.0'}%)`,
              n,
            ]}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
