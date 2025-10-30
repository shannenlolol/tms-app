// src/App.jsx
import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";

import Login from "./pages/Login.jsx";
import Applications from "./pages/Applications.jsx";
import AdminHome from "./pages/AdminHome.jsx";
import UpdateProfile from "./pages/UpdateProfile.jsx";
import NavBar from "./components/NavBar.jsx";
import Kanban from "./pages/Kanban.jsx";

// ---- helpers to derive roles synchronously from the hydrated user ----
function normaliseGroups(raw) {
  const arr = Array.isArray(raw)
    ? raw
    : String(raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  return new Set(arr.map((s) => s.toLowerCase()));
}

function roleFlagsFromUser(user) {
  // Accept any of: user.groups, user.usergroups, user.usergroup (CSV or array)
  const set = normaliseGroups(
    user?.groups ?? user?.usergroups ?? user?.usergroup ?? []
  );
  const isAdmin = set.has("admin");
  const isProjectSide =
    set.has("project manager") || set.has("project lead") || set.has("dev team");
  const isOther = !isAdmin && !isProjectSide;
  return { isAdmin, isProjectSide, isOther };
}

function homeForRoles(flags) {
  if (flags.isAdmin) return "/admin";
  if (flags.isProjectSide) return "/kanban";
  if (flags.isOther) return "/kanban";
  return "/login";
}

// ---- role-aware fallback for "*" ----
function RoleHomeRedirect() {
  const { ready, isAuthenticated, user } = useAuth();

  if (!ready) return <div className="p-6">Checking session…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const flags = roleFlagsFromUser(user);
  return <Navigate to={homeForRoles(flags)} replace />;
}

// ---- Protected route wrapper (uses only hydrated user; no extra fetches) ----
function ProtectedRoutes({ allow, children }) {
  const { ready, isAuthenticated, user } = useAuth();
  const location = useLocation();

  // 1) Wait for auth hydration
  if (!ready) {
    return <div className="p-6">Checking session…</div>;
  }

  // 2) If not authenticated, go to login and remember where we came from
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 3) Compute roles synchronously from user payload
  const rf = roleFlagsFromUser(user);

  // 4) Authorise the roles (admin supersedes others by construction)
  const ok =
    (allow?.includes("admin") && rf.isAdmin) ||
    (allow?.includes("project") && rf.isProjectSide) ||
    (allow?.includes("other") && rf.isOther);

  return ok ? children : <Navigate to={homeForRoles(rf)} replace />;
}

// ---- Canonical profile route ----
// - Admins → /admin/profile
// - Others → /profile page inline
function ProfileRoute() {
  const { ready, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!ready) return <div className="p-6">Checking session…</div>;
  if (!isAuthenticated)
    return <Navigate to="/login" replace state={{ from: location }} />;

  const { isAdmin } = roleFlagsFromUser(user);
  if (isAdmin) return <Navigate to="/admin/profile" replace />;

  return (
    <>
      <NavBar />
      <UpdateProfile />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Admin area */}
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

          {/* Project-side / general users */}
          <Route
            path="/applications"
            element={
              <ProtectedRoutes allow={["project", "other"]}>
                <>
                  <NavBar />
                  <Applications />
                </>
              </ProtectedRoutes>
            }
          />
          <Route
            path="/kanban"
            element={
              <ProtectedRoutes allow={["project", "other"]}>
                <>
                  <NavBar />
                  <Kanban />
                </>
              </ProtectedRoutes>
            }
          />

          {/* Canonical profile */}
          <Route path="/profile" element={<ProfileRoute />} />

          {/* Fallback */}
          <Route path="*" element={<RoleHomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
