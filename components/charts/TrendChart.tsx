"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatPace } from "@/lib/mock-data";

// ─── Weekly Distance Bar Chart ──────────────────────────────────────────────

interface WeeklyDistanceData {
  week: string;
  distance: number;
}

export function WeeklyDistanceChart({ data }: { data: WeeklyDistanceData[] }) {
  const max = Math.max(...data.map((d) => d.distance));
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}km`} />
          <Tooltip
            formatter={(v: number) => [`${v.toFixed(1)} km`, "Distance"]}
            contentStyle={{
              background: "#1a1d27",
              border: "1px solid #2a2d3e",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="distance" radius={[4, 4, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.distance === max ? "#6366f1" : "#6366f155"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Pace Trend Line Chart ───────────────────────────────────────────────────

interface PaceTrendData {
  date: string;
  pace: number;
  label: string;
}

export function PaceTrendChart({ data }: { data: PaceTrendData[] }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => formatPace(v)}
            domain={["auto", "auto"]}
            reversed
          />
          <Tooltip
            formatter={(v: number) => [formatPace(v) + "/km", "Avg Pace"]}
            contentStyle={{
              background: "#1a1d27",
              border: "1px solid #2a2d3e",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Line
            type="monotone"
            dataKey="pace"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={{ fill: "#f59e0b", r: 4 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── VO2 Max Line Chart ──────────────────────────────────────────────────────

interface VO2Data {
  date: string;
  vo2max: number;
  label: string;
}

export function VO2MaxChart({ data }: { data: VO2Data[] }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            domain={[48, 54]}
            tickCount={4}
          />
          <Tooltip
            formatter={(v: number) => [`${v.toFixed(1)} mL/kg/min`, "VO2 Max"]}
            contentStyle={{
              background: "#1a1d27",
              border: "1px solid #2a2d3e",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Line
            type="monotone"
            dataKey="vo2max"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ fill: "#10b981", r: 4 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Sleep vs Performance Scatter ───────────────────────────────────────────

interface SleepPerfData {
  sleep: number;
  pace: number;
  name: string;
}

export function SleepPerformanceChart({ data }: { data: SleepPerfData[] }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="sleep"
            type="number"
            domain={[5, 10]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v}h`}
            name="Sleep"
          />
          <YAxis
            dataKey="pace"
            type="number"
            reversed
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => formatPace(v)}
            name="Pace"
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            formatter={(v: number, name: string) => [
              name === "pace" ? formatPace(v) + "/km" : `${v.toFixed(1)}h`,
              name === "pace" ? "Avg Pace" : "Sleep",
            ]}
            contentStyle={{
              background: "#1a1d27",
              border: "1px solid #2a2d3e",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Scatter data={data} fill="#6366f1" opacity={0.8} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
