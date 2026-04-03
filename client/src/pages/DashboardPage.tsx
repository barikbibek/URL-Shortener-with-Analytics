// src/pages/DashboardPage.tsx

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { urlApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { Url } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Link2, Copy, BarChart2, Trash2, LogOut,
  Plus, ExternalLink, CheckCheck, ToggleLeft, ToggleRight
} from "lucide-react";
import { copyToClipboard, truncateUrl, formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const [urls, setUrls] = useState<Url[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form state
  const [originalUrl, setOriginalUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Copy feedback: tracks which URL was just copied
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const loadUrls = useCallback(async () => {
    try {
      const data = await urlApi.list();
      setUrls(data.urls);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load URLs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUrls();
  }, [loadUrls]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      await urlApi.create({
        originalUrl,
        customAlias: customAlias || undefined,
      });
      setOriginalUrl("");
      setCustomAlias("");
      loadUrls(); // refresh list
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create URL");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy(url: Url) {
    const shortUrl = `${window.location.origin}/r/${url.shortCode}`;
    const ok = await copyToClipboard(shortUrl);
    if (ok) {
      setCopiedId(url.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  async function handleToggle(url: Url) {
    try {
      await urlApi.update(url.id, { isActive: !url.isActive });
      loadUrls();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(urlId: string) {
    if (!confirm("Deactivate this URL?")) return;
    try {
      await urlApi.delete(urlId);
      loadUrls();
    } catch (err) {
      console.error(err);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary rounded-lg p-1.5">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900">10xLab Links</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{total}</div>
              <div className="text-sm text-muted-foreground">Total URLs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {urls.filter((u) => u.isActive).length}
              </div>
              <div className="text-sm text-muted-foreground">Active URLs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {urls.reduce((sum, u) => sum + (u._count?.clicks ?? 0), 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Clicks</div>
            </CardContent>
          </Card>
        </div>

        {/* Create URL form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Shorten a URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="https://your-long-url.com/path?query=params"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                required
                className="flex-1"
              />
              <Input
                placeholder="custom-alias (optional)"
                value={customAlias}
                onChange={(e) => setCustomAlias(e.target.value)}
                className="sm:w-48"
              />
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Shorten"}
              </Button>
            </form>
            {createError && (
              <p className="mt-2 text-sm text-destructive">{createError}</p>
            )}
          </CardContent>
        </Card>

        {/* URL list */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Your URLs</h2>

          {loading && (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          {!loading && urls.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No URLs yet. Create your first short link above!
              </CardContent>
            </Card>
          )}

          {urls.map((url) => (
            <Card key={url.id} className={!url.isActive ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">

                  {/* URL info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-primary">
                        /r/{url.shortCode}
                      </span>
                      <Badge variant={url.isActive ? "success" : "secondary"}>
                        {url.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {url._count && (
                        <span className="text-xs text-muted-foreground">
                          {url._count.clicks} clicks
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {truncateUrl(url.originalUrl)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {formatDate(url.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {/* Copy short URL */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(url)}
                      title="Copy short URL"
                    >
                      {copiedId === url.id
                        ? <CheckCheck className="w-4 h-4 text-green-600" />
                        : <Copy className="w-4 h-4" />
                      }
                    </Button>

                    {/* Open original URL */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(url.originalUrl, "_blank")}
                      title="Open original URL"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>

                    {/* Analytics */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/analytics/${url.id}`)}
                      title="View analytics"
                    >
                      <BarChart2 className="w-4 h-4" />
                    </Button>

                    {/* Toggle active */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggle(url)}
                      title={url.isActive ? "Deactivate" : "Activate"}
                    >
                      {url.isActive
                        ? <ToggleRight className="w-4 h-4 text-green-600" />
                        : <ToggleLeft className="w-4 h-4" />
                      }
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(url.id)}
                      title="Delete URL"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}