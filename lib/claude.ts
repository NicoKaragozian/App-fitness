import Anthropic from "@anthropic-ai/sdk";
import type { Activity, DailyHealthMetrics, WeeklyStats, InsightsResponse } from "@/types/fitness";
import { formatPace } from "@/lib/mock-data";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function summarizeActivities(activities: Activity[]) {
  return activities.map((a) => ({
    date: a.date.split("T")[0],
    name: a.name,
    distance_km: a.distance,
    duration_min: Math.round(a.duration / 60),
    avg_pace_per_km: formatPace(a.avgPace),
    avg_hr: a.avgHeartRate,
    max_hr: a.maxHeartRate,
    calories: a.calories,
    vo2max_estimate: a.vo2maxEstimate,
  }));
}

function summarizeHealth(metrics: DailyHealthMetrics[]) {
  return metrics.slice(0, 14).map((m) => ({
    date: m.date,
    body_battery: m.bodyBattery,
    sleep_score: m.sleepScore,
    sleep_hours: m.sleepHours,
    resting_hr: m.restingHeartRate,
    stress: m.stressScore,
    vo2max: m.vo2max,
  }));
}

export async function generateInsights(
  activities: Activity[],
  healthMetrics: DailyHealthMetrics[],
  weeklyStats: WeeklyStats[]
): Promise<InsightsResponse> {
  const prompt = `You are a professional running coach and data analyst. Analyze this athlete's fitness data and identify meaningful patterns, trends, and insights.

## Recent Activities (last 4 weeks)
${JSON.stringify(summarizeActivities(activities), null, 2)}

## Daily Health Metrics (last 14 days)
${JSON.stringify(summarizeHealth(healthMetrics), null, 2)}

## Weekly Stats
${JSON.stringify(weeklyStats.map((w) => ({
  week_start: w.weekStart,
  total_km: w.totalDistance,
  runs: w.totalActivities,
  avg_pace: formatPace(w.avgPace),
  avg_hr: w.avgHeartRate,
  training_load: w.trainingLoad,
})), null, 2)}

Provide your analysis as a JSON object with this exact structure:
{
  "insights": [
    {
      "type": "pattern" | "summary" | "recommendation" | "comparison",
      "title": "Short title (max 8 words)",
      "description": "Detailed insight (2-3 sentences with specific numbers)",
      "metric": "optional metric name",
      "trend": "improving" | "declining" | "stable",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "weeklySummary": "2-3 sentence natural language summary of this week",
  "weekComparison": [
    {
      "metric": "metric name",
      "current": number,
      "previous": number,
      "unit": "unit string",
      "change": percentage_change_as_number
    }
  ]
}

Generate 5-7 insights. Focus on:
1. Patterns between sleep/recovery and performance
2. Pace improvement trends
3. Heart rate adaptation (fitness gains)
4. Training load progression
5. Specific actionable recommendations

Return ONLY valid JSON, no markdown or explanation.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  try {
    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    const text = content.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(text) as InsightsResponse;
    return parsed;
  } catch {
    throw new Error("Failed to parse Claude response as JSON");
  }
}
