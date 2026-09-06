import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { TrendPoint } from '../../types/operations';

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Shared by the admin and vendor dashboards — same trend shape from the
 * backend (`{date, revenue, orders}[]`), so one chart component covers
 * both rather than two near-identical ones. */
export function TrendChart({ data, metric = 'revenue' }: { data: TrendPoint[]; metric?: 'revenue' | 'orders' }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3D4FE0" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#3D4FE0" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E4EC" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fontSize: 11, fill: '#5B6178' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11, fill: '#5B6178' }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          labelFormatter={(value) => formatShortDate(String(value))}
          formatter={(value) => {
            const numeric = typeof value === 'number' ? value : Number(value ?? 0);
            return [metric === 'revenue' ? `₹${numeric}` : numeric, metric === 'revenue' ? 'Revenue' : 'Orders'];
          }}
          contentStyle={{ borderRadius: 8, borderColor: '#E2E4EC', fontSize: 12 }}
        />
        <Area type="monotone" dataKey={metric} stroke="#3D4FE0" strokeWidth={2} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
