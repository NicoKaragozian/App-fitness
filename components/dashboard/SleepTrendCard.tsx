import type { SleepTrendSummary } from "@/types/fitness";
import { Moon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { SleepTrendChart } from "@/components/charts/SleepTrendChart";

interface Props {
  summary: SleepTrendSummary;
}

const TREND_CONFIG = {
  improving: { icon: TrendingUp, color: "text-emerald-400", label: "Improving" },
  declining: { icon: TrendingDown, color: "text-rose-400", label: "Declining" },
  stable: { icon: Minus, color: "text-gray-400", label: "Stable" },
};

export function SleepTrendCard({ summary }: Props) {
  const trendCfg = TREND_CONFIG[summary.trend];
  const TrendIcon = trendCfg.icon;

  return (
    <div className="bg-[#1e2030] border border-[#2a2d3e] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">Sleep — 14 days</span>
        </div>
        <div className={`flex items-center gap-1 ${trendCfg.color}`}>
          <TrendIcon className="w-3 h-3" />
          <span className="text-xs">{trendCfg.label}</span>
        </div>
      </div>

      <div className="flex gap-4 mb-3">
        <div>
          <p className="text-2xl font-bold text-white">{summary.avgScore}</p>
          <p className="text-xs text-gray-500">Avg score</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{summary.avgHours}h</p>
          <p className="text-xs text-gray-500">Avg hours</p>
        </div>
      </div>

      <SleepTrendChart trends={summary.trends} />

      <div className="flex gap-3 mt-2">
        {[
          { color: "#34d399", label: "≥80 Excellent" },
          { color: "#818cf8", label: "65–79 Good" },
          { color: "#fbbf24", label: "50–64 Fair" },
          { color: "#f87171", label: "<50 Poor" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
