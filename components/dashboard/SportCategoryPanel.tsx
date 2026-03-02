import type { SportCategorySummary, SportCategory } from "@/types/fitness";
import { WeeklySessionSparkline } from "@/components/charts/WeeklySessionSparkline";
import { Clock, Flame, Heart } from "lucide-react";

interface Props {
  summary: SportCategorySummary;
}

const CATEGORY_CONFIG: Record<SportCategory, { icon: string; color: string; sparkColor: string }> = {
  gym: { icon: "🏋️", color: "text-purple-400", sparkColor: "#a855f7" },
  water_sports: { icon: "🌊", color: "text-cyan-400", sparkColor: "#22d3ee" },
  tennis: { icon: "🎾", color: "text-yellow-400", sparkColor: "#facc15" },
  running: { icon: "🏃", color: "text-indigo-400", sparkColor: "#6366f1" },
  cycling: { icon: "🚴", color: "text-emerald-400", sparkColor: "#34d399" },
  hiking: { icon: "🥾", color: "text-orange-400", sparkColor: "#fb923c" },
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SportCategoryPanel({ summary }: Props) {
  const config = CATEGORY_CONFIG[summary.category];

  return (
    <div className="bg-[#1e2030] border border-[#2a2d3e] rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">{config.icon}</span>
        <div>
          <p className="text-sm font-semibold text-white">{summary.label}</p>
          <p className={`text-xs ${config.color}`}>{summary.sessions} session{summary.sessions !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <Clock className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500">Time</span>
          </div>
          <p className="text-sm font-bold text-white">{formatDuration(summary.totalDuration)}</p>
        </div>
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <Flame className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500">Cal</span>
          </div>
          <p className="text-sm font-bold text-white">{summary.totalCalories.toLocaleString()}</p>
        </div>
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <Heart className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500">Avg HR</span>
          </div>
          <p className="text-sm font-bold text-white">
            {summary.avgHeartRate > 0 ? `${summary.avgHeartRate} bpm` : "—"}
          </p>
        </div>
      </div>

      {/* Sparkline */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Sessions / week</p>
        <WeeklySessionSparkline counts={summary.weeklySessionCounts} color={config.sparkColor} />
      </div>
    </div>
  );
}
