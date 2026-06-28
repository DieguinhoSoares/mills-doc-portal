import { useRef, useState } from "react";
import { parseSimCsv } from "../utils/simCsvImport";
import { bulkUpsertAssetsFromSim } from "../services/firestoreService";
import { isBackendConfigured } from "../services/dataSource";

export default function ImportSimPanel() {
  const inputRef = useRef(null);
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);

  async function handleFile(file) {
    setError(null);
    setResult(null);
    setRecords(null);
    setPreview(null);

    try {
      const text = await file.text();
      const parsed = parseSimCsv(text);
      setRecords(parsed);

      // Monta uma prévia rápida pra o master saber o que vai acontecer antes de confirmar
      const arquivar = parsed.filter((r) => r.arquivado).length;
      const familiasDesconhecidas = [
        ...new Set(
          parsed
            .filter((r) => r.familia && r.assetType === "pesado" && !r.familia.includes("Implemento"))
            .map((r) => r.familia)
        ),
      ];
      setPreview({
        total: parsed.length,
        arquivar,
        familiasDesconhecidas,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleConfirm() {
    if (!records) return;
    setImporting(true);
    setError(null);
    setProgress({ feito: 0, total: records.length });
    try {
      if (!isBackendConfigured) {
        setResult({ criados: 0, atualizados: 0, erros: [], demo: true });
        return;
      }
      const res = await bulkUpsertAssetsFromSim(records, (feito, total) =>
        setProgress({ feito, total })
      );
      setResult(res);
      setRecords(null);
      setPreview(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  return (
    <div>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 16 }}>
        Suba o CSV exportado do SIM (Frota → Exportar) pra atualizar placa, número de
        frota, família (subtipo), UF e status de cada ativo. Veículos vendidos,
        sinistrados ou devolvidos são automaticamente arquivados (saem dos alertas e
        da lista padrão de Consulta, mas continuam no histórico).
      </p>

      {!isBackendConfigured && (
        <p style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
          Modo demonstração: a importação não grava de fato (Firebase ainda não
          configurado em .env).
        </p>
      )}

      <div
        onClick={() => inputRef.current.click()}
        style={{
          border: "2px dashed #ddd",
          borderRadius: 8,
          padding: 32,
          textAlign: "center",
          cursor: "pointer",
          background: "white",
          marginBottom: 16,
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Clique pra selecionar o CSV do SIM</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
        />
      </div>

      {error && (
        <p style={{ color: "var(--status-vencido)", marginBottom: 16 }}>{error}</p>
      )}

      {preview && (
        <div style={{ background: "white", padding: 16, borderRadius: 8, boxShadow: "var(--shadow-card)", marginBottom: 16 }}>
          <p><strong>{preview.total}</strong> registros lidos do CSV.</p>
          <p><strong>{preview.arquivar}</strong> serão arquivados (vendido/sinistrado/devolvido).</p>
          {preview.familiasDesconhecidas.length > 0 && (
            <p style={{ color: "var(--status-vencendo)" }}>
              ⚠️ {preview.familiasDesconhecidas.length} família(s) sem mapeamento de documentos
              cadastrado, usando regra básica de fallback (NF + Ficha Técnica) por enquanto:{" "}
              {preview.familiasDesconhecidas.join(", ")}
            </p>
          )}
          <button className="btn" onClick={handleConfirm} disabled={importing}>
            {importing
              ? progress
                ? `Importando... ${progress.feito}/${progress.total}`
                : "Importando..."
              : "Confirmar importação"}
          </button>
          {importing && progress && (
            <div style={{ marginTop: 8, height: 6, background: "#eee", borderRadius: 3 }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 3,
                  background: "var(--mills-laranja)",
                  width: `${Math.round((progress.feito / progress.total) * 100)}%`,
                  transition: "width 0.2s",
                }}
              />
            </div>
          )}
        </div>
      )}

      {result && (
        <div style={{ background: "white", padding: 16, borderRadius: 8, boxShadow: "var(--shadow-card)" }}>
          {result.demo ? (
            <p>Em modo demonstração - nada foi gravado de fato.</p>
          ) : (
            <>
              <p style={{ color: "var(--status-ok)" }}>
                ✓ Importação concluída: {result.criados} ativo(s) criado(s), {result.atualizados} atualizado(s).
              </p>
              {result.erros.length > 0 && (
                <div style={{ color: "var(--status-vencido)" }}>
                  <p>{result.erros.length} erro(s):</p>
                  <ul>
                    {result.erros.map((e, i) => (
                      <li key={i}>{e.placaOuTag}: {e.erro}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
