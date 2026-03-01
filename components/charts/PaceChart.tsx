"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { PaceSample } from "@/types/fitness";
import { formatPace } from "@/lib/mock-data";

interface PaceChartProps {
  samples: PaceSample[];
  avgPace: number;
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PaceSample; value: number; name: string }[];
}) => {
  if (!active || !payload?.length) return null;
  const km = payload[0]?.payload?.km;
  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-lg px-3 py-2 text-xs space-y-1">
      <p className="text-gray-400 font-medium">Km {km}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-white">
          {p.name === "pace"
            ? `Pace: ${formatPace(p.value)}/km`
            : `Elevation: ${p.value}m`}
        </p>
      ))}
    </div>
  );
};

export function PaceChart({ samples, avgPace }: PaceChartProps) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={samples} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="km"
            tickFormatter={(v) => `${v}km`}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            yAxisId="pace"
            orientation="left"
            tickFormatter={(v) => formatPace(v)}
            tick={{ fontSize: 11 }}
            domain={["auto", "auto"]}
            reversed
          />
          <YAxis
            yAxisId="elevation"
            orientation="right"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v}m`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            yAxisId="elevation"
            dataKey="elevation"
            fill="#6366f1"
            opacity={0.3}
            name="elevation"
            radius={[2, 2, 0, 0]}
          />
          <Line
            yAxisId="pace"
            type="monotone"
            dataKey="pace"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            name="pace"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
