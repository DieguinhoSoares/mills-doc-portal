import { useRef, useState } from "react";
import { extractDocumentMetadata } from "../utils/geminiExtraction";
import { DOCUMENT_CATEGORIES, ASSET_TYPE_LABELS, ASSET_TYPES, getCategoryById } from "../config/categories";
import { calcularVencimentoLicenciamento, ESTADOS_BR } from "../config/calendarioLicenciamento";
import { mockAssets } from "../data/mockData";
import { isBackendConfigured } from "../services/dataSource";
import { findAssetByPlaca, createAsset, saveDocumentMetadata } from "../services/firestoreService";
import { storageAdapter } from "../services/storageAdapter";
import { useAuth } from "../contexts/AuthContext";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
const MAX_FILE_MB = 15;

const STATUS = {
  PENDING: "pending",
  EXTRACTING: "extracting",
  READY: "ready",
  SAVING: "saving",
  ERROR: "error",
  SAVED: "saved",
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function UploadPanel() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const inputRef = useRef(null);

  function validateFile(file) {
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith(".pdf")) {
      return `Tipo de arquivo não suportado: ${file.name}. Use PDF, PNG ou JPG.`;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      return `${file.name} excede ${MAX_FILE_MB}MB.`;
    }
    return null;
  }

  async function handleFiles(fileList) {
    const newItems = Array.from(fileList).map((file) => {
      const error = validateFile(file);
      return {
        id: makeId(),
        file,
        status: error ? STATUS.ERROR : STATUS.PENDING,
        errorMsg: error,
        extraction: null,
        override: {},
      };
    });

    setItems((prev) => [...prev, ...newItems]);

    for (const item of newItems.filter((i) => i.status === STATUS.PENDING)) {
      runExtraction(item.id, item.file);
    }
  }

  async function runExtraction(id, file) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: STATUS.EXTRACTING } : i)));
    try {
      const extraction = await extractDocumentMetadata(file);
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== id) return i;

          const isCrlv = extraction.categoryId === "crlv";
          const uf = extraction.ufRegistro || "";
          const assetType = extraction.assetTypeGuess || "";
          const validUntilCalculado = isCrlv
            ? calcularVencimentoLicenciamento({
                uf,
                exercicioPago: extraction.year || new Date().getFullYear(),
                placa: extraction.placaOuTag || "",
                assetType,
              })
            : extraction.validUntil;

          return {
            ...i,
            status: STATUS.READY,
            extraction,
            override: {
              placaOuTag: extraction.placaOuTag || "",
              categoryId: extraction.categoryId || "",
              assetType: extraction.assetTypeGuess || "",
              uf,
              year: extraction.year || new Date().getFullYear(),
              validUntil: validUntilCalculado || "",
            },
          };
        })
      );
    } catch (err) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: STATUS.ERROR, errorMsg: err.message } : i
        )
      );
    }
  }

  function updateOverride(id, field, value) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const novoOverride = { ...i.override, [field]: value };

        const camposQueAfetamCalculo = ["uf", "year", "placaOuTag", "categoryId", "assetType"];
        if (novoOverride.categoryId === "crlv" && camposQueAfetamCalculo.includes(field)) {
          novoOverride.validUntil =
            calcularVencimentoLicenciamento({
              uf: novoOverride.uf,
              exercicioPago: novoOverride.year,
              placa: novoOverride.placaOuTag,
              assetType: novoOverride.assetType,
            }) || "";
        }

        return { ...i, override: novoOverride };
      })
    );
  }

  async function confirmSave(id) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const { file, override } = item;

    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: STATUS.SAVING } : i)));

    if (!isBackendConfigured) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: STATUS.SAVED } : i)));
      return;
    }

    try {
      let asset = await findAssetByPlaca(override.placaOuTag);
      if (!asset) {
        if (!override.assetType) {
          throw new Error(
            "Placa/tag não cadastrada ainda. Selecione o tipo de ativo pra criar o cadastro."
          );
        }
        const newAssetId = await createAsset({
          placaOuTag: override.placaOuTag,
          assetType: override.assetType,
          uf: override.uf || "",
          cell: "",
          responsavel: user.name,
        });
        asset = { id: newAssetId };
      }

      const storageResult = await storageAdapter.uploadFile({
        file,
        placaOuTag: override.placaOuTag,
        categoryId: override.categoryId,
        year: override.year,
      });

      await saveDocumentMetadata({
        assetId: asset.id,
        categoryId: override.categoryId,
        year: override.year,
        validUntil: override.validUntil,
        fileName: file.name,
        storageResult,
        uploadedBy: user.email,
      });

      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: STATUS.SAVED } : i)));
    } catch (err) {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: STATUS.ERROR, errorMsg: err.message } : i))
      );
    }
  }

  function discard(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function onDrop(e) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div>
      {!isBackendConfigured && (
        <p style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
          Modo demonstração: documentos confirmados aqui não são salvos de fato
          (Firebase ainda não configurado em .env).
        </p>
      )}

      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current.click()}
        style={{
          border: "2px dashed #ddd",
          borderRadius: 8,
          padding: 40,
          textAlign: "center",
          cursor: "pointer",
          background: "white",
          marginBottom: 24,
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Arraste os arquivos aqui ou clique para selecionar</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
          PDF, PNG ou JPG · até {MAX_FILE_MB}MB por arquivo · pode selecionar vários de uma vez
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg"
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {items.length === 0 && (
        <div className="empty-state">Nenhum arquivo enviado ainda nesta sessão.</div>
      )}

      {items.map((item) => (
        <UploadItemCard
          key={item.id}
          item={item}
          onUpdate={(field, value) => updateOverride(item.id, field, value)}
          onConfirm={() => confirmSave(item.id)}
          onDiscard={() => discard(item.id)}
        />
      ))}
    </div>
  );
}

