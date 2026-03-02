import type { SportCategorySummary } from "@/types/fitness";
import { Clock, Flame, Activity } from "lucide-react";

interface Props {
  summaries: SportCategorySummary[];
  days: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AnalyticsHeader({ summaries, days }: Props) {
  const totalSessions = summaries.reduce((s, c) => s + c.sessions, 0);
  const totalDuration = summaries.reduce((s, c) => s + c.totalDuration, 0);
  const totalCalories = summaries.reduce((s, c) => s + c.totalCalories, 0);

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Last {days} days · March 2026</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1e2030] border border-[#2a2d3e] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-gray-500 uppercase tracking-wide">Sessions</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalSessions}</p>
          <p className="text-xs text-gray-500 mt-1">across {summaries.length} sport{summaries.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="bg-[#1e2030] border border-[#2a2d3e] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-500 uppercase tracking-wide">Active Time</span>
          </div>
          <p className="text-3xl font-bold text-white">{formatDuration(totalDuration)}</p>
          <p className="text-xs text-gray-500 mt-1">total training time</p>
        </div>

        <div className="bg-[#1e2030] border border-[#2a2d3e] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-4 h-4 text-rose-400" />
            <span className="text-xs text-gray-500 uppercase tracking-wide">Calories</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalCalories.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">kcal burned</p>
        </div>
      </div>
    </div>
  );
}
