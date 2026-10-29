import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CopyRow } from "@/components/CopyRow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, type Site, api } from "@/lib/api";
import { copyText, randomShort, shareUrl } from "@/lib/utils";

export function SharingSheet({
  site,
  baseUrl,
  open,
  onOpenChange,
  onChange,
  onDeleted,
}: {
  site: Site;
  baseUrl: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChange: (site: Site) => void;
  onDeleted?: () => void;
}) {
  const nav = useNavigate();
  const [name, setName] = useState(site.name);
  const [description, setDescription] = useState(site.description || "");
  const [author, setAuthor] = useState(site.author || "");
  const [shortCode, setShortCode] = useState(site.short_code);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [shortError, setShortError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setName(site.name);
    setDescription(site.description || "");
    setAuthor(site.author || "");
    setShortCode(site.short_code);
  }, [site.name, site.description, site.author, site.short_code, open]);

  async function patch(body: Parameters<typeof api.updateSite>[1], ok = "Saved") {
    setBusy(true);
    try {
      const next = await api.updateSite(site.slug, body);
      onChange(next);
      setPassword("");
      setShortError("");
      toast.success(ok);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setShortError("That short code is already taken");
        toast.error("Short code conflict");
      } else {
        toast.error(err instanceof Error ? err.message : "update failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    await patch({ name, description, author, short_code: shortCode }, "Site details saved");
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Access & sharing</SheetTitle>
            <SheetDescription>Metadata, HTTP, password, short link, and agent connection for this site.</SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-6">
            <form className="space-y-3" onSubmit={saveMeta}>
              <div className="space-y-2">
                <Label htmlFor="site-name">Name</Label>
                <Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-author">Author</Label>
                <Input
                  id="site-author"
                  value={author}
                  placeholder="e.g. Cursor on Alex's MacBook"
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-description">Description</Label>
                <Textarea
                  id="site-description"
                  className="min-h-[72px]"
                  value={description}
                  placeholder="Requirement or feature summary (shown in admin only)"
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" disabled={busy}>
                Save details
              </Button>
            </form>

            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">HTTP public access</p>
                  <p className="mt-1 text-xs text-muted-foreground">When off, browsers get 404. WebDAV and the agent API still work.</p>
                </div>
                <Switch checked={site.http_enabled} onCheckedChange={(v) => void patch({ http_enabled: v }, v ? "HTTP on" : "HTTP off")} />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">SPA fallback</p>
                  <p className="mt-1 text-xs text-muted-foreground">Unknown paths serve index.html for client-side routing.</p>
                </div>
                <Switch checked={site.spa_fallback} onCheckedChange={(v) => void patch({ spa_fallback: v }, v ? "SPA on" : "SPA off")} />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Short link</Label>
              <div className="flex gap-2">
                <Input value={shortCode} onChange={(e) => setShortCode(e.target.value)} placeholder="abc123" />
                <Button type="button" variant="outline" onClick={() => setShortCode(randomShort())}>
                  Generate
                </Button>
              </div>
              {shortError && <p className="text-xs text-destructive">{shortError}</p>}
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={busy} onClick={() => void patch({ short_code: shortCode }, "Short link saved")}>
                  Save short link
                </Button>
                {site.short_url && (
                  <Button type="button" size="sm" variant="outline" onClick={() => void copyText(site.short_url || "").then(() => toast.success("Copied"))}>
                    Copy /s/{site.short_code}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Password protection</p>
                <span className="text-xs text-muted-foreground">{site.has_password ? "Protected" : "Public"}</span>
              </div>
              <Input type="password" value={password} placeholder={site.has_password ? "new password" : "set a password"} onChange={(e) => setPassword(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={busy || !password} onClick={() => void patch({ password }, "Password set")}>
                  {site.has_password ? "Change password" : "Set password"}
                </Button>
                {site.has_password && (
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void patch({ clear_password: true }, "Password removed")}>
                    Remove password
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const text = password
                      ? `${shareUrl(site)}\nPassword: ${password}`
                      : site.has_password
                        ? `${shareUrl(site)}\nPassword protected`
                        : shareUrl(site);
                    void copyText(text).then(() => toast.success("Share text copied"));
                  }}
                >
                  Copy share text
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Agent / WebDAV</p>
              <CopyRow label="WebDAV" value={site.dav_url} />
              <CopyRow
                label="curl upload"
                value={`curl -sS -u "agent:$PUBIT_AGENT_TOKEN" -T index.html "${site.dav_url}index.html"`}
              />
              <CopyRow
                label="zip import"
                value={`curl -sS -X POST "${baseUrl}/api/sites/${site.slug}/import" -H "Authorization: Bearer $PUBIT_AGENT_TOKEN" -F file=@dist.zip`}
              />
            </div>

            <div className="rounded-xl border border-destructive/30 p-4">
              <p className="text-sm font-medium text-destructive">Danger zone</p>
              <p className="mt-1 text-xs text-muted-foreground">Delete this site and all of its files.</p>
              <Button className="mt-3" variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete site
              </Button>
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {site.slug}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the site metadata and every file under it. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void api.deleteSite(site.slug).then(() => {
                  toast.success("Site deleted");
                  onOpenChange(false);
                  if (onDeleted) onDeleted();
                  else nav("/");
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
