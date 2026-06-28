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

export default function ConsultaPanel() {
  const [search, setSearch] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [assets, setAssets] = useState([]);
  const [documentsByAssetId, setDocumentsByAssetId] = useState({});
  const [loading, setLoading] = useState(true);
  const [zipLoading, setZipLoading] = useState(false);

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

  const filteredAssets = useMemo(
    () => assets.filter((a) => a.placaOuTag.toLowerCase().includes(search.toLowerCase())),
    [assets, search]
  );

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const documents = selectedAssetId ? documentsByAssetId[selectedAssetId] || [] : [];

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
          placeholder="Buscar por placa ou tag do ativo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!selectedAssetId && (
        <table className="asset-table">
          <thead>
            <tr>
              <th>Placa/Tag</th>
              <th>Tipo</th>
              <th>Célula</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.placaOuTag}</strong></td>
                <td>{ASSET_TYPE_LABELS[a.assetType]}</td>
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
                <td colSpan={4} className="empty-state">Nenhum ativo encontrado para essa busca.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {selectedAsset && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <button className="btn secondary" onClick={() => setSelectedAssetId(null)}>← Voltar</button>
              <h3 style={{ display: "inline-block", marginLeft: 12 }}>{selectedAsset.placaOuTag}</h3>
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

          {documents.length === 0 ? (
            <div className="empty-state">Nenhum documento cadastrado para este ativo ainda.</div>
          ) : (
            <div>
              {documents.map((doc, idx) => {
                const cat = getCategoryById(doc.categoryId);
                return (
                  <div key={idx} className="doc-pill">
                    📄 {cat?.label || doc.categoryId} ({doc.year || "—"}) — {doc.fileName}
                    <a href={doc.fileUrl} download style={{ marginLeft: 8, color: "var(--mills-laranja)" }}>
                      Baixar
                    </a>
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
