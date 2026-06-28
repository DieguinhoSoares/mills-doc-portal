import Papa from "papaparse";
import { ASSET_TYPES } from "../config/categories";

/**
 * O export do SIM vem com DUAS linhas de cabeçalho (grupo + campo real) e
 * separador ";". Pulamos a primeira linha de cabeçalho e usamos a segunda.
 */
const STATUS_ARQUIVAR = ["Vendido", "Sinistrado", "Devolvido p/ terceiros"];

function inferAssetType(familia) {
  if (!familia) return ASSET_TYPES.PESADO;
  if (familia.startsWith("Caminhão") || familia === "Cavalo Mecânico") return ASSET_TYPES.CAMINHAO;
  if (familia === "Carretinha" || familia === "Semirreboque Florestal") return ASSET_TYPES.CAMINHAO;
  if (familia === "Veículo Utilitário" || familia === "Veículo Passeio") return ASSET_TYPES.VAN;
  if (familia === "Container") return ASSET_TYPES.CONTAINER_TANQUE;
  return ASSET_TYPES.PESADO;
}

function extractUf(estadoPlantaObra) {
  // Vem como "Assis (SP)" - extrai a sigla entre parênteses no final.
  if (!estadoPlantaObra) return "";
  const match = estadoPlantaObra.match(/\(([A-Z]{2})\)\s*$/);
  return match ? match[1] : "";
}

/**
 * Recebe o texto do CSV e devolve uma lista normalizada de registros, prontos
 * pra comparar/gravar no Firestore. Não grava nada sozinho - quem confirma é
 * o master/gestor, depois de ver a prévia.
 */
export function parseSimCsv(fileText) {
  const parsed = Papa.parse(fileText, {
    delimiter: ";",
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(`Erro ao ler o CSV: ${parsed.errors[0].message}`);
  }

  const rows = parsed.data;
  if (rows.length < 3) throw new Error("CSV vazio ou sem dados.");

  // Linha 0 = grupo (ignorar), linha 1 = nomes de campo reais
  const headers = rows[1];
  const dataRows = rows.slice(2);

  const idx = {
    placa: headers.indexOf("Placa"),
    codigoAtivo: headers.indexOf("Código ativo"),
    familia: headers.indexOf("Família"),
    status: headers.indexOf("Status"),
    estadoPlantaObra: headers.indexOf("Estado (Planta/Obra)"),
    fabricante: headers.indexOf("Fabricante"),
    modelo: headers.indexOf("Modelo"),
  };

  const faltando = Object.entries(idx)
    .filter(([, i]) => i === -1)
    .map(([campo]) => campo);
  if (faltando.length > 0) {
    throw new Error(`Colunas não encontradas no CSV: ${faltando.join(", ")}`);
  }

  return dataRows
    .filter((row) => row[idx.placa] || row[idx.codigoAtivo]) // ignora linhas vazias no fim
    .map((row) => {
      const familia = row[idx.familia] || "";
      const status = row[idx.status] || "";
      return {
        placaOuTag: (row[idx.placa] || row[idx.codigoAtivo] || "").trim(),
        numeroFrota: (row[idx.codigoAtivo] || "").trim(),
        familia,
        assetType: inferAssetType(familia),
        uf: extractUf(row[idx.estadoPlantaObra]),
        statusOperacional: status,
        arquivado: STATUS_ARQUIVAR.includes(status),
        fabricante: (row[idx.fabricante] || "").trim(),
        modelo: (row[idx.modelo] || "").trim(),
      };
    })
    .filter((r) => r.placaOuTag); // descarta registros sem identificador nenhum
}
