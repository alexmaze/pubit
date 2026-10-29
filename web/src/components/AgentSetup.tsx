import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CopyRow } from "@/components/CopyRow";
import { copyText } from "@/lib/utils";

export function AgentSetup({ open, onOpenChange, baseUrl }: { open: boolean; onOpenChange: (v: boolean) => void; baseUrl: string }) {
  const curlInstall = `mkdir -p ~/.cursor/skills/pubit && curl -sS "${baseUrl}/skill.md" -o ~/.cursor/skills/pubit/SKILL.md`;
  const cpInstall = "mkdir -p ~/.cursor/skills/pubit && cp skill/SKILL.md ~/.cursor/skills/pubit/SKILL.md";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Agent Setup</SheetTitle>
          <SheetDescription>Give your agent the instance URL and token, then install the skill.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <CopyRow label="PUBIT_BASE_URL" value={baseUrl} />
          <CopyRow label="WebDAV URL pattern" value={`${baseUrl}/dav/{slug}/`} />
          <CopyRow label="Install skill (curl)" value={curlInstall} />
          <CopyRow label="Install skill (local copy)" value={cpInstall} />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Set <code className="rounded bg-muted px-1">PUBIT_AGENT_TOKEN</code> in the agent environment to the same token this server was started with. The skill will stop and ask if either value is missing.
          </p>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              void copyText(curlInstall).then(() => toast.success("Install command copied"));
            }}
          >
            Copy curl install command
          </Button>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
