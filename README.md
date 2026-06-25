# Mills · Portal de Documentos da Frota

Portal pra centralizar documentos da frota (CRLV, IPVA, seguro, laudos, etc.),
com upload inteligente via IA, consulta/download por placa, e dashboard de
alertas de vencimento. Construído pra rodar 100% grátis, com um ponto único de
troca entre dois caminhos de armazenamento — você não precisa decidir isso
antes de começar a usar.

## O que já funciona

- **Painel de Consulta**: busca por placa/tag, visualização de documentos por
  ativo, download individual e download da pasta completa em `.zip`.
- **Painel de Upload de Documentos**: arraste PDF/PNG/JPG, a IA (Gemini 2.5
  Flash, mesmo padrão do mills-frotas) sugere placa, categoria, ano e
  validade. O analista confirma ou corrige antes de salvar — nada é gravado
  sem essa confirmação.
- **Painel de Gestão**: dashboard com contagem de vencidos / vencendo /
  faltantes / regularizados, filtro por célula, janela de aviso ajustável.
- **Motor de alertas** (`src/utils/alertEngine.js`): cruza categorias
  obrigatórias por tipo de ativo com os documentos cadastrados.
- **Dois adapters de storage intercambiáveis** (`src/services/`): Firebase
  Storage e Microsoft Graph/SharePoint, atrás da mesma interface. Trocar é uma
  linha de `.env` — nenhum componente sabe qual dos dois está ativo.
- **Modo demonstração automático**: sem `.env` configurado, o app inteiro
  funciona com dados mock. Assim que você preenche as credenciais reais, os
  painéis passam a usar o backend de verdade sem mudar código.

## Rodando localmente (GitHub Codespaces)

```bash
npm install
npm run dev
```

## Arquitetura: metadados sempre no Firestore, arquivo onde for melhor

Uma decisão de design importante: os **metadados** (placa, categoria, ano,
validade) ficam sempre no Firestore, não importa onde o arquivo físico mora.
Isso é o que faz o motor de alertas e os dois painéis funcionarem igual nos
dois cenários — só o `storageAdapter` muda.

```
src/services/
  storageAdapter.js          <- ponto único de seleção (lê VITE_STORAGE_PROVIDER)
  firebaseStorageAdapter.js  <- upload/download no Firebase Storage
  sharepointAuth.js          <- login MSAL + token do Microsoft Graph
  sharepointStorageAdapter.js<- upload/download via Graph API (SharePoint)
  firestoreService.js        <- metadados (sempre Firestore, dos dois lados)
  dataSource.js              <- decide mock vs. real conforme .env
```

## Rota A — Firebase Storage (pronta pra usar agora)

Não depende de nenhuma aprovação de TI. Setup:

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com).
2. Ative **Authentication**, **Firestore Database** e **Storage**.
3. Copie `.env.example` pra `.env`, preencha o bloco do Firebase e deixe
   `VITE_STORAGE_PROVIDER=firebase` (é o padrão).
4. Configure as **Firestore Rules** restringindo escrita a usuários
   autenticados com role analista/gestor.

**Limite real do tier gratuito (Spark)**: 5GB armazenados, 1GB de download por
dia. Pra ~250 ativos com renovação anual de documentos, deve caber
folgadamente — mas é um teto existente, vale monitorar pelo Console de tempos
em tempos.

## Rota B — SharePoint via Microsoft Graph (depende do TI)

Usa a licença M365 que a Mills já paga, sem teto de armazenamento adicional,
e o "salvar na pasta de rede" passa a ser automático (a biblioteca de
documentos sincroniza como pasta normal via OneDrive). Em troca, depende de
aprovação do time de TI/Infra, porque exige:

1. **App registration no Azure AD (Entra ID)** da Mills — alguém com permissão
   de admin do tenant precisa criar o registro e aprovar os escopos
   `Files.ReadWrite` e `Sites.ReadWrite.All` (este segundo normalmente exige
   **admin consent**, não basta o usuário aprovar sozinho).
2. Confirmar que não há **Conditional Access Policy** bloqueando acesso de
   fora da rede corporativa ou exigindo dispositivo gerenciado de um jeito que
   quebre o login do app.
3. Confirmar que não há **DLP** no SharePoint impedindo escrita automatizada
   nesses tipos de arquivo.

Setup, assim que o TI liberar:

1. TI cria o app registration e te passa **Client ID** e **Tenant ID**.
2. Descubra o **Site ID** do SharePoint onde vai ficar a biblioteca:
   ```
   GET https://graph.microsoft.com/v1.0/sites/{tenant}.sharepoint.com:/sites/{nome-do-site}
   ```
3. Preencha no `.env`: `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID`,
   `VITE_SHAREPOINT_SITE_ID`, e troque `VITE_STORAGE_PROVIDER=sharepoint`.
4. No primeiro upload, o app abre um popup de login Microsoft — o analista
   entra com a própria conta `@mills.com.br`.

**Limitação atual do adapter**: upload simples cobre arquivos até 4MB (cobre
CRLV, IPVA, laudos sem problema). Documentos maiores que isso exigiriam
"upload session" do Graph, que ainda não foi implementado — avise se precisar.

## Modelo de dados (Firestore, igual nas duas rotas)

```
/assets/{assetId}
  placaOuTag: string
  assetType: "caminhao" | "van" | "pesado" | "container_tanque"
  cell: string
  responsavel: string

/assets/{assetId}/documents/{documentId}
  categoryId: string
  year: number
  validUntil: string | null
  fileName: string
  fileUrl: string          // download direto (Firebase) ou Graph downloadUrl (SharePoint)
  storagePath: string      // placa/categoria/ano/arquivo
  graphItemId: string|null // só preenchido na rota SharePoint, necessário pra buscar o blob depois
  uploadedBy: string
  uploadedAt: timestamp
```

## Setup da chave do Gemini (upload com IA)

1. Crie uma chave gratuita em [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Cole em `VITE_GEMINI_API_KEY` no `.env`.
3. Sem isso, o Upload aceita os arquivos mas mostra erro na extração — o fluxo
   de confirmação manual continua funcionando, só sem sugestão automática.

## Roadmap / próximos passos

- Exportação do relatório de pendências em Excel (botão já existe no Painel
  de Gestão, falta plugar a geração real).
- Upload session do Graph API pra arquivos SharePoint maiores que 4MB, se
  necessário.
- Migrar `listDocumentsByAssetId` (N+1 leituras) pra uma coleção plana
  `/documents` com `assetId` indexado, se a frota crescer muito.
- Regras de segurança do Firestore restringindo leitura por célula, no mesmo
  espírito do "solicitantes não veem requests de outros" do mills-logistica.

## Decisões de escopo já fechadas

- Tacógrafo e ANTT/RNTRC se aplicam só a caminhões e vans.
- CIPP se aplica só a containers/tanques (transporte de produtos perigosos).
- CTPP (certificação do fabricante) ficou fora do portal.
- Contrato de locação não entra no escopo.
- Documentos do Manusis (OS, plano de manutenção) ficam fora do escopo.
