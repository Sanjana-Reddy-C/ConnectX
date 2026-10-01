import { useEffect, useState } from "react";
import {
  getWorkspaces,
  createWorkspace,
} from "../services/workspaceService";

interface Workspace {
  id: string;
  name: string;
  description?: string;
}

function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const loadWorkspaces = async () => {
    try {
      const response = await getWorkspaces();

      const workspaceData = response.data.map(
        (item: any) => item.workspace
      );

      setWorkspaces(workspaceData);
    } catch (error) {
      console.error("Failed to load workspaces", error);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const handleCreateWorkspace = async () => {
    if (!name.trim()) {
      return;
    }

    try {
      await createWorkspace(name, description);

      setName("");
      setDescription("");
      setShowForm(false);

      await loadWorkspaces();
    } catch (error) {
      console.error("Failed to create workspace", error);
    }
  };

  return (
    <div className="w-72 border-r border-slate-800 bg-slate-900 p-5 text-white">

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Workspaces
        </h2>

        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-cyan-500 px-3 py-1 text-lg font-bold hover:bg-cyan-600"
        >
          +
        </button>
      </div>

      {showForm && (
        <div className="mb-6 space-y-3 rounded-xl bg-slate-800 p-4">

          <input
            type="text"
            placeholder="Workspace name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          />

          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
            rows={3}
          />

          <button
            onClick={handleCreateWorkspace}
            className="w-full rounded-lg bg-cyan-500 py-2 font-semibold hover:bg-cyan-600"
          >
            Create Workspace
          </button>

        </div>
      )}

      <div className="space-y-2">

        {workspaces.length === 0 ? (
          <p className="text-sm text-slate-500">
            No workspaces yet
          </p>
        ) : (
          workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className="cursor-pointer rounded-lg px-3 py-3 transition hover:bg-slate-800"
            >
              <p className="font-medium">
                {workspace.name}
              </p>

              {workspace.description && (
                <p className="mt-1 text-xs text-slate-400">
                  {workspace.description}
                </p>
              )}
            </div>
          ))
        )}

      </div>
    </div>
  );
}

export default WorkspaceList;