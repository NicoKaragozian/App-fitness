import { NextResponse } from "next/server";
import { generateInsights } from "@/lib/claude";
import { getActivities, getHealthMetrics, getWeeklyStats } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your_api_key_here") {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured. Add it to .env.local" },
      { status: 503 }
    );
  }

  try {
    const [activities, healthMetrics, weeklyStats] = await Promise.all([
      getActivities(),
      getHealthMetrics(14),
      getWeeklyStats(),
    ]);
    const insights = await generateInsights(activities, healthMetrics, weeklyStats);
    return NextResponse.json(insights);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
