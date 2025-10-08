// AppRoutes.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login.jsx";
import Home from "../pages/Home.jsx";              // <-- non-admin landing
import AdminHome from "../pages/AdminHome.jsx";
import NotFound from "../pages/NotFound.jsx";
import useAuth from "../hooks/useAuth.js";
import NavBar from "../pages/NavBar.jsx";
import AdminNavBar from "../pages/AdminNavBar.jsx";
import UpdateProfile from "../pages/UpdateProfile.jsx";
import AdminUpdateProfile from "../pages/AdminUpdateProfile.jsx";

function PrivateRoute({ children, requireAdmin = false }) {
  const { isAuthed, isAdmin, loading } = useAuth();
  if (loading) return <div className="p-6">Checking session…</div>;
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (requireAdmin && !isAdmin) return <Navigate to="/home" replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Smart root: send admins to admin-home, others to home */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <RoleRedirect />
            </PrivateRoute>
          }
        />

        <Route
          path="/home"
          element={
            <PrivateRoute>
              <NavBar />
              <Home />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin-home"
          element={
            <PrivateRoute requireAdmin>
              <AdminNavBar />
              <AdminHome />
            </PrivateRoute>
          }
        />

        <Route
          path="/update-profile"
          element={
            <PrivateRoute>
              <NavBar />
              <UpdateProfile />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin-update-profile"
          element={
            <PrivateRoute requireAdmin>
              <AdminNavBar />
              <AdminUpdateProfile />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

// Small helper that decides where "/" goes after auth
function RoleRedirect() {
  const { isAdmin } = useAuth();
  return <Navigate to={isAdmin ? "/admin-home" : "/home"} replace />;
}
