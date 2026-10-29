import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/utils";

export function CopyRow({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false);

  async function copy() {
    await copyText(value);
    setOk(true);
    toast.success("Copied");
    window.setTimeout(() => setOk(false), 1200);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-2.5 py-1.5 font-mono text-xs">{value}</code>
        <Button type="button" size="icon" variant="outline" onClick={() => void copy()}>
          {ok ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}
