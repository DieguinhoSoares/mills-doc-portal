import { useEffect, useMemo, useState } from "react";
import { getAssets, getDocumentsByAssetId, isBackendConfigured } from "../services/dataSource";
import { storageAdapter } from "../services/storageAdapter";
import { getCategoryById, ASSET_TYPE_LABELS } from "../config/categories";

async function downloadAssetFolderAsZip(asset, documents) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const root = zip.folder(asset.placaOuTag);

  for (const doc of documents) {
    const cat = getCategoryById(doc.categoryId);
    const folder = root.folder(cat?.label || doc.categoryId).folder(String(doc.year || "sem-ano"));
    try {
      const blob = isBackendConfigured
        ? await storageAdapter.fetchFileBlob(doc)
        : new Blob([`Conteúdo de exemplo para ${doc.fileName}`], { type: "text/plain" });
      folder.file(doc.fileName, blob);
    } catch (err) {
      folder.file(`ERRO_${doc.fileName}.txt`, `Falha ao baixar este arquivo: ${err.message}`);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${asset.placaOuTag}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Agrupa os documentos por categoria e separa o mais recente (por ano) dos
 * demais - o consultante deve ver direto a versão vigente, sem precisar
 * adivinhar qual dos vários PDFs daquela categoria é o atual.
 */
function groupByCategoryLatestFirst(documents) {
  const byCategory = {};
  documents.forEach((doc) => {
    if (!byCategory[doc.categoryId]) byCategory[doc.categoryId] = [];
    byCategory[doc.categoryId].push(doc);
  });

  return Object.entries(byCategory).map(([categoryId, docs]) => {
    const sorted = [...docs].sort((a, b) => (b.year || 0) - (a.year || 0));
    return { categoryId, latest: sorted[0], older: sorted.slice(1) };
  });
}

export default function ConsultaPanel() {
  const [search, setSearch] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [assets, setAssets] = useState([]);
  const [documentsByAssetId, setDocumentsByAssetId] = useState({});
  const [loading, setLoading] = useState(true);
  const [zipLoading, setZipLoading] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const fetchedAssets = await getAssets();
      const fetchedDocs = await getDocumentsByAssetId(fetchedAssets);
      if (!cancelled) {
        setAssets(fetchedAssets);
        setDocumentsByAssetId(fetchedDocs);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filteredAssets = useMemo(() => {
    const term = search.toLowerCase().trim();
    // Com a frota na faixa de milhares, não renderiza a lista inteira sem
    // busca - isso sozinho deixava a tela pesada, independente da rede.
    if (term.length < 2) return [];
    return assets
      .filter(
        (a) =>
          a.placaOuTag.toLowerCase().includes(term) ||
          (a.numeroFrota || "").toLowerCase().includes(term)
      )
      .slice(0, 100); // mostra só os 100 primeiros resultados - refine a busca se precisar de outro
  }, [assets, search]);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const documents = selectedAssetId ? documentsByAssetId[selectedAssetId] || [] : [];
  const grouped = useMemo(() => groupByCategoryLatestFirst(documents), [documents]);

  if (loading) return <div className="empty-state">Carregando ativos...</div>;

  return (
    <div>
      {!isBackendConfigured && (
        <p style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
          Exibindo dados de demonstração (Firebase ainda não configurado em .env)
        </p>
      )}

      <div className="search-bar">
        <input
          placeholder="Buscar por placa, tag ou número de frota..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!selectedAssetId && (
        <>
          {search.trim().length < 2 ? (
            <div className="empty-state">
              Digite pelo menos 2 caracteres pra buscar entre os {assets.length} ativos da frota.
            </div>
          ) : (
            <table className="asset-table">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Nº Frota</th>
                  <th>Subtipo</th>
                  <th>Célula</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.placa !== undefined ? (a.placa || "—") : a.placaOuTag}</strong></td>
                    <td>{a.numeroFrota || "—"}</td>
                    <td>{a.familia || ASSET_TYPE_LABELS[a.assetType] || "—"}</td>
                    <td>{a.cell}</td>
                    <td>
                      <button className="btn secondary" onClick={() => setSelectedAssetId(a.id)}>
                        Ver documentos
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAssets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-state">Nenhum ativo encontrado para essa busca.</td>
                  </tr>
                )}
                {filteredAssets.length === 100 && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      Mostrando os 100 primeiros resultados - refine a busca pra ver outros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </>
      )}

      {selectedAsset && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <button className="btn secondary" onClick={() => setSelectedAssetId(null)}>← Voltar</button>
              <h3 style={{ display: "inline-block", marginLeft: 12 }}>
                {selectedAsset.placa ? `${selectedAsset.placa} · Frota ${selectedAsset.numeroFrota || "—"}` : `Frota ${selectedAsset.numeroFrota || selectedAsset.placaOuTag}`}
              </h3>
            </div>
            <button
              className="btn"
              onClick={async () => {
                setZipLoading(true);
                try {
                  await downloadAssetFolderAsZip(selectedAsset, documents);
                } finally {
                  setZipLoading(false);
                }
              }}
              disabled={documents.length === 0 || zipLoading}
            >
              {zipLoading ? "Montando .zip..." : "Baixar pasta completa (.zip)"}
            </button>
          </div>

          {grouped.length === 0 ? (
            <div className="empty-state">Nenhum documento cadastrado para este ativo ainda.</div>
          ) : (
            <div>
              {grouped.map(({ categoryId, latest, older }) => {
                const cat = getCategoryById(categoryId);
                const isExpanded = expandedCategory === categoryId;
                return (
                  <div key={categoryId} style={{ marginBottom: 8 }}>
                    <div className="doc-pill" style={{ cursor: "default" }}>
                      📄 {cat?.label || categoryId} ({latest.year || "—"}) — {latest.fileName}
                      <button
                        type="button"
                        className="link-baixar"
                        onClick={() => window.open(latest.fileUrl, "_blank", "noopener,noreferrer")}
                      >
                        Baixar
                      </button>
                      {older.length > 0 && (
                        <button
                          className="btn secondary"
                          style={{ marginLeft: 8, padding: "2px 8px", fontSize: 12 }}
                          onClick={() => setExpandedCategory(isExpanded ? null : categoryId)}
                        >
                          {isExpanded ? "Ocultar" : `+${older.length} versão(ões) anterior(es)`}
                        </button>
                      )}
                    </div>
                    {isExpanded && (
                      <div style={{ marginLeft: 24 }}>
                        {older.map((doc, idx) => (
                          <div key={idx} className="doc-pill" style={{ opacity: 0.75 }}>
                            📄 {cat?.label || categoryId} ({doc.year || "—"}) — {doc.fileName}
                            <button
                              type="button"
                              className="link-baixar"
                              onClick={() => window.open(doc.fileUrl, "_blank", "noopener,noreferrer")}
                            >
                              Baixar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
