// App.jsx — minimal, role-aware routing using a single <ProtectedRoutes/>

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";

import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import AdminHome from "./pages/AdminHome.jsx";
import UpdateProfile from "./pages/UpdateProfile.jsx";
import Temp from "./pages/Temp.jsx";
import NavBar from "./components/NavBar.jsx";

function normaliseGroups(raw) {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  return new Set(list.map(s => String(s ?? "").trim().toLowerCase()).filter(Boolean));
}
function roleFlags(user) {
  const set = normaliseGroups(user?.groups ?? user?.usergroups ?? user?.usergroup);
  const isAdmin = set.has("admin");
  const isProjectSide = set.has("project manager") || set.has("project lead") || set.has("dev team");
  const isOther = !isAdmin && !isProjectSide;
  return { isAdmin, isProjectSide, isOther };
}
function homeForRoles(flags) {
  if (flags.isProjectSide) return "/";
  if (flags.isAdmin) return "/admin";
  if (flags.isOther) return "/temp";
  return "/login";
}
function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={homeForRoles(roleFlags(user))} replace />;
}

function ProtectedRoutes({ allow, children }) {
  const { ready, isAuthenticated, user } = useAuth();
  if (!ready) return <div className="p-6">Checking session…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const rf = roleFlags(user);
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
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Project home */}
          <Route
            path="/"
            element={
              <ProtectedRoutes allow={["project"]}>
                <>
                  <NavBar />
                  <Home />
                </>
              </ProtectedRoutes>
            }
          />

          {/* Non-admin profile */}
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

          {/* Temp area (neither Admin nor Project-side) */}
          <Route
            path="/temp"
            element={
              <ProtectedRoutes allow={["other"]}>
                <>
                  <NavBar />
                  <Temp />
                </>
              </ProtectedRoutes>
            }
          />

          {/* Fallback: smart redirect based on role */}
          <Route path="*" element={<RoleHomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
