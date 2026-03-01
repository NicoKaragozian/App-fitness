import Link from "next/link";
import { formatPace, formatDuration } from "@/lib/mock-data";
import type { Activity } from "@/types/fitness";
import { MapPin, Clock, Flame, Heart } from "lucide-react";

interface ActivityFeedProps {
  activities: Activity[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date("2026-03-01");
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <Link
          key={activity.id}
          href={`/activities/${activity.id}`}
          className="flex items-center gap-4 p-3 rounded-lg hover:bg-[#2a2d3e]/50 transition-colors group"
        >
          {/* Icon */}
          <div className="w-10 h-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🏃</span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white truncate group-hover:text-indigo-300 transition-colors">
                {activity.name}
              </p>
              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                {formatDate(activity.date)}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin className="w-3 h-3" />
                {activity.distance.toFixed(1)} km
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                {formatDuration(activity.duration)}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Heart className="w-3 h-3" />
                {activity.avgHeartRate} bpm
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Flame className="w-3 h-3" />
                {activity.calories} kcal
              </span>
            </div>
          </div>

          {/* Pace badge */}
          <div className="flex-shrink-0 text-right">
            <p className="text-sm font-mono font-bold text-white">
              {formatPace(activity.avgPace)}
            </p>
            <p className="text-xs text-gray-500">/km</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
