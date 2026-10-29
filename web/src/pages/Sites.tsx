import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ApiError, Site, api } from "@/lib/api";

export function Sites({ onLogout }: { onLogout: () => void }) {
  const nav = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [httpEnabled, setHttpEnabled] = useState(true);
  const [spa, setSpa] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api.sites();
      setSites(data.sites || []);
      setError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        nav("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "failed to load");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const site = await api.createSite({
        slug,
        name,
        short_code: shortCode || undefined,
        http_enabled: httpEnabled,
        spa_fallback: spa,
      });
      setOpen(false);
      setSlug("");
      setName("");
      setShortCode("");
      nav(`/sites/${site.slug}`);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? "slug or short code already exists" : err instanceof Error ? err.message : "create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">pubit</h1>
          <p className="text-sm text-muted-foreground">Sites</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpen(true)}>New site</Button>
          <Button variant="outline" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </header>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Short</th>
              <th className="px-4 py-3 font-medium">HTTP</th>
              <th className="px-4 py-3 font-medium">Password</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {sites.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  No sites yet.
                </td>
              </tr>
            )}
            {sites.map((s) => (
              <tr key={s.slug} className="border-t hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link className="font-medium hover:underline" to={`/sites/${s.slug}`}>
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{s.slug}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.short_code || "—"}</td>
                <td className="px-4 py-3">{s.http_enabled ? "on" : "off"}</td>
                <td className="px-4 py-3">{s.has_password ? "yes" : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.updated_at.replace("T", " ").replace("Z", "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New site</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={create}>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="hello" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hello" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="short">Short code</Label>
              <Input id="short" value={shortCode} onChange={(e) => setShortCode(e.target.value)} placeholder="auto if empty" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="http">HTTP enabled</Label>
              <Switch id="http" checked={httpEnabled} onCheckedChange={setHttpEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="spa">SPA fallback</Label>
              <Switch id="spa" checked={spa} onCheckedChange={setSpa} />
            </div>
            <Button className="w-full" type="submit" disabled={busy}>
              Create
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