function UploadItemCard({ item, onUpdate, onConfirm, onDiscard }) {
  const { file, status, extraction, errorMsg, override } = item;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 8,
        boxShadow: "var(--shadow-card)",
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{file.name}</strong>
        <StatusBadge status={status} />
      </div>

      {status === STATUS.EXTRACTING && (
        <p style={{ color: "#888", fontSize: 13 }}>Lendo documento com IA, aguarde...</p>
      )}

      {status === STATUS.ERROR && (
        <p style={{ color: "var(--status-vencido)", fontSize: 13 }}>{errorMsg}</p>
      )}

      {(status === STATUS.READY || status === STATUS.SAVING || status === STATUS.SAVED || status === STATUS.ERROR) && override.placaOuTag !== undefined && (
        <div style={{ marginTop: 12 }}>
          {extraction?.confidence !== undefined && (
            <p style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
              Confiança da IA: {Math.round(extraction.confidence * 100)}%
              {extraction.confidence < 0.6 && " — revise com atenção"}
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Placa/Tag do ativo">
              <input
                value={override.placaOuTag}
                onChange={(e) => onUpdate("placaOuTag", e.target.value)}
                disabled={status === STATUS.SAVED || status === STATUS.SAVING}
                placeholder="ex: ABC1D23"
                list="known-assets"
              />
              <datalist id="known-assets">
                {mockAssets.map((a) => (
                  <option key={a.id} value={a.placaOuTag} />
                ))}
              </datalist>
            </Field>

            <Field label="Categoria">
              <select
                value={override.categoryId}
                onChange={(e) => onUpdate("categoryId", e.target.value)}
                disabled={status === STATUS.SAVED || status === STATUS.SAVING}
              >
                <option value="">Selecione...</option>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Tipo de ativo (só se for cadastro novo)">
              <select
                value={override.assetType}
                onChange={(e) => onUpdate("assetType", e.target.value)}
                disabled={status === STATUS.SAVED || status === STATUS.SAVING}
              >
                <option value="">Selecione...</option>
                {Object.values(ASSET_TYPES).map((t) => (
                  <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </Field>

            <Field label="UF de registro (necessário pra calcular vencimento de CRLV)">
              <select
                value={override.uf || ""}
                onChange={(e) => onUpdate("uf", e.target.value)}
                disabled={status === STATUS.SAVED || status === STATUS.SAVING}
              >
                <option value="">Selecione...</option>
                {ESTADOS_BR.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </Field>

            <Field label="Ano de vigência / exercício">
              <input
                type="number"
                value={override.year}
                onChange={(e) => onUpdate("year", Number(e.target.value))}
                disabled={status === STATUS.SAVED || status === STATUS.SAVING}
              />
            </Field>

            <Field
              label={
                override.categoryId === "crlv"
                  ? "Vencimento (calculado pelo calendário de licenciamento)"
                  : "Data de validade (se houver)"
              }
            >
              <input
                type="date"
                value={override.validUntil}
                onChange={(e) => onUpdate("validUntil", e.target.value)}
                disabled={status === STATUS.SAVED || status === STATUS.SAVING}
              />
              {override.categoryId === "crlv" && !override.validUntil && (
                <p style={{ color: "var(--status-vencendo)", fontSize: 12, marginTop: 4 }}>
                  Calendário de licenciamento ainda não cadastrado pra {override.uf || "esse estado"}
                  /{(override.year || 0) + 1}. Confirme a data direto no Detran do estado e preencha
                  manualmente.
                </p>
              )}
            </Field>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            {(status === STATUS.READY || status === STATUS.ERROR) && (
              <>
                <button
                  className="btn"
                  onClick={onConfirm}
                  disabled={!override.placaOuTag || !override.categoryId}
                >
                  Confirmar e salvar
                </button>
                <button className="btn secondary" onClick={onDiscard}>Descartar</button>
              </>
            )}
            {status === STATUS.SAVING && <span style={{ fontSize: 13, color: "#888" }}>Salvando...</span>}
            {status === STATUS.SAVED && (
              <span style={{ color: "var(--status-ok)", fontSize: 13, fontWeight: 600 }}>
                ✓ Salvo em {override.placaOuTag} / {getCategoryById(override.categoryId)?.label} / {override.year}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", fontSize: 13 }}>
      <span style={{ display: "block", color: "#777", marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }) {
  const map = {
    [STATUS.PENDING]: { label: "Na fila", cls: "faltante" },
    [STATUS.EXTRACTING]: { label: "Lendo...", cls: "vencendo" },
    [STATUS.READY]: { label: "Aguardando confirmação", cls: "vencendo" },
    [STATUS.SAVING]: { label: "Salvando...", cls: "vencendo" },
    [STATUS.ERROR]: { label: "Erro", cls: "vencido" },
    [STATUS.SAVED]: { label: "Salvo", cls: "ok" },
  };
  const { label, cls } = map[status] || {};
  return <span className={`badge ${cls}`}>{label}</span>;
}
