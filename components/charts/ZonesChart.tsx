"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { HeartRateZone } from "@/types/fitness";

interface ZonesChartProps {
  zones: HeartRateZone[];
}

const ZONE_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#f97316", "#ef4444"];

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: HeartRateZone }[] }) => {
  if (!active || !payload?.length) return null;
  const zone = payload[0].payload;
  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-lg px-3 py-2 text-xs">
      <p className="text-white font-bold">Zone {zone.zone} — {zone.name}</p>
      <p className="text-gray-400">{zone.minutes} min ({zone.percentage}%)</p>
      <p className="text-gray-500">{zone.minHR}–{zone.maxHR} bpm</p>
    </div>
  );
};

const renderLabel = ({ name, percentage }: { name: string; percentage: number }) =>
  percentage > 5 ? `${percentage}%` : "";

export function ZonesChart({ zones }: ZonesChartProps) {
  const data = zones.filter((z) => z.minutes > 0);

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="minutes"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={85}
            innerRadius={45}
            paddingAngle={2}
          >
            {data.map((zone) => (
              <Cell
                key={zone.zone}
                fill={ZONE_COLORS[zone.zone - 1]}
                opacity={0.85}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-gray-400">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
