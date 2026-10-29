import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import { isZipFile } from "@/lib/files";
import { cn } from "@/lib/utils";

export function NewSiteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const nav = useNavigate();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [zip, setZip] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setSlug("");
    setName("");
    setDescription("");
    setAuthor("");
    setShortCode("");
    setZip(null);
    setError("");
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const site = await api.createSite({
        slug,
        name,
        description: description || undefined,
        author: author || undefined,
        short_code: shortCode || undefined,
      });
      if (zip) {
        await api.importZip(site.slug, zip);
      }
      toast.success("Site created");
      reset();
      onOpenChange(false);
      nav(`/sites/${site.slug}`);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? "Slug or short code already exists" : err instanceof Error ? err.message : "create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New site</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={create}>
          <div className="space-y-2">
            <Label htmlFor="new-slug">Slug</Label>
            <Input id="new-slug" autoFocus required value={slug} placeholder="hello" onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-name">Name</Label>
            <Input id="new-name" value={name} placeholder="defaults to slug" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-author">Author</Label>
            <Input
              id="new-author"
              value={author}
              placeholder="e.g. Cursor on Alex's MacBook"
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-description">Description</Label>
            <Textarea
              id="new-description"
              className="min-h-[72px]"
              value={description}
              placeholder="Requirement or feature summary (shown in admin only)"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-short">Short code</Label>
            <Input id="new-short" value={shortCode} placeholder="auto if empty" onChange={(e) => setShortCode(e.target.value)} />
          </div>
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground transition-colors",
              drag ? "border-foreground bg-muted/60" : "hover:bg-muted/40",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const file = e.dataTransfer.files[0];
              if (file && isZipFile(file)) setZip(file);
              else toast.error("Drop a .zip to import, or leave empty");
            }}
          >
            <input
              className="hidden"
              type="file"
              accept=".zip"
              onChange={(e) => setZip(e.target.files?.[0] || null)}
            />
            <span className="font-medium text-foreground">{zip ? zip.name : "Start empty or drop a zip"}</span>
            <span className="mt-1 text-xs">Optional build archive to extract on create</span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create site"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
