import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { ChartMetricConfig, SportGroup } from '../hooks/useActivities';

const axisStyle = { fill: '#adaaaa', fontSize: 11, fontFamily: 'Lexend' };

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

// Derive a lighter tint of the group color for secondary lines
function lightenColor(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + 60);
  const g = Math.min(255, ((num >> 8) & 0xff) + 60);
  const b = Math.min(255, (num & 0xff) + 60);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

interface DynamicChartProps {
  group: Pick<SportGroup, 'id' | 'name' | 'icon' | 'color' | 'chartMetrics'>;
  data: Array<Record<string, number | string>>;
}

export const DynamicChart: React.FC<DynamicChartProps> = ({ group, data }) => {
  if (!data?.length) return null;

  const bars = group.chartMetrics.filter((m) => m.type === 'bar');
  const lines = group.chartMetrics.filter((m) => m.type === 'line');
  const hasRightAxis = lines.length > 0;

  const subtitleParts = [
    ...bars.map((m) => m.name),
    ...lines.map((m) => m.name),
  ];

  return (
    <div className="bg-surface-low rounded-xl p-4 lg:p-6">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: group.color }}>{group.icon}</span>
        <p className="font-display text-headline-md font-bold text-on-surface tracking-tight uppercase">{group.name}</p>
      </div>
      <p className="font-label text-label-sm text-on-surface-variant mb-6">
        {subtitleParts.join(' Y ')} POR SESIÓN
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
          <XAxis
            dataKey="date"
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            tickFormatter={(d) => typeof d === 'string' ? d.slice(5) : d}
            interval="preserveStartEnd"
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
