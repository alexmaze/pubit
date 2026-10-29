import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
} from "lucide-react";
import { extOf, isImagePath, isTextPath } from "@/lib/files";
import type { FileEntry } from "@/lib/api";
import { cn, formatBytes } from "@/lib/utils";

function FileIcon({ entry }: { entry: FileEntry }) {
  if (entry.dir) return <Folder className="h-4 w-4 text-amber-600" />;
  const ext = extOf(entry.name);
  if (isImagePath(entry.name)) return <ImageIcon className="h-4 w-4 text-sky-600" />;
  if (ext === ".html" || ext === ".htm" || ext === ".svg") return <FileCode className="h-4 w-4 text-orange-600" />;
  if (ext === ".js" || ext === ".mjs" || ext === ".ts" || ext === ".tsx" || ext === ".css") return <FileCode className="h-4 w-4 text-blue-600" />;
  if (ext === ".json") return <FileJson className="h-4 w-4 text-lime-700" />;
  if (isTextPath(entry.name)) return <FileText className="h-4 w-4 text-muted-foreground" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function Node({
  entry,
  depth,
  selected,
  expanded,
  onSelect,
  onToggle,
}: {
  entry: FileEntry;
  depth: number;
  selected: string | null;
  expanded: Set<string>;
  onSelect: (entry: FileEntry) => void;
  onToggle: (path: string) => void;
}) {
  const open = expanded.has(entry.path);
  return (
    <div>
      <button
        type="button"
        style={{ paddingLeft: 8 + depth * 14 }}
        className={cn(
          "flex w-full items-center gap-1.5 py-1 pr-2 text-left text-[13px] hover:bg-muted/70",
          selected === entry.path && "bg-muted",
        )}
        onClick={() => {
          if (entry.dir) onToggle(entry.path);
          onSelect(entry);
        }}
      >
        {entry.dir ? (
          open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <span className="w-3.5" />
        )}
        {entry.dir && open ? <FolderOpen className="h-4 w-4 text-amber-600" /> : <FileIcon entry={entry} />}
        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
        {!entry.dir && <span className="text-[11px] text-muted-foreground">{formatBytes(entry.size)}</span>}
      </button>
      {entry.dir && open &&
        (entry.children || []).map((child) => (
          <Node
            key={child.path}
            entry={child}
            depth={depth + 1}
            selected={selected}
            expanded={expanded}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}

export function FileTree({
  entries,
  selected,
  expanded,
  onSelect,
  onToggle,
}: {
  entries: FileEntry[];
  selected: string | null;
  expanded: Set<string>;
  onSelect: (entry: FileEntry) => void;
  onToggle: (path: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="px-3 py-8 text-center text-sm text-muted-foreground">Empty site — drop files or a zip here.</p>;
  }
  return (
    <div className="py-1">
      {entries.map((entry) => (
        <Node
          key={entry.path}
          entry={entry}
          depth={0}
          selected={selected}
          expanded={expanded}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
