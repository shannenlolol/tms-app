import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Kanban() {
  const { acronym } = useParams(); // from /applications/:acronym/kanban
  const { ready, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!ready) return null;
  if (!isAuthenticated) return <div className="p-6">Please sign in.</div>;

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="btn-white px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-300"
        >
          ← 
        </button>
        <h1 className="text-2xl font-semibold">{acronym}</h1>
      </div>

      {/* Columns scaffold */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {["Open", "To-Do", "Doing", "Done", "Close"].map((col) => (
          <div key={col} className="rounded-xl border border-gray-200 bg-white">
            <div className="px-4 py-3 border-b bg-gray-50 font-medium">{col}</div>
            <div className="p-3 space-y-3">
              <div className="text-gray-400 italic">No items yet.</div>
              {/* Later: map tasks here */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
