import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { File, Folder, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, FileEntry, Site, api } from "@/lib/api";

export function SiteDetail({ onLogout }: { onLogout: () => void }) {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [httpEnabled, setHttpEnabled] = useState(true);
  const [spa, setSpa] = useState(false);
  const [dir, setDir] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [binary, setBinary] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadSite() {
    const s = await api.getSite(slug);
    setSite(s);
    setName(s.name);
    setShortCode(s.short_code);
    setHttpEnabled(s.http_enabled);
    setSpa(s.spa_fallback);
    setPassword("");
    setClearPassword(false);
  }

  async function loadFiles(path = dir) {
    const data = await api.files(slug, path);
    setEntries(data.entries || []);
  }

  useEffect(() => {
    (async () => {
      try {
        await loadSite();
        await loadFiles("");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) nav("/login");
        else if (err instanceof ApiError && err.status === 404) setError("site not found");
        else setError(err instanceof Error ? err.message : "failed to load");
      }
    })();
  }, [slug]);

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const s = await api.updateSite(slug, {
        name,
        short_code: shortCode,
        http_enabled: httpEnabled,
        spa_fallback: spa,
        password: password || undefined,
        clear_password: clearPassword,
      });
      setSite(s);
      setPassword("");
      setClearPassword(false);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? "short code already exists" : err instanceof Error ? err.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  async function openEntry(entry: FileEntry) {
    if (entry.dir) {
      setDir(entry.path);
      setSelected(null);
      setContent("");
      setBinary(false);
      try {
        await loadFiles(entry.path);
      } catch (err) {
        setError(err instanceof Error ? err.message : "list failed");
      }
      return;
    }
    setSelected(entry.path);
    try {
      const data = await api.content(slug, entry.path);
      setContent(data.content);
      setBinary(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 415) {
        setBinary(true);
        setContent("");
      } else {
        setError(err instanceof Error ? err.message : "read failed");
      }
    }
  }

  async function goUp() {
    const next = dir.split("/").slice(0, -1).join("/");
    setDir(next);
    setSelected(null);
    await loadFiles(next);
  }

  async function saveFile() {
    if (!selected) return;
    setBusy(true);
    try {
      await api.writeFile(slug, selected, content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "write failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selected && !dir) return;
    const path = selected || dir;
    if (!confirm(`Delete ${path}?`)) return;
    try {
      await api.deleteFile(slug, path);
      setSelected(null);
      setContent("");
      await loadFiles(dir);
    } catch (err) {
      setError(err instanceof Error ? err.message : "delete failed");
    }
  }

  async function onUpload(files: FileList | null, zip = false) {
    if (!files?.length) return;
    try {
      if (zip) {
        await api.importZip(slug, files[0]);
      } else {
        await api.upload(slug, files[0], dir ? dir + "/" : "");
      }
      await loadFiles(dir);
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    }
  }

  async function mkdir() {
    const name = prompt("Folder name");
    if (!name) return;
    const path = dir ? `${dir}/${name}` : name;
    try {
      await api.mkdir(slug, path);
      await loadFiles(dir);
    } catch (err) {
      setError(err instanceof Error ? err.message : "mkdir failed");
    }
  }

  async function newFile() {
    const name = prompt("File name");
    if (!name) return;
    const path = dir ? `${dir}/${name}` : name;
    try {
      await api.writeFile(slug, path, "");
      await loadFiles(dir);
      setSelected(path);
      setContent("");
      setBinary(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "create failed");
    }
  }

  async function removeSite() {
    if (!confirm(`Delete site ${slug}? This cannot be undone.`)) return;
    await api.deleteSite(slug);
    nav("/");
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  if (!site && !error) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-muted-foreground hover:underline">
            ← Sites
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{site?.name || slug}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onLogout}>
            Sign out
          </Button>
          <Button variant="destructive" onClick={removeSite}>
            Delete site
          </Button>
        </div>
      </header>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {site && (
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={saveSettings}>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Short code</Label>
                <Input value={shortCode} onChange={(e) => setShortCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>New password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={site.has_password ? "unchanged" : "optional"} />
              </div>
              <div className="flex items-end gap-6 pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={httpEnabled} onCheckedChange={setHttpEnabled} />
                  HTTP
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={spa} onCheckedChange={setSpa} />
                  SPA fallback
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={clearPassword} onCheckedChange={setClearPassword} />
                  Remove password
                </label>
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary" className="cursor-pointer font-mono" onClick={() => copy(site.url)}>
                  {site.url}
                </Badge>
                {site.short_url && (
                  <Badge variant="outline" className="cursor-pointer font-mono" onClick={() => copy(site.short_url || "")}>
                    {site.short_url}
                  </Badge>
                )}
                <Badge variant="outline" className="cursor-pointer font-mono" onClick={() => copy(site.dav_url)}>
                  {site.dav_url}
                </Badge>
              </div>
              <div>
                <Button type="submit" disabled={busy}>
                  Save
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Files {dir && <span className="font-mono text-sm font-normal text-muted-foreground">/{dir}</span>}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {dir && (
              <Button variant="outline" size="sm" onClick={() => void goUp()}>
                Up
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => void mkdir()}>
              New folder
            </Button>
            <Button variant="outline" size="sm" onClick={() => void newFile()}>
              New file
            </Button>
            <label className="inline-flex">
              <input className="hidden" type="file" onChange={(e) => void onUpload(e.target.files)} />
              <Button variant="outline" size="sm" asChild>
                <span>Upload</span>
              </Button>
            </label>
            <label className="inline-flex">
              <input className="hidden" type="file" accept=".zip" onChange={(e) => void onUpload(e.target.files, true)} />
              <Button variant="outline" size="sm" asChild>
                <span>Import zip</span>
              </Button>
            </label>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/sites/${slug}/export`}>Export zip</a>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void removeSelected()} disabled={!selected}>
              <Trash2 />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border">
            {entries.length === 0 && <p className="p-4 text-sm text-muted-foreground">Empty folder.</p>}
            {entries.map((e) => (
              <button
                key={e.path}
                className={`flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50 ${selected === e.path ? "bg-muted" : ""}`}
                onClick={() => void openEntry(e)}
              >
                {e.dir ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />}
                <span className="font-mono">{e.name}</span>
                {!e.dir && <span className="ml-auto text-xs text-muted-foreground">{e.size}</span>}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {selected ? (
              binary ? (
                <p className="text-sm text-muted-foreground">{selected} is a binary file.</p>
              ) : (
                <>
                  <p className="font-mono text-xs text-muted-foreground">{selected}</p>
                  <Textarea className="min-h-[320px] font-mono text-xs" value={content} onChange={(e) => setContent(e.target.value)} />
                  <Button size="sm" onClick={() => void saveFile()} disabled={busy}>
                    Save file
                  </Button>
                </>
              )
            ) : (
              <p className="text-sm text-muted-foreground">Select a file to edit.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
