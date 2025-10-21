// App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { checkGroup } from "./api/users"; 
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import AdminHome from "./pages/AdminHome.jsx";
import UpdateProfile from "./pages/UpdateProfile.jsx";
import NavBar from "./components/NavBar.jsx";
import { useLocation, useNavigate } from "react-router-dom";


function useRoleFlags(user) {
  const [flags, setFlags] = useState({ isAdmin: false, isProjectSide: false, isOther: true });
  const [loading, setLoading] = useState(true);

  // Build a stable key from whatever field your user uses for groups
  const groupsRaw = user?.groups ?? user?.usergroups ?? user?.usergroup ?? [];
  const groupsArr = Array.isArray(groupsRaw)
    ? groupsRaw
    : String(groupsRaw).split(",").map(s => s.trim()).filter(Boolean);
  // normalise to lowercase + sorted so order doesn’t prevent re-runs
  const groupsKey = groupsArr.map(g => g.toLowerCase()).sort().join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const username = String(user?.username || "").trim();
        if (!username) {
          if (!cancelled) setFlags({ isAdmin: false, isProjectSide: false, isOther: true });
          return;
        }
        const [isAdmin, isPM, isPL, isDev] = await Promise.all([
          checkGroup(username, "admin"),
          checkGroup(username, "project manager"),
          checkGroup(username, "project lead"),
          checkGroup(username, "dev team"),
        ]);
        if (!cancelled) {
          const isProjectSide = isPM || isPL || isDev;
          const isOther = !isAdmin && !isProjectSide;
          setFlags({ isAdmin, isProjectSide, isOther });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // 🔑 Re-run when username OR normalised groups change
  }, [user?.username, groupsKey]);

  return { ...flags, loading };
}


function homeForRoles(flags) {
  if (flags.isAdmin) return "/admin";
  if (flags.isProjectSide) return "/";
  if (flags.isOther) return "/";
  return "/login";
}

function RoleHomeRedirect() {
  const { user } = useAuth();
  const { loading, ...flags } = useRoleFlags(user);
  if (loading) return <div className="p-6">Checking roles…</div>;
  return <Navigate to={homeForRoles(flags)} replace />;
}

function AdminAutoRedirect() {
  const { ready, isAuthenticated, user } = useAuth();
  const { loading, isAdmin } = useRoleFlags(user); // <- uses checkGroup under the hood
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready || loading) return;
    if (!isAuthenticated) return; // login guard handles this
    if (!isAdmin && location.pathname.startsWith("/admin")) {
      navigate("/", { replace: true });
    }
  }, [ready, loading, isAuthenticated, isAdmin, location.pathname, navigate]);

  return null;
}


function ProtectedRoutes({ allow, children }) {
  const { ready, isAuthenticated, user } = useAuth();
  const { loading, ...rf } = useRoleFlags(user);

  if (!ready) return <div className="p-6">Checking session…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (loading) return <div className="p-6">Authorising…</div>;

  const ok =
    (allow?.includes("admin") && rf.isAdmin) ||
    (allow?.includes("project") && rf.isProjectSide) ||
    (allow?.includes("other") && rf.isOther);

  return ok ? children : <Navigate to={homeForRoles(rf)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
      <AdminAutoRedirect />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoutes allow={["admin"]}>
                <>
                  <NavBar />
                  <AdminHome />
                </>
              </ProtectedRoutes>
            }
          />

          <Route
            path="/admin/profile"
            element={
              <ProtectedRoutes allow={["admin"]}>
                <>
                  <NavBar />
                  <UpdateProfile />
                </>
              </ProtectedRoutes>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoutes allow={["project", "other"]}>
                <>
                  <NavBar />
                  <Home />
                </>
              </ProtectedRoutes>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoutes allow={["project", "other"]}>
                <>
                  <NavBar />
                  <UpdateProfile />
                </>
              </ProtectedRoutes>
            }
          />



          <Route path="*" element={<RoleHomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
