import {
  getRecentActivities,
  getTodayMetrics,
  getCurrentWeekStats,
  getPreviousWeekStats,
  formatDuration,
  formatPace,
} from "@/lib/data";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AIWidget } from "@/components/dashboard/AIWidget";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { MapPin, Clock, Flame, TrendingUp, Zap, Moon, Activity } from "lucide-react";

export default async function DashboardPage() {
  const [today, week, prevWeek, recentActivities] = await Promise.all([
    getTodayMetrics(),
    getCurrentWeekStats(),
    getPreviousWeekStats(),
    getRecentActivities(5),
  ]);

  const distanceTrend = Math.round(((week.totalDistance - prevWeek.totalDistance) / prevWeek.totalDistance) * 100);
  const paceTrend = Math.round(((prevWeek.avgPace - week.avgPace) / prevWeek.avgPace) * 100); // lower pace = better

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Sunday, March 1, 2026 · Week of Feb 23 – Mar 1
        </p>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Weekly Distance"
          value={`${week.totalDistance.toFixed(1)} km`}
          subtitle={`${week.totalActivities} runs`}
          icon={MapPin}
          trend={{ value: distanceTrend, label: "vs last week" }}
          color="indigo"
        />
        <StatsCard
          title="Active Time"
          value={formatDuration(week.totalDuration)}
          subtitle="This week"
          icon={Clock}
          color="emerald"
        />
        <StatsCard
          title="Avg Pace"
          value={`${formatPace(week.avgPace)}/km`}
          subtitle="This week"
          icon={TrendingUp}
          trend={{ value: paceTrend, label: "vs last week" }}
          color="amber"
        />
        <StatsCard
          title="Calories"
          value={`${week.totalCalories.toLocaleString()} kcal`}
          subtitle="Burned this week"
          icon={Flame}
          color="rose"
        />
      </div>

      {/* Body Battery + Sleep + VO2max */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Body Battery */}
        <Card>
          <CardHeader>
            <CardTitle>Body Battery</CardTitle>
            <Zap className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-white">{today.bodyBattery}</span>
            <span className="text-sm text-gray-500 mb-1">/ 100</span>
          </div>
          <div className="mt-3 h-2 bg-[#2a2d3e] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all"
              style={{ width: `${today.bodyBattery}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {today.bodyBattery >= 75 ? "Ready for hard effort" : today.bodyBattery >= 50 ? "Moderate readiness" : "Recovery recommended"}
          </p>
        </Card>

        {/* Sleep Score */}
        <Card>
          <CardHeader>
            <CardTitle>Sleep Score</CardTitle>
            <Moon className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-white">{today.sleepScore}</span>
            <span className="text-sm text-gray-500 mb-1">/ 100</span>
          </div>
          <div className="mt-3 h-2 bg-[#2a2d3e] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all"
              style={{ width: `${today.sleepScore}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {today.sleepHours.toFixed(1)}h sleep · RHR {today.restingHeartRate} bpm
          </p>
        </Card>

        {/* VO2 Max */}
        <Card>
          <CardHeader>
            <CardTitle>VO2 Max</CardTitle>
            <Activity className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-white">{today.vo2max.toFixed(1)}</span>
            <span className="text-sm text-gray-500 mb-1">mL/kg/min</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Good</span>
              <span>Excellent</span>
            </div>
            <div className="h-2 bg-[#2a2d3e] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                style={{ width: `${Math.min(100, ((today.vo2max - 40) / 20) * 100)}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">+3.9 from last month</p>
        </Card>
      </div>

      {/* Bottom: Activity Feed + AI Widget */}
      <div className="grid grid-cols-3 gap-4">
        {/* Recent Activities */}
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <a href="/activities" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                View all →
              </a>
            </CardHeader>
            <ActivityFeed activities={recentActivities} />
          </Card>
        </div>

        {/* Right column: AI Widget + Training Load */}
        <div className="space-y-4">
          <AIWidget />

          <Card>
            <CardHeader>
              <CardTitle>Training Load</CardTitle>
              <TrendingUp className="w-4 h-4 text-indigo-400" />
            </CardHeader>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-white">{week.trainingLoad}</span>
              <span className="text-xs text-emerald-400 mb-1.5">+{week.trainingLoad - prevWeek.trainingLoad}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Optimal range: 600–800</p>
            <div className="mt-3 space-y-1.5">
              {[
                { label: "This week", value: week.trainingLoad, max: 1000 },
                { label: "Last week", value: prevWeek.trainingLoad, max: 1000 },
              ].map(({ label, value, max }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                  <div className="h-1.5 bg-[#2a2d3e] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-600"
                      style={{ width: `${(value / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
