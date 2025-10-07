import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login.jsx";
import AdminHome from "../pages/AdminHome.jsx";
import NotFound from "../pages/NotFound.jsx";
import useAuth from "../hooks/useAuth.js";
import NavBar from "../pages/NavBar.jsx";
import UpdateProfile from "../pages/UpdateProfile.jsx"

function PrivateRoute({ children }) {
  const { isAuthed, loading } = useAuth();
  if (loading) return <div className="p-6">Checking session…</div>;
  return isAuthed ? children : <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return {
    /* basename can be added here if you deploy under a subpath */
  } && (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin-home"
          element={
            <PrivateRoute>
              <NavBar />
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
