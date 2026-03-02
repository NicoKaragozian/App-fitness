import {
  getRecentActivities,
  getWeeklyStats,
  getMonthlyStats,
  getSportCategorySummaries,
  getSleepTrendSummary,
} from "@/lib/data";
import { AnalyticsHeader } from "@/components/dashboard/AnalyticsHeader";
import { SportCategoryPanel } from "@/components/dashboard/SportCategoryPanel";
import { SleepTrendCard } from "@/components/dashboard/SleepTrendCard";
import { ActivitySplitCard } from "@/components/dashboard/ActivitySplitCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AIWidget } from "@/components/dashboard/AIWidget";

export default async function DashboardPage() {
  const [sportSummaries, sleepTrend, recentActivities] = await Promise.all([
    getSportCategorySummaries(30),
    getSleepTrendSummary(14),
    getRecentActivities(6),
  ]);

  // Primary categories to feature prominently (gym, water, tennis)
  const featured = ["gym", "water_sports", "tennis"] as const;
  const featuredPanels = featured
    .map((cat) => sportSummaries.find((s) => s.category === cat))
    .filter(Boolean) as typeof sportSummaries;

  // Fill missing featured panels with top remaining categories
  for (const s of sportSummaries) {
    if (featuredPanels.length >= 3) break;
    if (!featuredPanels.find((f) => f.category === s.category)) {
      featuredPanels.push(s);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Analytics Header — period totals */}
      <AnalyticsHeader summaries={sportSummaries} days={30} />

      {/* Sport Panels grid */}
      {featuredPanels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {featuredPanels.map((s) => (
            <SportCategoryPanel key={s.category} summary={s} />
          ))}
        </div>
      )}

      {/* Sleep Trend + Activity Split */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2">
          <SleepTrendCard summary={sleepTrend} />
        </div>
        <div>
          <ActivitySplitCard summaries={sportSummaries} />
        </div>
      </div>

      {/* Activity Feed + AI Widget */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-[#1e2030] border border-[#2a2d3e] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Recent Sessions</p>
            <a href="/activities" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              View all →
            </a>
          </div>
          <ActivityFeed activities={recentActivities} />
        </div>

        <div>
          <AIWidget />
        </div>
      </div>
    </div>
  );
}
