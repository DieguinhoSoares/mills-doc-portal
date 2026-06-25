import { PublicClientApplication } from "@azure/msal-browser";

// Preencha após o registro do app no Azure AD (Entra ID) da Mills.
// Veja instruções completas no README, seção "Setup SharePoint/Graph API".
const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID;
const TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID;

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage", // evita persistir token entre sessões diferentes do navegador
  },
};

// Escopos delegados: o usuário aprova com a própria conta Mills.
// Files.ReadWrite cobre o próprio OneDrive; Sites.ReadWrite.All é necessário
// pra escrever numa biblioteca de SharePoint compartilhada (geralmente exige
// admin consent do TI — é exatamente o ponto que está em aberto com eles).
export const GRAPH_SCOPES = ["Files.ReadWrite", "Sites.ReadWrite.All", "User.Read"];

let msalInstance = null;

function getMsalInstance() {
  if (!CLIENT_ID || !TENANT_ID) {
    throw new Error(
      "VITE_AZURE_CLIENT_ID / VITE_AZURE_TENANT_ID não configurados. " +
        "Só serão necessários se o TI liberar o app registration no Azure AD da Mills."
    );
  }
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
  }
  return msalInstance;
}

/**
 * Garante login e devolve um access token válido pra chamar o Microsoft Graph.
 * Tenta silenciosamente primeiro; se não houver sessão, abre popup de login
 * com a conta corporativa do usuário (login.microsoftonline.com).
 */
export async function getGraphToken() {
  const instance = getMsalInstance();
  await instance.initialize();

  const accounts = instance.getAllAccounts();

  if (accounts.length > 0) {
    try {
      const result = await instance.acquireTokenSilent({
        scopes: GRAPH_SCOPES,
        account: accounts[0],
      });
      return result.accessToken;
    } catch {
      // cai pro popup abaixo se o token silencioso falhar (expirado, revogado, etc.)
    }
  }

  const result = await instance.loginPopup({ scopes: GRAPH_SCOPES });
  return result.accessToken;
}
