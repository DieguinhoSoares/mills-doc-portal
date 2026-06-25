import { useEffect, useState } from "react";
import { listUsers, updateUserStatus, updateUserRole, deleteUserDoc } from "../services/firestoreService";
import { ROLES, USER_STATUS } from "../contexts/AuthContext";

const ROLE_LABELS = {
  [ROLES.MASTER]: "Master",
  [ROLES.GESTOR]: "Gestor",
  [ROLES.ANALISTA]: "Analista",
  [ROLES.CONSULTANTE]: "Consultante",
};

const STATUS_LABELS = {
  [USER_STATUS.PENDENTE]: "Pendente",
  [USER_STATUS.ATIVO]: "Ativo",
  [USER_STATUS.BLOQUEADO]: "Bloqueado",
};

const STATUS_BADGE_CLASS = {
  [USER_STATUS.PENDENTE]: "vencendo",
  [USER_STATUS.ATIVO]: "ok",
  [USER_STATUS.BLOQUEADO]: "vencido",
};

export default function UserManagementPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function reload() {
    setLoading(true);
    try {
      const list = await listUsers();
      setUsers(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleStatusChange(uid, status) {
    await updateUserStatus(uid, status);
    reload();
  }

  async function handleRoleChange(uid, role) {
    await updateUserRole(uid, role);
    reload();
  }

  async function handleDelete(uid, email) {
    const confirmed = window.confirm(
      `Excluir o cadastro de ${email}? Isso remove o acesso ao portal, mas não apaga a conta de login (se precisar apagar de vez, use o Firebase Console > Authentication).`
    );
    if (!confirmed) return;
    await deleteUserDoc(uid);
    reload();
  }

  if (loading) return <div className="empty-state">Carregando usuários...</div>;
  if (error) return <div className="empty-state">Erro ao carregar usuários: {error}</div>;

  const pendentes = users.filter((u) => u.status === USER_STATUS.PENDENTE);
  const outros = users.filter((u) => u.status !== USER_STATUS.PENDENTE);

  return (
    <div>
      {pendentes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Aguardando aprovação ({pendentes.length})</h3>
          <UserTable users={pendentes} onStatusChange={handleStatusChange} onRoleChange={handleRoleChange} onDelete={handleDelete} />
        </div>
      )}

      <h3 style={{ fontSize: 15, marginBottom: 8 }}>Todos os usuários</h3>
      <UserTable users={outros} onStatusChange={handleStatusChange} onRoleChange={handleRoleChange} onDelete={handleDelete} />
    </div>
  );
}

function UserTable({ users, onStatusChange, onRoleChange, onDelete }) {
  if (users.length === 0) return <div className="empty-state">Nenhum usuário nesta lista.</div>;

  return (
    <table className="asset-table" style={{ marginBottom: 16 }}>
      <thead>
        <tr>
          <th>E-mail</th>
          <th>Papel</th>
          <th>Status</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id}>
            <td>{u.email}</td>
            <td>
              <select value={u.role} onChange={(e) => onRoleChange(u.id, e.target.value)}>
                {Object.values(ROLES).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </td>
            <td>
              <span className={`badge ${STATUS_BADGE_CLASS[u.status]}`}>{STATUS_LABELS[u.status]}</span>
            </td>
            <td style={{ display: "flex", gap: 6 }}>
              {u.status !== USER_STATUS.ATIVO && (
                <button className="btn secondary" onClick={() => onStatusChange(u.id, USER_STATUS.ATIVO)}>
                  Autorizar
                </button>
              )}
              {u.status !== USER_STATUS.BLOQUEADO && (
                <button className="btn secondary" onClick={() => onStatusChange(u.id, USER_STATUS.BLOQUEADO)}>
                  Bloquear
                </button>
              )}
              <button className="btn secondary" onClick={() => onDelete(u.id, u.email)}>
                Excluir
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
