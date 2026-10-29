import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { Login } from "@/pages/Login";
import { SiteDetail } from "@/pages/SiteDetail";
import { Sites } from "@/pages/Sites";

export function App() {
  const loc = useLocation();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setReady(true));
  }, [loc.pathname]);

  async function logout() {
    await api.logout();
    setAuthed(false);
  }

  if (!ready) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <Routes>
      <Route path="/login" element={authed ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={authed ? <Sites onLogout={logout} /> : <Navigate to="/login" replace />} />
      <Route
        path="/sites/:slug"
        element={authed ? <SiteDetail onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
