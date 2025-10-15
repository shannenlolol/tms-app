// src/App.jsx
//  * App root & routing: wraps <AuthProvider> and <BrowserRouter>, 
//    defines Protected/AdminOnly guards, and mounts shared nav bars.

//  * Routes: /login, / (Protected Home), /admin (AdminOnly), /profile (Protected), 
//    and a catch-all NotFound.

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import AdminHome from "./pages/AdminHome.jsx";
import UpdateProfile from "./pages/UpdateProfile.jsx";
import NotFound from "./pages/NotFound.jsx";
import AdminNavBar from "./components/AdminNavBar.jsx";
import NavBar from "./components/NavBar.jsx"

function Protected({ children }) {
  const { ready, isAuthenticated } = useAuth();
  if (!ready) return <div className="p-6">Checking session…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { ready, isAuthenticated, isAdmin } = useAuth();
  if (!ready) return <div className="p-6">Checking session…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}


export default function App() {
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
