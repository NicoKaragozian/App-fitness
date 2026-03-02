"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { SportCategorySummary, SportCategory } from "@/types/fitness";

interface Props {
  summaries: SportCategorySummary[];
}

const CATEGORY_COLORS: Record<SportCategory, string> = {
  gym: "#a855f7",
  water_sports: "#22d3ee",
  tennis: "#facc15",
  running: "#6366f1",
  cycling: "#34d399",
  hiking: "#fb923c",
};

const CATEGORY_ICONS: Record<SportCategory, string> = {
  gym: "🏋️",
  water_sports: "🌊",
  tennis: "🎾",
  running: "🏃",
  cycling: "🚴",
  hiking: "🥾",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function ActivitySplitCard({ summaries }: Props) {
  const data = summaries.map((s) => ({
    name: s.label,
    value: s.totalDuration,
    category: s.category,
    sessions: s.sessions,
  }));

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-[#1e2030] border border-[#2a2d3e] rounded-xl p-4">
      <p className="text-sm font-semibold text-white mb-3">Activity Split</p>
      <p className="text-xs text-gray-500 mb-3">% of training time by sport</p>

      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category as SportCategory]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#1e2030", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
            formatter={(value: number, name: string) => [`${formatDuration(value)} (${Math.round((value / total) * 100)}%)`, name]}
            cursor={false}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-2 mt-2">
        {data.map((entry) => {
          const pct = Math.round((entry.value / total) * 100);
          const color = CATEGORY_COLORS[entry.category as SportCategory];
          const icon = CATEGORY_ICONS[entry.category as SportCategory];
          return (
            <div key={entry.category} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-xs text-gray-400 flex-1">
                {icon} {entry.name}
              </span>
              <span className="text-xs text-gray-500">{entry.sessions}×</span>
              <span className="text-xs font-mono text-white w-8 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
