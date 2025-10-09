// src/routes/AppRoutes.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import Login from "../pages/Login.jsx";
import Home from "../pages/Home.jsx";
import AdminHome from "../pages/AdminHome.jsx";
import UpdateProfile from "../pages/UpdateProfile.jsx";
import NotFound from "../pages/NotFound.jsx";
import AdminNavBar from "../pages/AdminNavBar.jsx";
import NavBar from "../pages/NavBar.jsx"

/** Signed-in only */
function Protected({ children }) {
  const { ready, isAuthenticated } = useAuth();
  if (!ready) return null; // or a spinner
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

/** Admin only */
function AdminOnly({ children }) {
  const { ready, isAuthenticated, isAdmin } = useAuth();
  if (!ready) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <Protected>
                <NavBar />
                <Home />
              </Protected>
            }
          />

          {/* ADMIN PAGES (guarded) */}
          <Route
            path="/admin"
            element={
              <AdminOnly>
                <AdminNavBar />
                <AdminHome />
              </AdminOnly>
            }
          />
          <Route
            path="/admin/profile"
            element={
              <AdminOnly>
                <AdminNavBar />
                <UpdateProfile />
              </AdminOnly>
            }
          />

          {/* USER PAGES */}
          <Route
            path="/profile"
            element={
              <Protected>
                <NavBar />
                <UpdateProfile />
              </Protected>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
