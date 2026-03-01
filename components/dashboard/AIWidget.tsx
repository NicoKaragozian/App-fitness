"use client";

import { useState } from "react";
import { Brain, Sparkles, RefreshCw } from "lucide-react";

const defaultInsights = [
  "Your best runs follow 2+ rest days — recovery drives performance.",
  "Resting HR spikes when sleep drops below 6.5h. Prioritize sleep before key sessions.",
  "Average pace improved 8% over the last 4 weeks. Keep the progression steady.",
  "VO2max trending up (+3.9 since Feb 1). You're building aerobic base effectively.",
];

export function AIWidget() {
  const [insight, setInsight] = useState(defaultInsights[0]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  function cycleInsight() {
    setLoading(true);
    setTimeout(() => {
      const next = (idx + 1) % defaultInsights.length;
      setIdx(next);
      setInsight(defaultInsights[next]);
      setLoading(false);
    }, 600);
  }

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-indigo-600/5 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-medium text-indigo-400 uppercase tracking-wide">
            AI Insight
          </span>
        </div>
        <button
          onClick={cycleInsight}
          disabled={loading}
          className="text-gray-500 hover:text-indigo-400 transition-colors"
          title="Next insight"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex items-start gap-2">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-gray-300 leading-relaxed">
          {insight}
        </p>
      </div>

      <div className="flex gap-1 mt-3">
        {defaultInsights.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i === idx ? "bg-indigo-500" : "bg-[#2a2d3e]"
            }`}
          />
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-2">
        Powered by Claude claude-sonnet-4-6 — go to{" "}
        <span className="text-indigo-500">AI Insights</span> for full analysis
      </p>
    </div>
  );
}
