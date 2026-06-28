import { DOCUMENT_CATEGORIES, ASSET_TYPES } from "../config/categories";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Mesma chave usada no mills-frotas — Google AI Studio, tier gratuito.
// Crie em https://aistudio.google.com/app/apikey e coloque em .env como VITE_GEMINI_API_KEY
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function buildPrompt() {
  const categoryList = DOCUMENT_CATEGORIES.map((c) => `- ${c.id}: ${c.label}`).join("\n");
  const assetTypeList = Object.values(ASSET_TYPES).join(", ");

  return `Você é um classificador de documentos de frota da empresa Mills (locação de equipamentos pesados e veículos leves).

Analise o documento anexado (PDF ou imagem) e extraia as seguintes informações. Responda APENAS com um JSON válido, sem markdown, sem texto adicional, no seguinte formato exato:

{
  "placaOuTag": string ou null,
  "categoryId": uma das opções abaixo ou null,
  "assetTypeGuess": uma de [${assetTypeList}] ou null,
  "ufRegistro": sigla do estado de registro do veículo (ex: "SP", "MG") ou null,
  "year": número (ano de vigência/emissão do documento, ou o "exercício" no caso de CRLV) ou null,
  "validUntil": "YYYY-MM-DD" ou null (data de vencimento/validade, se o documento tiver uma impressa),
  "confidence": número de 0 a 1 (sua confiança na classificação)
}

Categorias válidas para "categoryId":
${categoryList}

Regras:
- Se não conseguir identificar a placa com certeza, retorne null em "placaOuTag" — não invente.
- ATENÇÃO ESPECIAL PARA CRLV: o CRLV-e (Certificado de Registro e Licenciamento de Veículo eletrônico) NÃO tem
  data de vencimento impressa - ele só mostra o "exercício" (ano) que está pago, normalmente no campo
  "Exercício" ou similar. Para documentos da categoria crlv, SEMPRE retorne "validUntil": null, e coloque o
  exercício/ano pago no campo "year". Nunca invente uma data de vencimento para CRLV a partir da data de
  emissão - isso seria um erro de compliance, porque o vencimento real depende do calendário do Detran do
  estado, que é calculado separadamente pelo sistema.
- Para as demais categorias com data de vencimento impressa de fato (ex: Seguro/Apólice, IPVA quando aplicável,
  Licenciamento, AETs), extraia normalmente a data real do documento em "validUntil".
- Se o documento não tiver data de vencimento (ex: nota fiscal, ficha técnica), retorne null em "validUntil".
- "year" deve ser o ano de vigência/exercício do documento, não a data de hoje.
- Tente identificar "ufRegistro" pela placa (padrão Mercosul/antigo não indica estado) ou por menção explícita
  no documento ao órgão emissor (ex: "Detran-SP" indica ufRegistro "SP"). Se não tiver certeza, retorne null.
- Seja conservador: se tiver dúvida real entre duas categorias, escolha a mais provável mas reduza "confidence".`;
}

function getMimeType(file) {
  if (file.type) return file.type;
  if (file.name.toLowerCase().endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function parseJsonResponse(rawText) {
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("A resposta da IA não veio em JSON válido. Tente novamente ou classifique manualmente.");
  }
}

/**
 * Envia um arquivo (PDF/PNG/JPG) pro Gemini e recebe de volta a classificação sugerida.
 * Nunca salva nada sozinho — quem decide e confirma é o analista, na tela de upload.
 */
export async function extractDocumentMetadata(file) {
  if (!API_KEY) {
    throw new Error(
      "VITE_GEMINI_API_KEY não configurada. Adicione sua chave gratuita do Google AI Studio no .env."
    );
  }

  const base64Data = await fileToBase64(file);

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: buildPrompt() },
            { inlineData: { mimeType: getMimeType(file), data: base64Data } },
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Erro na API do Gemini (${response.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Resposta vazia da IA.");

  const parsed = parseJsonResponse(rawText);

  const validCategory = DOCUMENT_CATEGORIES.some((c) => c.id === parsed.categoryId);
  if (!validCategory) parsed.categoryId = null;

  return parsed;
}
