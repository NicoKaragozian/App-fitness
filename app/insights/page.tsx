"use client";

import { useState } from "react";
import { Brain, Sparkles, TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import type { InsightsResponse, AIInsight } from "@/types/fitness";
import { cn } from "@/lib/utils";

// ─── Static fallback insights (shown before API call) ──────────────────────

const fallbackInsights: InsightsResponse = {
  insights: [
    {
      type: "pattern",
      title: "Recovery days power your best runs",
      description:
        "Your top 5 pace performances all occurred after 2 or more consecutive rest days. On average, runs after 2+ rest days were 18 seconds/km faster than runs after 0–1 rest days. Prioritize full recovery before key sessions.",
      metric: "pace",
      trend: "improving",
      confidence: "high",
    },
    {
      type: "pattern",
      title: "Sleep below 6.5h spikes resting HR",
      description:
        "On days after less than 6.5h of sleep, your resting heart rate averages 52 bpm — 6 bpm higher than your normal 46 bpm baseline. Elevated RHR is a reliable indicator of incomplete recovery and predicts subpar workout quality the following day.",
      metric: "restingHeartRate",
      trend: "stable",
      confidence: "high",
    },
    {
      type: "summary",
      title: "8% pace improvement in 4 weeks",
      description:
        "Your average pace improved from 6:43/km in week 1 to 5:46/km this week — an 8.4% improvement in 4 weeks. This progression is sustainable and suggests your aerobic base is responding well to the current training volume.",
      metric: "pace",
      trend: "improving",
      confidence: "high",
    },
    {
      type: "summary",
      title: "VO2 max climbing steadily",
      description:
        "Your estimated VO2 max has increased from 48.2 to 52.4 mL/kg/min over 4 weeks (+4.2 units). At this rate, you'll enter the 'Excellent' category (>55) in about 3 more weeks of consistent training.",
      metric: "vo2max",
      trend: "improving",
      confidence: "medium",
    },
    {
      type: "recommendation",
      title: "Training load is optimal — hold steady",
      description:
        "Your training load of 742 this week sits in the optimal 600–800 range. Increasing volume aggressively now risks overtraining. Instead, focus on quality: one tempo session, one interval session, and a long run per week.",
      trend: "stable",
      confidence: "high",
    },
    {
      type: "pattern",
      title: "Heart rate adaptation = real fitness gains",
      description:
        "Running the same 10km route at the same pace, your average HR is now 8 bpm lower than 4 weeks ago. This cardiac drift reduction is a concrete sign your cardiovascular system is becoming more efficient.",
      metric: "avgHeartRate",
      trend: "improving",
      confidence: "medium",
    },
    {
      type: "comparison",
      title: "This week vs last: across the board gains",
      description:
        "Distance up 2%, pace up 2% (5:46 vs 5:40 target), and training load up 2% — all within healthy progression ranges. The long run jumped from 16.1 to 18.4km, which is excellent Sunday work for marathon base building.",
      trend: "improving",
      confidence: "high",
    },
  ],
  weeklySummary:
    "This was a strong week: 49.9km across 5 runs with your best average pace of the block. Body battery stayed above 70 on most days, and your long run of 18.4km signals marathon-ready endurance building. Key focus: protect sleep to keep resting HR low and body battery high heading into next week.",
  weekComparison: [
    { metric: "Total Distance", current: 49.9, previous: 48.9, unit: "km", change: 2.0 },
    { metric: "Avg Pace", current: 346, previous: 354, unit: "s/km", change: 2.3 },
    { metric: "Training Load", current: 742, previous: 728, unit: "", change: 1.9 },
    { metric: "Avg HR", current: 148, previous: 151, unit: "bpm", change: -2.0 },
    { metric: "Calories", current: 3400, previous: 3401, unit: "kcal", change: 0.0 },
  ],
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: AIInsight }) {
  const typeColors = {
    pattern: "border-indigo-500/30 bg-indigo-600/5",
    summary: "border-emerald-500/30 bg-emerald-600/5",
    recommendation: "border-amber-500/30 bg-amber-600/5",
    comparison: "border-sky-500/30 bg-sky-600/5",
  };
  const typeLabel = {
    pattern: { label: "Pattern", color: "text-indigo-400 bg-indigo-500/10" },
    summary: { label: "Summary", color: "text-emerald-400 bg-emerald-500/10" },
    recommendation: { label: "Tip", color: "text-amber-400 bg-amber-500/10" },
    comparison: { label: "Comparison", color: "text-sky-400 bg-sky-500/10" },
  };
  const trendIcon = {
    improving: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
    declining: <TrendingDown className="w-3.5 h-3.5 text-rose-400" />,
    stable: <Minus className="w-3.5 h-3.5 text-gray-400" />,
  };

  const meta = typeLabel[insight.type];

  return (
    <div className={cn("rounded-xl border p-4", typeColors[insight.type])}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", meta.color)}>
            {meta.label}
          </span>
          {insight.trend && trendIcon[insight.trend]}
        </div>
        <span className="text-xs text-gray-600 capitalize">{insight.confidence} confidence</span>
      </div>
      <h3 className="text-sm font-semibold text-white mb-1.5">{insight.title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{insight.description}</p>
    </div>
  );
}

function ComparisonRow({
  metric,
  current,
  previous,
  unit,
  change,
}: {
  metric: string;
  current: number;
  previous: number;
  unit: string;
  change: number;
}) {
  const isGood = change > 0;
  const isNeutral = Math.abs(change) < 0.5;
  // For HR, lower is better
  const isHR = metric.toLowerCase().includes("hr");
  const positive = isHR ? !isGood : isGood;

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#2a2d3e] last:border-0">
      <span className="text-sm text-gray-400">{metric}</span>
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-600">prev: {previous}{unit ? ` ${unit}` : ""}</span>
        <span className="text-sm font-mono font-medium text-white">{current}{unit ? ` ${unit}` : ""}</span>
        <span
          className={cn(
            "text-xs font-medium w-14 text-right",
            isNeutral ? "text-gray-500" : positive ? "text-emerald-400" : "text-rose-400"
          )}
        >
          {change > 0 ? "+" : ""}{change.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [data, setData] = useState<InsightsResponse>(fallbackInsights);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  async function fetchFromClaude() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/insights");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "API error");
      setData(json as InsightsResponse);
      setIsLive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-400" />
            AI Insights
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pattern detection powered by Claude claude-sonnet-4-6
          </p>
        </div>
        <button
          onClick={fetchFromClaude}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analyzing..." : isLive ? "Re-analyze" : "Analyze with Claude"}
        </button>
      </div>

      {/* Status banner */}
      {!isLive && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          Showing pre-generated insights. Click "Analyze with Claude" to get live AI analysis.
        </div>
      )}
      {isLive && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          Live analysis from Claude claude-sonnet-4-6 — generated just now from your fitness data.
        </div>
      )}
      {error && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Insights — 2/3 width */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Detected Patterns & Insights
          </h2>
          {data.insights.map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Weekly summary */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Summary</CardTitle>
              <Brain className="w-4 h-4 text-indigo-400" />
            </CardHeader>
            <p className="text-sm text-gray-300 leading-relaxed">{data.weeklySummary}</p>
          </Card>

          {/* Week comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Week vs Last Week</CardTitle>
            </CardHeader>
            <div>
              {data.weekComparison.map((row) => (
                <ComparisonRow key={row.metric} {...row} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
