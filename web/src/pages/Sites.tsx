import { Copy, ExternalLink, FolderKanban, HardDrive, MoreHorizontal, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { NewSiteDialog } from "@/components/NewSiteDialog";
import { SiteFlags } from "@/components/StatusBadges";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ApiError, type Site, api } from "@/lib/api";
import { copyText, formatBytes, formatRelative, shareUrl } from "@/lib/utils";

export function Sites() {
  const nav = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const data = await api.sites();
      setSites(data.sites || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) nav("/login");
      else toast.error(err instanceof Error ? err.message : "failed to load");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sites;
    return sites.filter((site) => site.name.toLowerCase().includes(s) || site.slug.includes(s) || site.short_code.toLowerCase().includes(s));
  }, [sites, q]);

  async function toggleHttp(site: Site, next: boolean) {
    try {
      const updated = await api.updateSite(site.slug, { http_enabled: next });
      setSites((list) => list.map((item) => (item.slug === site.slug ? updated : item)));
      toast.success(next ? "HTTP enabled" : "HTTP disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "update failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
          <p className="mt-1 text-sm text-muted-foreground">Static hosts for agents and quick shares.</p>
        </div>
        <Button onClick={() => setOpen(true)}>New site</Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Filter by name, slug, or short code" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-background px-6 py-16 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="font-medium">{sites.length === 0 ? "No sites yet" : "No matches"}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {sites.length === 0 ? "Create a site, drop a zip, and share a URL." : "Try another search."}
          </p>
          {sites.length === 0 && (
            <Button className="mt-4" onClick={() => setOpen(true)}>
              New site
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((site) => (
            <article key={site.slug} className="rounded-2xl border bg-background p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <Link to={`/sites/${site.slug}`} className="text-base font-semibold tracking-tight hover:underline">
                    {site.name}
                  </Link>
                  <SiteFlags site={site} />
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{site.file_count} files</span>
                    <span className="inline-flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {formatBytes(site.byte_size || 0)}
                    </span>
                    <span>Updated {formatRelative(site.updated_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="mr-1 hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                    HTTP
                    <Switch checked={site.http_enabled} onCheckedChange={(v) => void toggleHttp(site, v)} />
                  </div>
                  <Button size="icon" variant="outline" asChild>
                    <a href={site.url} target="_blank" rel="noreferrer" title="Open site">
                      <ExternalLink />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    title="Copy share link"
                    onClick={() => void copyText(shareUrl(site)).then(() => toast.success("Share link copied"))}
                  >
                    <Copy />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => nav(`/sites/${site.slug}`)}>Open workspace</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void copyText(site.dav_url).then(() => toast.success("WebDAV copied"))}>
                        Copy WebDAV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void toggleHttp(site, !site.http_enabled)}>
                        {site.http_enabled ? "Disable HTTP" : "Enable HTTP"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <NewSiteDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
