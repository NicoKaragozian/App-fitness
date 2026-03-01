"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { HeartRateSample } from "@/types/fitness";

interface HeartRateChartProps {
  samples: HeartRateSample[];
  avgHR: number;
  maxHR: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h${(m % 60).toString().padStart(2, "0")}m`;
  return `${m}m`;
}

// Zone thresholds for coloring
function getZoneColor(bpm: number): string {
  if (bpm < 115) return "#10b981";
  if (bpm < 135) return "#6366f1";
  if (bpm < 152) return "#f59e0b";
  if (bpm < 168) return "#f97316";
  return "#ef4444";
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { time: number; bpm: number } }[] }) => {
  if (!active || !payload?.length) return null;
  const { time, bpm } = payload[0].payload;
  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-400">{formatTime(time)}</p>
      <p className="text-white font-bold">{bpm} bpm</p>
    </div>
  );
};

export function HeartRateChart({ samples, avgHR, maxHR }: HeartRateChartProps) {
  // Downsample for performance
  const step = Math.max(1, Math.floor(samples.length / 120));
  const data = samples.filter((_, i) => i % step === 0);

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[90, maxHR + 10]}
            tick={{ fontSize: 11 }}
            tickCount={5}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={avgHR}
            stroke="#6366f1"
            strokeDasharray="4 4"
            label={{ value: `Avg ${avgHR}`, fill: "#6366f1", fontSize: 10, position: "insideTopRight" }}
          />
          <Area
            type="monotone"
            dataKey="bpm"
            stroke="#ef4444"
            strokeWidth={2}
            fill="url(#hrGradient)"
            dot={false}
            activeDot={{ r: 4, fill: "#ef4444" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
