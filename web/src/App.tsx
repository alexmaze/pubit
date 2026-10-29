import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { Login } from "@/pages/Login";
import { SiteDetail } from "@/pages/SiteDetail";
import { Sites } from "@/pages/Sites";

export function App() {
  const loc = useLocation();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [agentToken, setAgentToken] = useState("");

  useEffect(() => {
    api
      .me()
      .then((me) => {
        setAuthed(true);
        setBaseUrl(me.base_url);
        setAgentToken(me.agent_token);
      })
      .catch(() => setAuthed(false))
      .finally(() => setReady(true));
  }, [loc.pathname]);

  async function logout() {
    await api.logout();
    setAuthed(false);
  }

  if (!ready) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <TooltipProvider delayDuration={250}>
      <Routes>
        <Route path="/login" element={authed ? <Navigate to="/" replace /> : <Login />} />
        <Route
          path="/"
          element={
            authed ? (
              <AppShell baseUrl={baseUrl} agentToken={agentToken} onLogout={logout}>
                <Sites baseUrl={baseUrl} />
              </AppShell>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/sites/:slug"
          element={
            authed ? (
              <AppShell full baseUrl={baseUrl} agentToken={agentToken} onLogout={logout}>
                <SiteDetail baseUrl={baseUrl} />
              </AppShell>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </TooltipProvider>
  );
}
