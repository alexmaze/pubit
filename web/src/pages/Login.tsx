import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";

export function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(username, password);
      nav("/");
    } catch (err) {
      setError(err instanceof ApiError ? "Wrong username or password" : "login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-canvas flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm border-border/80 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background">
            p
          </div>
          <div>
            <CardTitle className="text-2xl tracking-tight">pubit</CardTitle>
            <CardDescription>Sign in to publish and manage static sites.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="user">Username</Label>
              <Input id="user" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pass">Password</Label>
              <Input id="pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>
            )}
            <Button className="w-full" type="submit" disabled={busy || !username || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
