import { notFound } from "next/navigation";
import Link from "next/link";
import { getActivityById, formatPace, formatDuration } from "@/lib/mock-data";
import { HeartRateChart } from "@/components/charts/HeartRateChart";
import { ZonesChart } from "@/components/charts/ZonesChart";
import { PaceChart } from "@/components/charts/PaceChart";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Flame,
  Heart,
  TrendingUp,
  Mountain,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

const ZONE_COLORS = [
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-orange-500",
  "bg-red-500",
];

export default async function ActivityDetailPage({ params }: PageProps) {
  const { id } = await params;
  const activity = getActivityById(id);

  if (!activity) notFound();

  const dateFormatted = new Date(activity.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const stats = [
    { label: "Distance", value: `${activity.distance.toFixed(2)} km`, icon: MapPin, color: "text-indigo-400" },
    { label: "Duration", value: formatDuration(activity.duration), icon: Clock, color: "text-emerald-400" },
    { label: "Avg Pace", value: `${formatPace(activity.avgPace)}/km`, icon: TrendingUp, color: "text-amber-400" },
    { label: "Avg HR", value: `${activity.avgHeartRate} bpm`, icon: Heart, color: "text-red-400" },
    { label: "Max HR", value: `${activity.maxHeartRate} bpm`, icon: Heart, color: "text-rose-500" },
    { label: "Calories", value: `${activity.calories} kcal`, icon: Flame, color: "text-orange-400" },
    { label: "Elevation", value: `+${activity.elevationGain}m`, icon: Mountain, color: "text-sky-400" },
    ...(activity.vo2maxEstimate
      ? [{ label: "VO2 Max", value: `${activity.vo2maxEstimate.toFixed(1)}`, icon: TrendingUp, color: "text-emerald-400" }]
      : []),
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back button */}
      <Link
        href="/activities"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Activities
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🏃</span>
          <h1 className="text-2xl font-bold text-white">{activity.name}</h1>
        </div>
        <p className="text-sm text-gray-500">{dateFormatted}</p>
      </div>

      {/* Key Stats Grid */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-[#2a2d3e] bg-[#1a1d27] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <p className="text-lg font-bold text-white font-mono">{value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Heart Rate Chart — takes 2/3 */}
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Heart Rate</CardTitle>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                avg {activity.avgHeartRate} bpm
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block ml-2" />
                max {activity.maxHeartRate} bpm
              </div>
            </CardHeader>
            <HeartRateChart
              samples={activity.heartRateSamples}
              avgHR={activity.avgHeartRate}
              maxHR={activity.maxHeartRate}
            />
          </Card>
        </div>

        {/* Zones Chart — 1/3 */}
        <Card>
          <CardHeader>
            <CardTitle>HR Zones</CardTitle>
          </CardHeader>
          <ZonesChart zones={activity.zones} />
        </Card>
      </div>

      {/* Pace Chart + Zone Table Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Pace Chart — 2/3 */}
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Pace by Km</CardTitle>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  Pace
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500/50 inline-block" />
                  Elevation
                </span>
              </div>
            </CardHeader>
            <PaceChart samples={activity.paceSamples} avgPace={activity.avgPace} />
          </Card>
        </div>

        {/* Zone breakdown table — 1/3 */}
        <Card>
          <CardHeader>
            <CardTitle>Zone Breakdown</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {activity.zones.map((zone) => (
              <div key={zone.zone} className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ZONE_COLORS[zone.zone - 1]}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-gray-300">Z{zone.zone} {zone.name}</span>
                    <span className="text-xs font-mono text-white">{zone.minutes}m</span>
                  </div>
                  <div className="mt-0.5 h-1 bg-[#2a2d3e] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${ZONE_COLORS[zone.zone - 1]}`}
                      style={{ width: `${zone.percentage}%`, opacity: 0.75 }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{zone.percentage}%</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[#2a2d3e]">
            <p className="text-xs text-gray-500">
              HR range: {activity.zones[0].minHR}–{activity.zones[4].maxHR} bpm
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
