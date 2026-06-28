import { useEffect, useMemo, useState } from "react";
import { buildFleetAlertSummary, ALERT_STATUS } from "../utils/alertEngine";
import { getAssets, getDocumentsByAssetId, isBackendConfigured } from "../services/dataSource";
import { ASSET_TYPE_LABELS, DOCUMENT_CATEGORIES, getRequiredCategories } from "../config/categories";
import { updateAsset } from "../services/firestoreService";
import ImportSimPanel from "./ImportSimPanel";

const STATUS_LABEL = {
  [ALERT_STATUS.OK]: "OK",
  [ALERT_STATUS.PREVENTIVO]: "Preventivo (≤60d)",
  [ALERT_STATUS.FINANCEIRO]: "Financeiro (≤30d)",
  [ALERT_STATUS.CRITICO]: "Crítico (≤15d)",
  [ALERT_STATUS.BLOQUEIO]: "Bloqueio recomendado",
  [ALERT_STATUS.FALTANTE]: "Faltante",
};

const STATUS_BADGE_CLASS = {
  [ALERT_STATUS.OK]: "ok",
  [ALERT_STATUS.PREVENTIVO]: "preventivo",
  [ALERT_STATUS.FINANCEIRO]: "vencendo",
  [ALERT_STATUS.CRITICO]: "critico",
  [ALERT_STATUS.BLOQUEIO]: "vencido",
  [ALERT_STATUS.FALTANTE]: "faltante",
};

