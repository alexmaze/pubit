import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CopyRow } from "@/components/CopyRow";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { copyText } from "@/lib/utils";

export function AgentSetup({
  open,
  onOpenChange,
  baseUrl,
  agentToken,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  baseUrl: string;
  agentToken: string;
}) {
  const [showToken, setShowToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const skillUrl = `${baseUrl}/skill.md`;
  const prompt = `Install the Pubit skill from ${skillUrl} into your skills directory and configure PUBIT_BASE_URL=${baseUrl} (plus PUBIT_AGENT_TOKEN).`;

  async function copyToken() {
    await copyText(agentToken);
    setCopiedToken(true);
    toast.success("Token copied");
    window.setTimeout(() => setCopiedToken(false), 1200);
  }

  async function copyPrompt() {
    await copyText(prompt);
    setCopiedPrompt(true);
    toast.success("Prompt copied");
    window.setTimeout(() => setCopiedPrompt(false), 1200);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Agent Setup</SheetTitle>
          <SheetDescription>Send the prompt below to your AI agent to install the Pubit skill.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Prompt for your agent</p>
            <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-foreground">{prompt}</div>
            <Button type="button" variant="secondary" className="w-full" onClick={() => void copyPrompt()}>
              {copiedPrompt ? <Check /> : <Copy />}
              Copy prompt for agent
            </Button>
          </div>

          <CopyRow label="PUBIT_BASE_URL" value={baseUrl} />

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">PUBIT_AGENT_TOKEN</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-2.5 py-1.5 font-mono text-xs">
                {showToken ? agentToken : "•".repeat(Math.max(12, Math.min(24, agentToken.length || 12)))}
              </code>
              <Button
                type="button"
                size="icon"
                variant="outline"
                title={showToken ? "Hide token" : "Show token"}
                onClick={() => setShowToken((v) => !v)}
              >
                {showToken ? <EyeOff /> : <Eye />}
              </Button>
              <Button type="button" size="icon" variant="outline" title="Copy token" onClick={() => void copyToken()}>
                {copiedToken ? <Check /> : <Copy />}
              </Button>
            </div>
          </div>

          <CopyRow label="Skill URL" value={skillUrl} />
          <CopyRow label="WebDAV URL pattern" value={`${baseUrl}/dav/{slug}/`} />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
