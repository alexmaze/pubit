import { Globe, Lock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Site } from "@/lib/api";
import { cn } from "@/lib/utils";

export function LiveStatus({ site, className }: { site: Site; className?: string }) {
  if (site.http_enabled) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700", className)}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Online
      </span>
    );
  }
  return (
    <Badge variant="secondary" className={cn("font-normal", className)}>
      HTTP disabled
    </Badge>
  );
}

export function SiteFlags({ site }: { site: Site }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <LiveStatus site={site} />
      {site.has_password && (
        <Badge variant="outline" className="gap-1 font-normal">
          <Lock className="h-3 w-3" />
          Protected
        </Badge>
      )}
      {site.spa_fallback && (
        <Badge variant="outline" className="gap-1 font-normal">
          <Sparkles className="h-3 w-3" />
          SPA
        </Badge>
      )}
      <Badge variant="secondary" className="font-mono font-normal">
        /{site.slug}/
      </Badge>
    </div>
  );
}

export function SlugBadge({ slug }: { slug: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
      <Globe className="h-3 w-3" />
      /{slug}/
    </span>
  );
}