export default function GestaoPanel() {
  const [filterCell, setFilterCell] = useState("");
  const [assets, setAssets] = useState([]);
  const [documentsByAssetId, setDocumentsByAssetId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingExceptionsFor, setEditingExceptionsFor] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const fetchedAssets = await getAssets({ incluirArquivados: showArchived });
      const fetchedDocs = await getDocumentsByAssetId(fetchedAssets);
      setAssets(fetchedAssets);
      setDocumentsByAssetId(fetchedDocs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const { summary, detail } = useMemo(
    () => buildFleetAlertSummary(assets, documentsByAssetId),
    [assets, documentsByAssetId]
  );

  if (loading) return <div className="empty-state">Carregando dados da frota...</div>;
  if (error) return <div className="empty-state">Erro ao carregar dados: {error}</div>;

  const filteredDetail = filterCell
    ? detail.filter((d) => d.asset.cell === filterCell)
    : detail;

  const cells = [...new Set(assets.map((a) => a.cell).filter(Boolean))];

  return (
    <div>
      {!isBackendConfigured && (
        <p style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
          Exibindo dados de demonstração (Firebase ainda não configurado em .env)
        </p>
      )}

      <div style={{ marginBottom: 16 }}>
        <button className="btn secondary" onClick={() => setShowImport((v) => !v)}>
          {showImport ? "Ocultar importação" : "Importar CSV do SIM"}
        </button>
      </div>

      {showImport && (
        <div style={{ marginBottom: 24 }}>
          <ImportSimPanel />
        </div>
      )}

      <div className="summary-cards" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        <div className="summary-card vencido">
          <div className="number">{summary.bloqueio}</div>
          <div className="label">Bloqueio recomendado</div>
        </div>
        <div className="summary-card critico">
          <div className="number">{summary.critico}</div>
          <div className="label">Crítico (≤15 dias)</div>
        </div>
        <div className="summary-card vencendo">
          <div className="number">{summary.financeiro}</div>
          <div className="label">Financeiro (≤30 dias)</div>
        </div>
        <div className="summary-card preventivo">
          <div className="number">{summary.preventivo}</div>
          <div className="label">Preventivo (≤60 dias)</div>
        </div>
        <div className="summary-card faltante">
          <div className="number">{summary.faltantes}</div>
          <div className="label">Veículos com doc. faltante</div>
        </div>
        <div className="summary-card ok">
          <div className="number">{summary.ok}</div>
          <div className="label">Regularizados</div>
        </div>
      </div>

      <div className="search-bar">
        <select value={filterCell} onChange={(e) => setFilterCell(e.target.value)}>
          <option value="">Todas as células</option>
          {cells.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Mostrar arquivados (vendidos/sinistrados)
        </label>
        <button className="btn secondary">Exportar relatório (Excel)</button>
      </div>

      <table className="asset-table">
        <thead>
          <tr>
            <th>Placa/Tag</th>
            <th>Nº Frota</th>
            <th>Família/Tipo</th>
            <th>Célula</th>
            <th>Pendências</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredDetail.map(({ asset, panel }) => {
            const pendencias = panel.filter((p) => p.status !== ALERT_STATUS.OK);
            return (
              <tr key={asset.id} style={asset.arquivado ? { opacity: 0.5 } : undefined}>
                <td>
                  <strong>{asset.placaOuTag}</strong>
                  {asset.arquivado && <div style={{ fontSize: 11, color: "#999" }}>Arquivado ({asset.statusOperacional})</div>}
                </td>
                <td>{asset.numeroFrota || "—"}</td>
                <td>{asset.familia || ASSET_TYPE_LABELS[asset.assetType] || "—"}</td>
                <td>{asset.cell}</td>
                <td>
                  {pendencias.length === 0 ? (
                    <span className="badge ok">Tudo regularizado</span>
                  ) : (
                    pendencias.map((p) => (
                      <span key={p.categoryId} className={`badge ${STATUS_BADGE_CLASS[p.status]}`}>
                        {p.categoryLabel}: {STATUS_LABEL[p.status]}
                      </span>
                    ))
                  )}
                </td>
                <td>
                  <button
                    className="btn secondary"
                    style={{ fontSize: 12, padding: "4px 8px" }}
                    onClick={() => setEditingExceptionsFor(editingExceptionsFor === asset.id ? null : asset.id)}
                  >
                    Exceções
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {editingExceptionsFor && (
        <ExceptionEditor
          asset={assets.find((a) => a.id === editingExceptionsFor)}
          onClose={() => setEditingExceptionsFor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

/**
 * Exceção pontual por veículo - resolve o caso "esse basculante específico
 * não precisa de CIV" sem mexer na regra geral da Família/tipo.
 */
function ExceptionEditor({ asset, onClose, onSaved }) {
  const baseIds = asset.familia
    ? null // a tela mostra todas as categorias do catálogo pra simplificar - remover/adicionar qualquer uma
    : getRequiredCategories(asset.assetType).map((c) => c.id);

  const excecaoAtual = asset.categoriasExcecao || { adicionar: [], remover: [] };
  const [removidas, setRemovidas] = useState(new Set(excecaoAtual.remover || []));
  const [adicionadas, setAdicionadas] = useState(new Set(excecaoAtual.adicionar || []));
  const [saving, setSaving] = useState(false);

  function toggleRemovida(id) {
    setRemovidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAdicionada(id) {
    setAdicionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateAsset(asset.id, {
        categoriasExcecao: {
          remover: [...removidas],
          adicionar: [...adicionadas],
        },
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "white", padding: 16, borderRadius: 8, boxShadow: "var(--shadow-card)", marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Exceções de documento - {asset.placaOuTag}</h3>
      <p style={{ fontSize: 13, color: "#777" }}>
        Por padrão, esse ativo exige os documentos da Família "{asset.familia || ASSET_TYPE_LABELS[asset.assetType]}".
        Marque abaixo só as categorias que devem ser <strong>removidas</strong> (não se aplicam a esse veículo
        específico) ou <strong>adicionadas</strong> (exceção rara, exige algo fora do padrão da família).
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <strong style={{ fontSize: 13 }}>Remover (não se aplica a este veículo)</strong>
          {DOCUMENT_CATEGORIES.map((cat) => (
            <label key={cat.id} style={{ display: "block", fontSize: 13, marginTop: 4 }}>
              <input
                type="checkbox"
                checked={removidas.has(cat.id)}
                onChange={() => toggleRemovida(cat.id)}
              />{" "}
              {cat.label}
            </label>
          ))}
        </div>
        <div>
          <strong style={{ fontSize: 13 }}>Adicionar (exceção, exige algo extra)</strong>
          {DOCUMENT_CATEGORIES.map((cat) => (
            <label key={cat.id} style={{ display: "block", fontSize: 13, marginTop: 4 }}>
              <input
                type="checkbox"
                checked={adicionadas.has(cat.id)}
                onChange={() => toggleAdicionada(cat.id)}
              />{" "}
              {cat.label}
            </label>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar exceções"}
        </button>
        <button className="btn secondary" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
