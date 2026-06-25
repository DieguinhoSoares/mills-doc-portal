// Roda fora do Vite (Node puro), disparado pelo GitHub Actions agendado.
// Reaproveita o MESMO motor de alertas e catálogo de categorias do app React —
// garante que o e-mail nunca diverge da lógica que aparece no Painel de Gestão.
import admin from "firebase-admin";
import { buildFleetAlertSummary, ALERT_STATUS } from "../src/utils/alertEngine.js";
import { getCategoryById } from "../src/config/categories.js";

const STATUS_LABEL = {
  [ALERT_STATUS.VENCIDO]: "Vencido",
  [ALERT_STATUS.VENCENDO_15]: "Vence em até 15 dias",
  [ALERT_STATUS.VENCENDO_30]: "Vence em até 30 dias",
  [ALERT_STATUS.FALTANTE]: "Faltante",
};

function initFirebaseAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Secret FIREBASE_SERVICE_ACCOUNT_JSON não configurado no GitHub Actions.");
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin.firestore();
}

async function loadAssetsAndDocuments(db) {
  const assetsSnap = await db.collection("assets").get();
  const assets = assetsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const documentsByAssetId = {};
  await Promise.all(
    assets.map(async (asset) => {
      const docsSnap = await db.collection("assets").doc(asset.id).collection("documents").get();
      documentsByAssetId[asset.id] = docsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    })
  );

  return { assets, documentsByAssetId };
}

function buildEmailHtml(detail) {
  const relevant = detail.filter((d) => d.worstStatus !== ALERT_STATUS.OK);

  if (relevant.length === 0) {
    return null; // nada pra reportar hoje
  }

  const rows = relevant
    .map(({ asset, panel }) => {
      const pendencias = panel.filter((p) => p.status !== ALERT_STATUS.OK);
      const items = pendencias
        .map((p) => `<li>${getCategoryById(p.categoryId)?.label || p.categoryId}: <strong>${STATUS_LABEL[p.status]}</strong></li>`)
        .join("");
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;"><strong>${asset.placaOuTag}</strong><br/><span style="color:#777;font-size:12px;">${asset.cell || ""} ${asset.responsavel ? "· " + asset.responsavel : ""}</span></td>
          <td style="padding:8px;border-bottom:1px solid #eee;"><ul style="margin:0;padding-left:18px;">${items}</ul></td>
        </tr>`;
    })
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#004042;">
      <h2 style="color:#F37021;">Mills · Alerta diário de documentos da frota</h2>
      <p>${relevant.length} ativo(s) com pendência de documentação:</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="text-align:left;background:#EBE3C7;">
            <th style="padding:8px;">Ativo</th>
            <th style="padding:8px;">Pendências</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:16px;font-size:12px;color:#999;">
        E-mail automático gerado pelo Portal de Documentos da Frota Mills.
      </p>
    </div>`;
}

async function sendEmailViaBrevo(htmlContent) {
  const apiKey = process.env.BREVO_API_KEY;
  const recipients = (process.env.ALERT_RECIPIENTS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!apiKey) throw new Error("Secret BREVO_API_KEY não configurado no GitHub Actions.");
  if (recipients.length === 0) throw new Error("Variável ALERT_RECIPIENTS vazia — adicione ao menos um e-mail.");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: "Mills Portal de Frota", email: process.env.ALERT_SENDER_EMAIL },
      to: recipients.map((email) => ({ email })),
      subject: "Mills · Alerta diário de documentos da frota",
      htmlContent,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao enviar e-mail via Brevo (${response.status}): ${body.slice(0, 300)}`);
  }
}

async function main() {
  const db = initFirebaseAdmin();
  const { assets, documentsByAssetId } = await loadAssetsAndDocuments(db);
  const { detail } = buildFleetAlertSummary(assets, documentsByAssetId);

  const html = buildEmailHtml(detail);
  if (!html) {
    console.log("Nenhuma pendência hoje — e-mail não enviado.");
    return;
  }

  await sendEmailViaBrevo(html);
  console.log("E-mail de alerta enviado com sucesso.");
}

main().catch((err) => {
  console.error("Erro no script de alertas:", err.message);
  process.exit(1);
});
