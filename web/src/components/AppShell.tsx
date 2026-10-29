import { LogOut, Sparkles } from "lucide-react";
import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Toaster } from "sonner";
import { AgentSetup } from "@/components/AgentSetup";
import { Button } from "@/components/ui/button";

export function AppShell({
  children,
  baseUrl,
  onLogout,
  full,
}: {
  children: ReactNode;
  baseUrl: string;
  onLogout: () => void;
  full?: boolean;
}) {
  const [setup, setSetup] = useState(false);

  return (
    <div className={full ? "flex h-screen flex-col overflow-hidden bg-muted/30" : "min-h-screen bg-muted/30"}>
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-xs font-semibold text-background">
              p
            </span>
            <span className="text-[15px] font-semibold tracking-tight">pubit</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSetup(true)}>
              <Sparkles />
              Agent Setup
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut />
              Logout
            </Button>
          </div>
        </div>
      </header>
      <div className={full ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "mx-auto w-full max-w-5xl px-4 py-8"}>{children}</div>
      <AgentSetup open={setup} onOpenChange={setSetup} baseUrl={baseUrl} />
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
