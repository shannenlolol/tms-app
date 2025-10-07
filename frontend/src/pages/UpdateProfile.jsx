import { useState } from "react";

export default function UpdateProfile() {
const [rows, setRows] = useState([
  {
    id: 1,
    username: "John Doe",
    usergroup: "Admin",
    email: "john.doe@example.com",
    curpassword: "Rk7!qa2Z",
    newpassword: "Rk7!qa2Z",
    active: "active",
  }
]);


  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null); // temp copy while editing

  const startEdit = (row) => {
    setEditingId(row.id);
    setDraft({ ...row });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const updateDraft = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const saveEdit = async () => {
    setRows((rs) => rs.map((r) => (r.id === editingId ? { ...r, ...draft, price: Number(draft.price) } : r)));
    // TODO: call your API here, e.g.:
    // await api('/products/'+editingId, { method:'PUT', body: JSON.stringify(draft), headers:{'Content-Type':'application/json'} });
    cancelEdit();
  };

  return (
    <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
      <table className="w-full text-sm text-left rtl:text-right text-gray-700 dark:text-gray-300">
        <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th scope="col" className="px-6 py-3">Username</th>
            <th scope="col" className="px-6 py-3">User Group</th>
            <th scope="col" className="px-6 py-3">Email</th>
            <th scope="col" className="px-6 py-3">Current Password</th>
            <th scope="col" className="px-6 py-3">New Password</th>
            <th scope="col" className="px-6 py-3">Active</th>

          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isEditing = editingId === row.id;
            const z = isEditing ? draft : row;
            return (
              <tr
                key={row.id}
                className="odd:bg-white odd:dark:bg-gray-900 even:bg-gray-50 even:dark:bg-gray-800 border-b dark:border-gray-700 border-gray-200"
              >
                <td className="px-6 py-4">
                  {
                    row.username
                  }
                </td>
                <td className="px-6 py-4">
                  {                    row.usergroup
                 }
                </td>
                <td className="px-6 py-4">
                  {isEditing ? (
                    <input
                      className="w-full rounded-md border px-2 py-1 outline-none focus:ring focus:border-blue-500 bg-white dark:bg-gray-900"
                      value={z.email}
                      onChange={(e) => updateDraft("email", e.target.value)}
                    />
                  ) : (
                    row.email
                  )}
                </td>
                                <td className="px-6 py-4">
                  {isEditing ? (
                    <input type="password"
                      className="w-full rounded-md border px-2 py-1 outline-none focus:ring focus:border-blue-500 bg-white dark:bg-gray-900"
                      value={z.curpassword}
                      onChange={(e) => updateDraft("curpassword", e.target.value)}
                    />
                  ) : (
                    "*".repeat(row.curpassword.length)
                  )}
                </td>
                                                <td className="px-6 py-4">
                  {isEditing ? (
                    <input type="password"
                      className="w-full rounded-md border px-2 py-1 outline-none focus:ring focus:border-blue-500 bg-white dark:bg-gray-900"
                      value={z.newpassword}
                      onChange={(e) => updateDraft("newpassword", e.target.value)}
                    />
                  ) : (
                    "*".repeat(row.newpassword.length)
                  )}
                </td>
                                <td className="px-6 py-4">
                  <input
      type="checkbox"
      className="h-4 w-4 accent-blue-600"
      checked={!!row.active}                        // ✅ show current value
      disabled                                      // or readOnly
      aria-readonly="true"
    />
                </td>
                <td className="px-6 py-4">
                  {isEditing ? (
                    <div className="flex flex-col gap-2">

                      <button
                        onClick={saveEdit}
                        className="rounded-md bg-blue-600 text-white px-3 py-1 hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-md bg-gray-200 text-gray-800 px-3 py-1 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(row)}
                      className="font-medium bg-gray-200 text-blue-600 dark:text-blue-500 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
