import { useEffect, useMemo, useState } from "react";
import { buildFleetAlertSummary, ALERT_STATUS } from "../utils/alertEngine";
import { getAssets, getDocumentsByAssetId, isBackendConfigured } from "../services/dataSource";
import { ASSET_TYPE_LABELS } from "../config/categories";

const STATUS_LABEL = {
  [ALERT_STATUS.OK]: "OK",
  [ALERT_STATUS.VENCENDO_15]: "Vence em ≤15 dias",
  [ALERT_STATUS.VENCENDO_30]: "Vence em ≤30 dias",
  [ALERT_STATUS.VENCIDO]: "Vencido",
  [ALERT_STATUS.FALTANTE]: "Faltante",
};

export default function GestaoPanel() {
  const [filterCell, setFilterCell] = useState("");
  const [assets, setAssets] = useState([]);
  const [documentsByAssetId, setDocumentsByAssetId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const fetchedAssets = await getAssets();
        const fetchedDocs = await getDocumentsByAssetId(fetchedAssets);
        if (!cancelled) {
          setAssets(fetchedAssets);
          setDocumentsByAssetId(fetchedDocs);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const { summary, detail } = useMemo(
    () => buildFleetAlertSummary(assets, documentsByAssetId),
    [assets, documentsByAssetId]
  );

  if (loading) return <div className="empty-state">Carregando dados da frota...</div>;
  if (error) return <div className="empty-state">Erro ao carregar dados: {error}</div>;

  const filteredDetail = filterCell
    ? detail.filter((d) => d.asset.cell === filterCell)
    : detail;

  const cells = [...new Set(assets.map((a) => a.cell))];

  return (
    <div>
      {!isBackendConfigured && (
        <p style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
          Exibindo dados de demonstração (Firebase ainda não configurado em .env)
        </p>
      )}

      <div className="summary-cards" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className="summary-card vencido">
          <div className="number">{summary.vencidos}</div>
          <div className="label">Documento vencido</div>
        </div>
        <div className="summary-card vencendo">
          <div className="number">{summary.vencendo15}</div>
          <div className="label">Vencendo em até 15 dias</div>
        </div>
        <div className="summary-card vencendo">
          <div className="number">{summary.vencendo30}</div>
          <div className="label">Vencendo em até 30 dias</div>
        </div>
        <div className="summary-card faltante">
          <div className="number">{summary.faltantes}</div>
          <div className="label">Documento faltante</div>
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
        <button className="btn secondary">Exportar relatório (Excel)</button>
      </div>

      <table className="asset-table">
        <thead>
          <tr>
            <th>Placa/Tag</th>
            <th>Tipo</th>
            <th>Célula</th>
            <th>Responsável</th>
            <th>Pendências</th>
          </tr>
        </thead>
        <tbody>
          {filteredDetail.map(({ asset, panel }) => {
            const pendencias = panel.filter((p) => p.status !== ALERT_STATUS.OK);
            return (
              <tr key={asset.id}>
                <td><strong>{asset.placaOuTag}</strong></td>
                <td>{ASSET_TYPE_LABELS[asset.assetType]}</td>
                <td>{asset.cell}</td>
                <td>{asset.responsavel}</td>
                <td>
                  {pendencias.length === 0 ? (
                    <span className="badge ok">Tudo regularizado</span>
                  ) : (
                    pendencias.map((p) => (
                      <span
                        key={p.categoryId}
                        className={`badge ${p.status === ALERT_STATUS.VENCENDO_30 ? "vencendo" : p.status === ALERT_STATUS.VENCENDO_15 ? "vencendo" : p.status}`}
                      >
                        {p.categoryLabel}: {STATUS_LABEL[p.status]}
                      </span>
                    ))
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
