import Link from "next/link";
import { getActivities, formatPace, formatDuration } from "@/lib/data";
import { MapPin, Clock, Heart, Flame, TrendingUp } from "lucide-react";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function ActivitiesPage() {
  const activities = await getActivities();
  const sorted = [...activities].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Activities</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {activities.length} runs · last 4 weeks
        </p>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_80px_80px_80px_80px_80px] gap-4 px-4 pb-2 text-xs text-gray-500 uppercase tracking-wide border-b border-[#2a2d3e]">
        <span>Activity</span>
        <span className="text-right">Distance</span>
        <span className="text-right">Time</span>
        <span className="text-right">Pace</span>
        <span className="text-right">Avg HR</span>
        <span className="text-right">Calories</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#2a2d3e]">
        {sorted.map((activity) => (
          <Link
            key={activity.id}
            href={`/activities/${activity.id}`}
            className="grid grid-cols-[1fr_80px_80px_80px_80px_80px] gap-4 px-4 py-3.5 items-center hover:bg-[#1a1d27] transition-colors group"
          >
            <div>
              <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">
                {activity.name}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDate(activity.date)} · +{activity.elevationGain}m gain
              </p>
            </div>
            <p className="text-sm text-gray-300 text-right font-mono">
              {activity.distance.toFixed(1)} km
            </p>
            <p className="text-sm text-gray-300 text-right font-mono">
              {formatDuration(activity.duration)}
            </p>
            <p className="text-sm text-gray-300 text-right font-mono">
              {formatPace(activity.avgPace)}
            </p>
            <p className="text-sm text-gray-300 text-right font-mono">
              {activity.avgHeartRate}
            </p>
            <p className="text-sm text-gray-300 text-right font-mono">
              {activity.calories}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
