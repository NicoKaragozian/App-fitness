import { notFound } from "next/navigation";
import Link from "next/link";
import type { SportCategory, Activity } from "@/types/fitness";
import { getActivitiesByCategory } from "@/lib/data";

// ─── Config ───────────────────────────────────────────────────────────────────

const VALID_SLUGS = new Set<SportCategory>([
  "gym", "water_sports", "tennis", "running", "cycling", "hiking",
]);

const CATEGORY_CONFIG: Record<SportCategory, { icon: string; label: string; color: string; borderColor: string }> = {
  gym:          { icon: "🏋️", label: "Gym",          color: "text-purple-400", borderColor: "border-purple-500/40" },
  water_sports: { icon: "🌊", label: "Water Sports", color: "text-cyan-400",   borderColor: "border-cyan-500/40" },
  tennis:       { icon: "🎾", label: "Tennis",       color: "text-yellow-400", borderColor: "border-yellow-500/40" },
  running:      { icon: "🏃", label: "Running",      color: "text-indigo-400", borderColor: "border-indigo-500/40" },
  cycling:      { icon: "🚴", label: "Cycling",      color: "text-emerald-400",borderColor: "border-emerald-500/40" },
  hiking:       { icon: "🥾", label: "Hiking",       color: "text-orange-400", borderColor: "border-orange-500/40" },
};

const WATER_ICONS: Record<string, string> = {
  surf: "🏄", wingfoil: "🪁", windsurf: "🌊", kiteboard: "🪁",
  stand_up_paddling: "🏄", open_water_swimming: "🏊",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function totalDurationSec(acts: Activity[]): number {
  return acts.reduce((s, a) => s + a.duration, 0);
}

function totalCal(acts: Activity[]): number {
  return acts.reduce((s, a) => s + a.calories, 0);
}

function avgHR(acts: Activity[]): number {
  const withHR = acts.filter((a) => a.avgHeartRate > 0);
  if (!withHR.length) return 0;
  return Math.round(withHR.reduce((s, a) => s + a.avgHeartRate, 0) / withHR.length);
}

function totalDistanceKm(acts: Activity[]): number {
  return acts.reduce((s, a) => s + (a.distance ?? 0), 0);
}

// ─── Activity Card ─────────────────────────────────────────────────────────────

function ActivityCard({ activity, category }: { activity: Activity; category: SportCategory }) {
  const cfg = CATEGORY_CONFIG[category];

  return (
    <Link
      href={`/activities/${activity.id}`}
      className={`bg-[#1e2030] border ${cfg.borderColor} rounded-xl p-4 flex flex-col gap-2 hover:bg-[#222537] transition-colors`}
    >
      {/* Row 1: icon/type + date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {category === "water_sports" && (
            <span className="text-lg">{WATER_ICONS[activity.type] ?? "🌊"}</span>
          )}
          <span className="text-sm font-semibold text-white">{activity.name}</span>
        </div>
        <span className="text-xs text-gray-500">{formatDate(activity.date)}</span>
      </div>

      {/* Row 2: metrics */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div>
          <span className="text-gray-500">Duration</span>
          <p className="font-bold text-white">{formatDuration(activity.duration)}</p>
        </div>

        {(category === "water_sports" || category === "tennis" || category === "running" || category === "cycling" || category === "hiking") && activity.distance != null && activity.distance > 0 && (
          <div>
            <span className="text-gray-500">Distance</span>
            <p className="font-bold text-white">{activity.distance.toFixed(1)} km</p>
          </div>
        )}

        {activity.avgHeartRate > 0 && (
          <div>
            <span className="text-gray-500">Avg HR</span>
            <p className="font-bold text-white">{activity.avgHeartRate} bpm</p>
          </div>
        )}

        <div>
          <span className="text-gray-500">Calories</span>
          <p className="font-bold text-white">{activity.calories.toLocaleString()} cal</p>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!VALID_SLUGS.has(slug as SportCategory)) {
    notFound();
  }

  const category = slug as SportCategory;
  const cfg = CATEGORY_CONFIG[category];
  const activities = await getActivitiesByCategory(category, 60);

  const totalSec = totalDurationSec(activities);
  const totalCals = totalCal(activities);
  const avgHRVal = avgHR(activities);
  const totalKm = totalDistanceKm(activities);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
        ← Dashboard
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">{cfg.icon}</span>
          <h1 className={`text-2xl font-bold ${cfg.color}`}>{cfg.label}</h1>
          <span className="text-xs text-gray-500 ml-2">last 60 days</span>
        </div>

        {activities.length > 0 ? (
          <div className="flex flex-wrap gap-4 text-sm text-gray-400 mt-2">
            <span><span className="text-white font-semibold">{activities.length}</span> sessions</span>
            <span>·</span>
            <span><span className="text-white font-semibold">{formatDuration(totalSec)}</span></span>
            <span>·</span>
            <span><span className="text-white font-semibold">{totalCals.toLocaleString()}</span> cal</span>
            {totalKm > 0 && (
              <>
                <span>·</span>
                <span><span className="text-white font-semibold">{totalKm.toFixed(1)}</span> km</span>
              </>
            )}
            {avgHRVal > 0 && (
              <>
                <span>·</span>
                <span><span className="text-white font-semibold">{avgHRVal}</span> bpm avg</span>
              </>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm mt-2">No sessions in the last 60 days.</p>
        )}
      </div>

      {/* Activity list */}
      {activities.length > 0 && (
        <div className="flex flex-col gap-3">
          {activities.map((act) => (
            <ActivityCard key={act.id} activity={act} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}
