import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PromptDialog({
  open,
  title,
  label,
  placeholder,
  confirm = "Create",
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  placeholder?: string;
  confirm?: string;
  onOpenChange: (v: boolean) => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = value.trim();
    if (!next) return;
    onSubmit(next);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="prompt-value">{label}</Label>
            <Input id="prompt-value" autoFocus value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{confirm}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
