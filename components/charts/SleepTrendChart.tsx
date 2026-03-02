"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { SleepTrend } from "@/types/fitness";

interface Props {
  trends: SleepTrend[];
}

function scoreColor(score: number): string {
  if (score >= 80) return "#34d399"; // emerald
  if (score >= 65) return "#818cf8"; // indigo
  if (score >= 50) return "#fbbf24"; // amber
  return "#f87171"; // red
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SleepTrendChart({ trends }: Props) {
  const data = trends.map((t) => ({
    date: shortDate(t.date),
    score: t.sleepScore,
    hours: t.sleepHours,
    color: scoreColor(t.sleepScore),
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          interval={1}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          label={{ value: "Score", angle: -90, position: "insideLeft", offset: 14, style: { fontSize: 10, fill: "#6b7280" } }}
        />
        <Tooltip
          contentStyle={{ background: "#1e2030", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#e5e7eb" }}
          formatter={(value: number, name: string) => {
            if (name === "score") return [`${value}`, "Sleep Score"];
            return [`${value}h`, "Hours"];
          }}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey="score" radius={[3, 3, 0, 0]} maxBarSize={24}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
