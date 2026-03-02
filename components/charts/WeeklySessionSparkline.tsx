"use client";

import { BarChart, Bar, ResponsiveContainer, Cell } from "recharts";

interface Props {
  counts: number[]; // 4 values, oldest first
  color?: string;
}

export function WeeklySessionSparkline({ counts, color = "#6366f1" }: Props) {
  const labels = ["W-3", "W-2", "W-1", "W"];
  const data = counts.map((count, i) => ({ label: labels[i], count }));
  const max = Math.max(...counts, 1);

  return (
    <ResponsiveContainer width="100%" height={40}>
      <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap="20%">
        <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={16}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={color}
              fillOpacity={i === data.length - 1 ? 1 : 0.35 + (i / data.length) * 0.5}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
