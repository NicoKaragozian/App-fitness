import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import {
  Activity,
  LayoutDashboard,
  TrendingUp,
  Brain,
} from "lucide-react";

async function getGarminStatus(): Promise<"connected" | "disconnected" | "mock"> {
  if (process.env.USE_GARMIN !== "true") return "mock";
  try {
    const res = await fetch(`${process.env.GARMIN_SERVICE_URL}/health-check`, {
      next: { revalidate: 30 },
    });
    const data = await res.json();
    return data.authenticated ? "connected" : "disconnected";
  } catch {
    return "disconnected";
  }
}

export const metadata: Metadata = {
  title: "FitTrack — Garmin + AI",
  description: "Personal fitness analytics powered by Claude AI",
};

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/activities", icon: Activity, label: "Activities" },
  { href: "/trends", icon: TrendingUp, label: "Trends" },
  { href: "/insights", icon: Brain, label: "AI Insights" },
];

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const garminStatus = await getGarminStatus();

  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 flex-shrink-0 flex flex-col border-r border-[#2a2d3e] bg-[#1a1d27]">
          {/* Logo */}
          <div className="px-6 py-5 border-b border-[#2a2d3e]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-white">FitTrack</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Garmin + AI Analytics</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#2a2d3e] transition-colors group"
              >
                <Icon className="w-5 h-5 group-hover:text-indigo-400 transition-colors" />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-[#2a2d3e] space-y-3">
            {/* Garmin connection status */}
            <div className="flex items-center gap-2 px-1">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  garminStatus === "connected"
                    ? "bg-emerald-400"
                    : garminStatus === "disconnected"
                    ? "bg-red-400"
                    : "bg-gray-500"
                }`}
              />
              <span
                className={`text-xs font-medium ${
                  garminStatus === "connected"
                    ? "text-emerald-400"
                    : garminStatus === "disconnected"
                    ? "text-red-400"
                    : "text-gray-500"
                }`}
              >
                {garminStatus === "connected"
                  ? "Garmin Connected"
                  : garminStatus === "disconnected"
                  ? "Garmin Offline"
                  : "Mock Data"}
              </span>
            </div>
            {/* User */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-indigo-400">NK</span>
              </div>
              <div>
                <p className="text-xs font-medium text-white">Nico K.</p>
                <p className="text-xs text-gray-500">nico.karagozian@gmail.com</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-[#0f1117]">
          {children}
        </main>
      </body>
    </html>
  );
}
