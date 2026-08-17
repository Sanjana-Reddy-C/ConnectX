import { useNavigate } from "react-router-dom";
import WorkspaceList from "../components/WorkspaceList";

function Dashboard() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">

      {/* Sidebar */}
      <WorkspaceList />

      {/* Main Content */}
      <div className="flex flex-1 flex-col">

        {/* Top Bar */}
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">

          <h1 className="text-xl font-bold text-cyan-400">
            ConnectX
          </h1>

          <button
            onClick={logout}
            className="rounded-lg bg-red-500 px-5 py-2 text-sm font-semibold transition hover:bg-red-600"
          >
            Logout
          </button>

        </header>

        {/* Main Area */}
        <main className="flex flex-1 items-center justify-center">

          <div className="text-center">

            <h2 className="text-4xl font-bold">
              Welcome to ConnectX 
            </h2>

            <p className="mt-4 text-slate-400">
              Select a workspace to start collaborating.
            </p>

          </div>

        </main>

      </div>

    </div>
  );
}

export default Dashboard;