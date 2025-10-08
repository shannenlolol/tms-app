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

function Protected({ children }) {
  const { ready, isAuthenticated } = useAuth();
  if (!ready) return null; // or a spinner
  if (!isAuthenticated) return <Navigate to="/login" replace />;
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
                <Home />
              </Protected>
            }
          />
          <Route
            path="/admin"
            element={
              <Protected>
                <AdminNavBar />
                <AdminHome />
              </Protected>
            }
          />
          <Route
            path="/profile"
            element={
              <Protected>
                <UpdateProfile />
              </Protected>
            }
          />
          <Route
            path="/admin/profile"
            element={
              <Protected>
                <AdminNavBar />
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

