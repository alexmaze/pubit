import { Monitor, RefreshCw, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminPreviewUrl, publicPreviewUrl, type Site, api } from "@/lib/api";
import { isImagePath, isTextPath } from "@/lib/files";
import { cn } from "@/lib/utils";

export function FileInspector({
  site,
  selected,
  dir,
  onSaved,
}: {
  site: Site;
  selected: string | null;
  dir: string;
  onSaved: () => void;
}) {
  if (!selected) {
    return <SitePreview site={site} path="" />;
  }
  if (isImagePath(selected)) {
    return <ImagePreview site={site} path={selected} />;
  }
  if (isTextPath(selected)) {
    return <TextEditor site={site} path={selected} onSaved={onSaved} />;
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
      <p className="font-mono text-foreground">{selected}</p>
      <p>Binary file{dir ? ` in /${dir}` : ""} — download via Export ZIP or WebDAV.</p>
    </div>
  );
}

function TextEditor({ site, path, onSaved }: { site: Site; path: string; onSaved: () => void }) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const dirty = content !== saved;
  const html = path.endsWith(".html") || path.endsWith(".htm") || path.endsWith(".svg");
  const lines = useMemo(() => content.split("\n"), [content]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .content(site.slug, path)
      .then((data) => {
        if (!alive) return;
        setContent(data.content);
        setSaved(data.content);
        setPreview(false);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "read failed"))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [site.slug, path]);

  async function save() {
    await api.writeFile(site.slug, path, content);
    setSaved(content);
    toast.success("Saved");
    onSaved();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty) void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{path}</span>
          {dirty && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">unsaved</span>}
        </div>
        <div className="flex items-center gap-2">
          {html && (
            <Button size="sm" variant={preview ? "default" : "outline"} onClick={() => setPreview((v) => !v)}>
              Preview
            </Button>
          )}
          <Button size="sm" onClick={() => void save()} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>
      {preview ? (
        <iframe title="file preview" className="min-h-0 flex-1 bg-white" srcDoc={content} />
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="code-gutter select-none overflow-hidden border-r bg-muted/40 px-2 py-3 text-right text-[11px] leading-5 text-muted-foreground">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <textarea
            className="min-h-0 flex-1 resize-none bg-background px-3 py-3 font-mono text-[12px] leading-5 outline-none"
            spellCheck={false}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

function ImagePreview({ site, path }: { site: Site; path: string }) {
  const [meta, setMeta] = useState("");
  const src = adminPreviewUrl(site.slug, path);
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">{path}</div>
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[linear-gradient(45deg,#f4f4f5_25%,transparent_25%),linear-gradient(-45deg,#f4f4f5_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f4f4f5_75%),linear-gradient(-45deg,transparent_75%,#f4f4f5_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] p-6">
        <img
          src={src}
          alt={path}
          className="max-h-full max-w-full rounded-md shadow-sm"
          onLoad={(e) => {
            const img = e.currentTarget;
            setMeta(`${img.naturalWidth}×${img.naturalHeight}`);
          }}
        />
      </div>
      {meta && <div className="border-t px-3 py-2 text-xs text-muted-foreground">{meta}</div>}
    </div>
  );
}

function SitePreview({ site, path }: { site: Site; path: string }) {
  const [mobile, setMobile] = useState(false);
  const [tick, setTick] = useState(0);
  const src = `${publicPreviewUrl(site, path)}?r=${tick}`;
  const blocked = !site.http_enabled;
  const locked = site.has_password;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground">
          {publicPreviewUrl(site, path)}
        </div>
        <Button size="icon" variant="outline" onClick={() => setTick((n) => n + 1)}>
          <RefreshCw />
        </Button>
        <Button size="icon" variant={mobile ? "outline" : "default"} onClick={() => setMobile(false)}>
          <Monitor />
        </Button>
        <Button size="icon" variant={mobile ? "default" : "outline"} onClick={() => setMobile(true)}>
          <Smartphone />
        </Button>
      </div>
      {blocked && (
        <div className="border-b bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
          HTTP is off for visitors. This iframe uses an admin preview so you can still see the site. WebDAV and the API still work.
        </div>
      )}
      {locked && site.http_enabled && (
        <div className="border-b bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
          Public visitors need the site password. Preview here uses your admin session.
        </div>
      )}
      <div className="flex min-h-0 flex-1 justify-center bg-muted/20 p-4">
        <iframe
          key={src}
          title="site preview"
          src={blocked || locked ? `${adminPreviewUrl(site.slug, path)}?r=${tick}` : src}
          className={cn("h-full bg-white shadow-sm", mobile ? "w-[390px] rounded-[1.5rem] border" : "w-full rounded-md border")}
        />
      </div>
    </div>
  );
}

export { SitePreview };
