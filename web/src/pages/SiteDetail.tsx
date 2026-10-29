import { Copy, Download, ExternalLink, FolderPlus, FilePlus, Settings2, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { FileInspector } from "@/components/FileInspector";
import { FileTree } from "@/components/FileTree";
import { PromptDialog } from "@/components/PromptDialog";
import { SharingSheet } from "@/components/SharingSheet";
import { SiteFlags } from "@/components/StatusBadges";
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
import { ApiError, type FileEntry, type Site, api } from "@/lib/api";
import { isZipFile, joinPath } from "@/lib/files";
import { cn, copyText, shareUrl } from "@/lib/utils";

export function SiteDetail({ baseUrl }: { baseUrl: string }) {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dir, setDir] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [newFile, setNewFile] = useState(false);
  const [newFolder, setNewFolder] = useState(false);
  const [deletePath, setDeletePath] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const loadSite = useCallback(async () => {
    const next = await api.getSite(slug);
    setSite(next);
  }, [slug]);

  const loadTree = useCallback(async () => {
    const data = await api.tree(slug);
    setEntries(data.entries || []);
    setSite((prev) => (prev ? { ...prev, file_count: data.file_count, byte_size: data.byte_size } : prev));
  }, [slug]);

  useEffect(() => {
    (async () => {
      try {
        await loadSite();
        await loadTree();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) nav("/login");
        else if (err instanceof ApiError && err.status === 404) toast.error("Site not found");
        else toast.error(err instanceof Error ? err.message : "failed to load");
      }
    })();
  }, [loadSite, loadTree, nav]);

  const crumbs = useMemo(() => (dir ? dir.split("/") : []), [dir]);

  function onSelect(entry: FileEntry) {
    if (entry.dir) {
      setDir(entry.path);
      setSelected(null);
      return;
    }
    setSelected(entry.path);
    const parent = entry.path.split("/").slice(0, -1).join("/");
    setDir(parent);
  }

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function handleFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (files.length === 1 && isZipFile(files[0])) {
      await api.importZip(slug, files[0]);
      toast.success("Zip imported");
    } else {
      for (const file of files) {
        await api.upload(slug, file, dir ? dir + "/" : "");
      }
      toast.success(files.length === 1 ? "Uploaded" : `${files.length} files uploaded`);
    }
    await loadTree();
    await loadSite();
  }

  async function exportZip() {
    const blob = await api.exportZip(slug);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Export started");
  }

  if (!site) return <div className="p-6 text-sm text-muted-foreground">Loading workspace…</div>;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              <Link to="/" className="hover:underline">
                Sites
              </Link>
              <span className="mx-1">/</span>
              <span className="font-mono text-foreground">{site.slug}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-semibold tracking-tight">{site.name}</h1>
              <SiteFlags site={site} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={site.url} target="_blank" rel="noreferrer">
                <ExternalLink />
                Preview
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void copyText(shareUrl(site)).then(() => toast.success("Share URL copied"))}>
              <Copy />
              Copy share URL
            </Button>
            <Button size="sm" onClick={() => setSharing(true)}>
              <Settings2 />
              Sharing
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid min-h-0 w-full max-w-[1400px] flex-1 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)]">
        <section
          className={cn("flex min-h-0 flex-col border-r bg-background", drag && "ring-2 ring-inset ring-foreground/20")}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files).catch((err) => toast.error(err.message));
          }}
        >
          <div className="flex flex-wrap items-center gap-1 border-b px-2 py-2">
            <Button size="sm" variant="ghost" onClick={() => setNewFile(true)}>
              <FilePlus />
              File
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewFolder(true)}>
              <FolderPlus />
              Folder
            </Button>
            <Button size="sm" variant="ghost" onClick={() => uploadRef.current?.click()}>
              <Upload />
              Upload
            </Button>
            <Button size="sm" variant="ghost" onClick={() => zipRef.current?.click()}>
              Import
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void exportZip()}>
              <Download />
              Export
            </Button>
            <Button size="icon" variant="ghost" disabled={!selected} onClick={() => selected && setDeletePath(selected)}>
              <Trash2 />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1 border-b px-3 py-1.5 text-[11px] text-muted-foreground">
            <button type="button" className="hover:text-foreground" onClick={() => { setDir(""); setSelected(null); }}>
              /
            </button>
            {crumbs.map((part, i) => {
              const path = crumbs.slice(0, i + 1).join("/");
              return (
                <span key={path}>
                  <span className="mx-0.5">/</span>
                  <button type="button" className="hover:text-foreground" onClick={() => { setDir(path); setSelected(null); setExpanded((s) => new Set(s).add(path)); }}>
                    {part}
                  </button>
                </span>
              );
            })}
            {drag && <span className="ml-auto text-foreground">Drop to upload</span>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <FileTree entries={entries} selected={selected} expanded={expanded} onSelect={onSelect} onToggle={toggle} />
          </div>
          <input ref={uploadRef} className="hidden" type="file" multiple onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ""; }} />
          <input ref={zipRef} className="hidden" type="file" accept=".zip" onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ""; }} />
        </section>

        <section className="min-h-0 bg-background">
          <FileInspector site={site} selected={selected} dir={dir} onSaved={() => void loadTree()} />
        </section>
      </div>

      <SharingSheet site={site} baseUrl={baseUrl} open={sharing} onOpenChange={setSharing} onChange={setSite} />
      <PromptDialog
        open={newFile}
        title="New file"
        label="File name"
        placeholder="index.html"
        onOpenChange={setNewFile}
        onSubmit={(name) => {
          const path = joinPath(dir, name);
          void api.writeFile(slug, path, "").then(async () => {
            await loadTree();
            setSelected(path);
            toast.success("File created");
          });
        }}
      />
      <PromptDialog
        open={newFolder}
        title="New folder"
        label="Folder name"
        placeholder="assets"
        onOpenChange={setNewFolder}
        onSubmit={(name) => {
          const path = joinPath(dir, name);
          void api.mkdir(slug, path).then(async () => {
            setExpanded((s) => new Set(s).add(path));
            await loadTree();
            toast.success("Folder created");
          });
        }}
      />
      <AlertDialog open={!!deletePath} onOpenChange={(v) => !v && setDeletePath(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletePath}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the file from the site.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deletePath) return;
                void api.deleteFile(slug, deletePath).then(async () => {
                  setSelected(null);
                  setDeletePath(null);
                  await loadTree();
                  toast.success("Deleted");
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
