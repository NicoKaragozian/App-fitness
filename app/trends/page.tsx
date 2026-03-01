import { activities, weeklyStats, healthMetrics, formatPace } from "@/lib/mock-data";
import {
  WeeklyDistanceChart,
  PaceTrendChart,
  VO2MaxChart,
  SleepPerformanceChart,
} from "@/components/charts/TrendChart";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// Compute weekly average pace from activities
function buildWeeklyPace() {
  return weeklyStats.map((w) => ({
    date: w.weekStart,
    pace: w.avgPace,
    label: new Date(w.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));
}

// Build VO2max trend from activities (one per week, last data point)
function buildVO2Trend() {
  const byWeek: { [week: string]: number } = {};
  activities.forEach((a) => {
    if (!a.vo2maxEstimate) return;
    const date = new Date(a.date);
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const key = monday.toISOString().split("T")[0];
    byWeek[key] = a.vo2maxEstimate;
  });
  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vo2max]) => ({
      date,
      vo2max,
      label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
}

// Sleep vs pace scatter — pair each activity with prior night sleep
function buildSleepPerfData() {
  return activities.map((a) => {
    const actDate = a.date.split("T")[0];
    const dayBefore = new Date(new Date(actDate).getTime() - 86400000)
      .toISOString()
      .split("T")[0];
    const metric = healthMetrics.find((m) => m.date === dayBefore || m.date === actDate);
    return {
      sleep: metric?.sleepHours ?? 7,
      pace: a.avgPace,
      name: a.name,
    };
  });
}

function TrendBadge({ value, unit, label }: { value: number; unit: string; label: string }) {
  const isUp = value > 0;
  const isDown = value < 0;
  return (
    <div className="flex items-center gap-1.5 text-sm">
      {isUp ? (
        <TrendingUp className="w-4 h-4 text-emerald-400" />
      ) : isDown ? (
        <TrendingDown className="w-4 h-4 text-rose-400" />
      ) : (
        <Minus className="w-4 h-4 text-gray-400" />
      )}
      <span className={isUp ? "text-emerald-400" : isDown ? "text-rose-400" : "text-gray-400"}>
        {isUp ? "+" : ""}{value.toFixed(1)}{unit}
      </span>
      <span className="text-gray-500 text-xs">{label}</span>
    </div>
  );
}

export default function TrendsPage() {
  const weeklyDistanceData = weeklyStats
    .slice()
    .reverse()
    .map((w) => ({
      week: new Date(w.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      distance: Math.round(w.totalDistance * 10) / 10,
    }));

  const paceData = buildWeeklyPace().reverse();
  const vo2Data = buildVO2Trend();
  const sleepPerfData = buildSleepPerfData();

  // Summary stats
  const latestWeek = weeklyStats[0];
  const oldestWeek = weeklyStats[weeklyStats.length - 1];
  const distanceDiff = latestWeek.totalDistance - oldestWeek.totalDistance;
  const paceDiff = latestWeek.avgPace - oldestWeek.avgPace; // lower is better
  const latestVO2 = vo2Data[vo2Data.length - 1]?.vo2max ?? 0;
  const oldestVO2 = vo2Data[0]?.vo2max ?? 0;
  const vo2Diff = latestVO2 - oldestVO2;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Trends</h1>
        <p className="text-sm text-gray-500 mt-0.5">4-week performance overview</p>
      </div>

      {/* Summary badges */}
      <div className="flex gap-6 mb-6 px-1">
        <div>
          <p className="text-xs text-gray-500 mb-1">Distance (4w)</p>
          <TrendBadge value={distanceDiff} unit=" km" label="vs week 1" />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Pace (4w)</p>
          <TrendBadge value={-paceDiff} unit="s/km" label="improvement" />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">VO2 Max (4w)</p>
          <TrendBadge value={vo2Diff} unit=" mL/kg/min" label="improvement" />
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Weekly Distance */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Distance</CardTitle>
            <span className="text-xs text-gray-500">km / week</span>
          </CardHeader>
          <WeeklyDistanceChart data={weeklyDistanceData} />
        </Card>

        {/* Average Pace */}
        <Card>
          <CardHeader>
            <CardTitle>Avg Pace per Week</CardTitle>
            <span className="text-xs text-gray-500">min/km (lower = faster)</span>
          </CardHeader>
          <PaceTrendChart data={paceData} />
        </Card>

        {/* VO2 Max */}
        <Card>
          <CardHeader>
            <CardTitle>VO2 Max Estimate</CardTitle>
            <span className="text-xs text-gray-500">mL/kg/min</span>
          </CardHeader>
          <VO2MaxChart data={vo2Data} />
        </Card>

        {/* Sleep vs Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Sleep vs Pace</CardTitle>
            <span className="text-xs text-gray-500">each dot = one run</span>
          </CardHeader>
          <SleepPerformanceChart data={sleepPerfData} />
          <p className="text-xs text-gray-600 mt-2">
            Pattern: better sleep → faster pace. Correlation visible around 7.5–8.5h range.
          </p>
        </Card>
      </div>

      {/* Weekly breakdown table */}
      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Summary</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-[#2a2d3e]">
                  <th className="text-left pb-2 font-medium">Week</th>
                  <th className="text-right pb-2 font-medium">Runs</th>
                  <th className="text-right pb-2 font-medium">Distance</th>
                  <th className="text-right pb-2 font-medium">Avg Pace</th>
                  <th className="text-right pb-2 font-medium">Avg HR</th>
                  <th className="text-right pb-2 font-medium">Calories</th>
                  <th className="text-right pb-2 font-medium">Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d3e]">
                {weeklyStats.map((w, i) => (
                  <tr key={w.weekStart} className={i === 0 ? "text-white" : "text-gray-400"}>
                    <td className="py-2.5">
                      {new Date(w.weekStart).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      {i === 0 && (
                        <span className="ml-2 text-xs bg-indigo-600/20 text-indigo-400 px-1.5 py-0.5 rounded">
                          current
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-mono">{w.totalActivities}</td>
                    <td className="py-2.5 text-right font-mono">{w.totalDistance.toFixed(1)} km</td>
                    <td className="py-2.5 text-right font-mono">{formatPace(w.avgPace)}/km</td>
                    <td className="py-2.5 text-right font-mono">{w.avgHeartRate} bpm</td>
                    <td className="py-2.5 text-right font-mono">{w.totalCalories.toLocaleString()} kcal</td>
                    <td className="py-2.5 text-right font-mono">{w.trainingLoad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
