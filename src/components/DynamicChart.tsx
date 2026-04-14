import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { ChartMetricConfig, SportGroup } from '../hooks/useActivities';

type Period = 'daily' | 'weekly' | 'monthly' | 'total';

const axisStyle = { fill: '#adaaaa', fontSize: 11, fontFamily: 'Lexend' };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const AGG: Record<string, 'sum' | 'max' | 'avg'> = {
  distance: 'sum',
  duration: 'sum',
  calories: 'sum',
  avgHr:    'avg',
  maxSpeed: 'max',
};

function aggregateBucket(
  sessions: Array<Record<string, number | string>>,
  keys: string[],
  label: string,
): Record<string, number | string | any> {
  const result: Record<string, number | string | any> = { date: label };
  
  if (sessions.length > 0 && sessions[sessions.length - 1].id) {
    result.id = sessions[sessions.length - 1].id;
  }

  for (const key of keys) {
    const vals = sessions.map(s => Number(s[key] ?? 0)).filter(v => v > 0);
    if (!vals.length) { result[key] = 0; continue; }
    const type = AGG[key] ?? 'sum';
    if (type === 'avg') {
      result[key] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    } else if (type === 'max') {
      result[key] = Math.max(...vals);
    } else {
      // sum — preserve 1-decimal precision for distance
      const s = vals.reduce((a, b) => a + b, 0);
      result[key] = Math.round(s * 10) / 10;
    }
  }
  return result;
}

function getLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildTimeline(
  rawData: Array<Record<string, number | string>>,
  period: Period,
  keys: string[],
): Array<Record<string, number | string>> {
  const today = new Date();
  const todayStr = getLocalDateString(today);

  const dateOf = (s: Record<string, number | string>) => String(s.date).slice(0, 10);

  if (period === 'daily') {
    const sessions = rawData.filter(s => dateOf(s) === todayStr);
    return [aggregateBucket(sessions, keys, 'Today')];
  }

  if (period === 'weekly') {
    const result: Array<Record<string, number | string>> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = getLocalDateString(d);
      const label = i === 0 ? 'Today' : DAY_NAMES[d.getDay()];
      const sessions = rawData.filter(s => dateOf(s) === key);
      result.push(aggregateBucket(sessions, keys, label));
    }
    return result;
  }

  if (period === 'monthly') {
    // Last 30 days, one bucket per day
    const result: Array<Record<string, number | string>> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = getLocalDateString(d);
      const label = i === 0 ? 'Today' : `${d.getDate()}/${d.getMonth() + 1}`;
      const sessions = rawData.filter(s => dateOf(s) === key);
      result.push(aggregateBucket(sessions, keys, label));
    }
    return result;
  }

  // total → group by month
  const byMonth: Record<string, { label: string; sessions: Array<Record<string, number | string>> }> = {};
  for (const session of rawData) {
    const d = dateOf(session);
    const monthKey = d.slice(0, 7); // YYYY-MM
    if (!byMonth[monthKey]) {
      const dt = new Date(d + 'T12:00:00');
      byMonth[monthKey] = {
        label: `${MONTH_NAMES[dt.getMonth()]} ${d.slice(2, 4)}`,
        sessions: [],
      };
    }
    byMonth[monthKey].sessions.push(session);
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, { label, sessions }]) => aggregateBucket(sessions, keys, label));
}

const PERIOD_SUBTITLE: Record<Period, string> = {
  daily:   'TODAY',
  weekly:  'LAST 7 DAYS',
  monthly: 'LAST 4 WEEKS',
  total:   'MONTHLY HISTORY',
};

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-outline-variant/20">
      <p className="font-label text-label-sm text-on-surface-variant mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-body text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(0) : p.value}
        </p>
      ))}
    </div>
  );
};

function lightenColor(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + 60);
  const g = Math.min(255, ((num >> 8)  & 0xff) + 60);
  const b = Math.min(255, (num & 0xff) + 60);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

interface DynamicChartProps {
  group: Pick<SportGroup, 'id' | 'name' | 'icon' | 'color' | 'chartMetrics'>;
  data: Array<Record<string, number | string>>;
  period: Period;
  onBarClick?: (entry: Record<string, number | string>) => void;
}

export const DynamicChart: React.FC<DynamicChartProps> = ({ group, data, period, onBarClick }) => {
  if (!data?.length && period !== 'daily') return null;

  const keys = group.chartMetrics.map(m => m.dataKey);
  const timeline = buildTimeline(data, period, keys);

  // Don't render if all buckets are empty (except daily which always shows)
  if (period !== 'daily' && timeline.every(b => keys.every(k => Number(b[k]) === 0))) return null;

  const bars  = group.chartMetrics.filter(m => m.type === 'bar');
  const lines = group.chartMetrics.filter(m => m.type === 'line');
  const hasRightAxis = lines.length > 0;

  return (
    <div className="bg-surface-low rounded-xl p-4 lg:p-6">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: group.color }}>{group.icon}</span>
        <p className="font-display text-headline-md font-bold text-on-surface tracking-tight uppercase">{group.name}</p>
      </div>
      <p className="font-label text-label-sm text-on-surface-variant mb-6">
        {group.chartMetrics.map(m => m.name).join(' Y ')} — {PERIOD_SUBTITLE[period]}
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={timeline} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
          <XAxis
            dataKey="date"
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            interval={period === 'weekly' ? 0 : period === 'monthly' ? 6 : 'preserveStartEnd'}
          />
          <YAxis yAxisId="left" tick={axisStyle} axisLine={false} tickLine={false} />
          {hasRightAxis && (
            <YAxis yAxisId="right" orientation="right" tick={axisStyle} axisLine={false} tickLine={false} />
          )}
          <Tooltip content={<CustomTooltip />} />
          {bars.map((m: ChartMetricConfig) => (
            <Bar
              key={m.dataKey}
              yAxisId="left"
              dataKey={m.dataKey}
              name={m.name}
              fill={group.color}
              fillOpacity={0.7}
              radius={[3, 3, 0, 0]}
              cursor={onBarClick ? 'pointer' : undefined}
              onClick={onBarClick ? (entry: any) => onBarClick(entry?.payload || entry) : undefined}
            />
          ))}
          {lines.map((m: ChartMetricConfig) => (
            <Line
              key={m.dataKey}
              yAxisId={hasRightAxis ? 'right' : 'left'}
              type="monotone"
              dataKey={m.dataKey}
              name={m.name}
              stroke={lightenColor(group.color)}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
