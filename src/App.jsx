import { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ConsultaPanel from "./components/ConsultaPanel";
import GestaoPanel from "./components/GestaoPanel";
import UploadPanel from "./components/UploadPanel";
import "./styles/theme.css";

function AppContent() {
  const { user, isGestor } = useAuth();
  const [activeTab, setActiveTab] = useState("consulta");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="logo">mills <span>· portal de documentos</span></div>
        <div>{user.name}</div>
      </header>

      <nav className="tabs">
        <div
          className={`tab ${activeTab === "consulta" ? "active" : ""}`}
          onClick={() => setActiveTab("consulta")}
        >
          Consulta
        </div>
        <div
          className={`tab ${activeTab === "upload" ? "active" : ""}`}
          onClick={() => setActiveTab("upload")}
        >
          Upload de Documentos
        </div>
        {isGestor && (
          <div
            className={`tab ${activeTab === "gestao" ? "active" : ""}`}
            onClick={() => setActiveTab("gestao")}
          >
            Gestão de Frotas
          </div>
        )}
      </nav>

      <main className="content">
        {activeTab === "consulta" && <ConsultaPanel />}
        {activeTab === "upload" && <UploadPanel />}
        {activeTab === "gestao" && isGestor && <GestaoPanel />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
