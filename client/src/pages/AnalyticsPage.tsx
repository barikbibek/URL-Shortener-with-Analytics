// src/pages/AnalyticsPage.tsx

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { analyticsApi, urlApi } from "@/lib/api";
import type { AnalyticsSummary, TimelinePoint, GeoPoint, DevicePoint, Url } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, MousePointerClick, Users, Globe, Smartphone,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

// Colors for the pie chart slices
const PIE_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b"];

export default function AnalyticsPage() {
  const { urlId } = useParams<{ urlId: string }>();
  const navigate = useNavigate();

  const [url, setUrl] = useState<Url | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [geo, setGeo] = useState<GeoPoint[]>([]);
  const [devices, setDevices] = useState<DevicePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!urlId) return;

    async function loadAll() {
      try {
        // Fire all requests in parallel — faster than sequential awaits
        // Promise.all resolves when ALL promises resolve, or rejects
        // if ANY of them fail.
        const [urlsData, summaryData, timelineData, geoData, devicesData] =
          await Promise.all([
            urlApi.list(),
            analyticsApi.summary(urlId!),
            analyticsApi.timeline(urlId!),
            analyticsApi.geo(urlId!),
            analyticsApi.devices(urlId!),
          ]);

        // Find this specific URL from the list
        const found = urlsData.urls.find((u) => u.id === urlId);
        setUrl(found || null);
        setSummary(summaryData);
        setTimeline(timelineData.timeline);
        setGeo(geoData.geo);
        setDevices(devicesData.devices);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, [urlId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="font-bold text-gray-900">
              Analytics — <span className="text-primary font-mono">/r/{url?.shortCode}</span>
            </h1>
            <p className="text-sm text-muted-foreground truncate max-w-md">
              {url?.originalUrl}
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── SUMMARY CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            icon={<MousePointerClick className="w-5 h-5 text-blue-500" />}
            label="Total Clicks"
            value={summary?.totalClicks ?? 0}
          />
          <SummaryCard
            icon={<Users className="w-5 h-5 text-indigo-500" />}
            label="Unique Visitors"
            value={summary?.uniqueVisitors ?? 0}
          />
          <SummaryCard
            icon={<Globe className="w-5 h-5 text-violet-500" />}
            label="Top Country"
            value={summary?.topCountries[0]?.country ?? "—"}
          />
          <SummaryCard
            icon={<Smartphone className="w-5 h-5 text-pink-500" />}
            label="Top Device"
            value={summary?.topDevices[0]?.device ?? "—"}
          />
        </div>

        {/* ── TIMELINE CHART ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clicks over time (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <EmptyState message="No click data yet" />
            ) : (
              // ResponsiveContainer makes the chart fill its parent width
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  {/* XAxis shows the date labels */}
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  {/* Tooltip shows on hover */}
                  <Tooltip
                    formatter={(value) => [value, "Clicks"]}
                    labelFormatter={(label) =>
                      new Date(label).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── GEO + DEVICES ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Top Countries — Bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clicks by Country</CardTitle>
            </CardHeader>
            <CardContent>
              {geo.length === 0 ? (
                <EmptyState message="No geo data yet" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={geo.slice(0, 8)}
                    layout="vertical"
                    margin={{ left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="country"
                      tick={{ fontSize: 11 }}
                      width={35}
                    />
                    <Tooltip formatter={(v) => [v, "Clicks"]} />
                    <Bar dataKey="clicks" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Devices — Pie chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clicks by Device</CardTitle>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <EmptyState message="No device data yet" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={devices}
                      dataKey="clicks"
                      nameKey="device"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      // Each slice gets a color from PIE_COLORS
                      label={({ device, percent }) =>
                        `${device} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {devices.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip formatter={(v) => [v, "Clicks"]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── TOP COUNTRIES TABLE ── */}
        {summary && summary.topCountries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Countries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summary.topCountries.map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-8 text-muted-foreground">
                      #{i + 1}
                    </span>
                    <span className="text-sm flex-1">{c.country || "Unknown"}</span>
                    {/* Progress bar — width is proportional to max clicks */}
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${(c.clicks / summary.topCountries[0].clicks) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-12 text-right">
                      {c.clicks}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

// ── SMALL REUSABLE COMPONENTS ──────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-2">{icon}</div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
      {message}
    </div>
  );
}