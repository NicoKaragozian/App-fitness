import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: "indigo" | "emerald" | "amber" | "rose";
}

const colorMap = {
  indigo: {
    bg: "bg-indigo-600/10",
    icon: "text-indigo-400",
    trend: "text-indigo-400",
  },
  emerald: {
    bg: "bg-emerald-600/10",
    icon: "text-emerald-400",
    trend: "text-emerald-400",
  },
  amber: {
    bg: "bg-amber-600/10",
    icon: "text-amber-400",
    trend: "text-amber-400",
  },
  rose: {
    bg: "bg-rose-600/10",
    icon: "text-rose-400",
    trend: "text-rose-400",
  },
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "indigo",
}: StatsCardProps) {
  const colors = colorMap[color];
  return (
    <div className="rounded-xl border border-[#2a2d3e] bg-[#1a1d27] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            {title}
          </p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", colors.bg)}>
          <Icon className={cn("w-5 h-5", colors.icon)} />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          <span
            className={cn(
              "text-xs font-medium",
              trend.value >= 0 ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {trend.value >= 0 ? "+" : ""}{trend.value}%
          </span>
          <span className="text-xs text-gray-500">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
