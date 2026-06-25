# Mills · Portal de Documentos da Frota

Portal pra centralizar documentos da frota (CRLV, IPVA, seguro, laudos, AETs,
etc.), com upload inteligente via IA, consulta/download por placa, dashboard
de alertas de vencimento, alerta automático por e-mail e controle de acesso
por aprovação. Construído pra rodar 100% grátis.

## O que já funciona

- **Painel de Consulta**: busca por placa/tag, visualização de documentos por
  ativo, download individual e download da pasta completa em `.zip`.
- **Painel de Upload de Documentos**: arraste PDF/PNG/JPG, a IA (Gemini 2.5
  Flash) sugere placa, categoria, ano e validade. Confirmação obrigatória do
  analista antes de salvar.
- **Painel de Gestão de Frotas**: dashboard com vencidos, vencendo em até 15
  dias, vencendo em até 30 dias, faltantes e regularizados — os dois patamares
  de aviso aparecem sempre juntos, não é mais um seletor único.
- **Painel de Gestão de Usuários** (só master): aprova, bloqueia ou exclui o
  cadastro de consultantes e outros papéis.
- **Login com aprovação**: qualquer pessoa pode se cadastrar, mas fica com
  status "pendente" até o master autorizar. Bloqueado = sem acesso a nada.
- **Alerta diário por e-mail**: GitHub Action agendada lê o Firestore e
  manda um e-mail (via Brevo, grátis) listando os ativos com pendência.
- **Dois adapters de storage intercambiáveis** (Firebase Storage / SharePoint
  via Graph API) — troca com uma linha de `.env`.
- **Modo demonstração automático**: sem `.env`, o app inteiro funciona com
  dados mock e um usuário master fake, sem precisar logar.

## Papéis de acesso

| Papel | Consulta | Upload | Gestão de Frotas | Gestão de Usuários |
|---|---|---|---|---|
| Consultante | ✅ | — | — | — |
| Analista | ✅ | ✅ | — | — |
| Gestor | ✅ | ✅ | ✅ | — |
| Master | ✅ | ✅ | ✅ | ✅ |

## Rodando localmente (GitHub Codespaces)

```bash
npm install
npm run dev
```

## Setup do Firebase (necessário pra login real, upload de verdade, alertas)

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com).
2. Ative **Authentication** → método **E-mail/senha**.
3. Ative **Firestore Database** e **Storage**.
4. Cole as regras de `firestore.rules` (deste repositório) em Firestore →
   Regras, no Console.
5. Copie `.env.example` pra `.env` e preencha o bloco do Firebase.

### Criando o primeiro usuário master (bootstrap manual, uma vez só)

Ninguém aprova o primeiro usuário, então esse passo é manual:
1. Acesse o portal e clique em "Solicitar acesso", cadastre seu e-mail e senha.
2. Vá no Firebase Console → Firestore → coleção `users` → ache o documento
   com seu UID → edite `role` para `master` e `status` para `ativo`.
3. Recarregue o portal — a partir daí, você aprova todo o resto pela própria
   tela de Gestão de Usuários.

## Setup do alerta diário por e-mail (GitHub Actions + Brevo)

1. Crie uma conta gratuita em [Brevo](https://www.brevo.com) (300 e-mails/dia
   no plano free) e gere uma API key em Configurações → SMTP & API → API Keys.
2. Gere uma chave de **service account** do Firebase: Console → Configurações
   do projeto → Contas de serviço → Gerar nova chave privada (baixa um JSON).
3. No repositório do GitHub: Settings → Secrets and variables → Actions:
   - **Secrets** (sensíveis):
     - `FIREBASE_SERVICE_ACCOUNT_JSON`: cole o conteúdo inteiro do JSON gerado
       no passo 2.
     - `BREVO_API_KEY`: a chave gerada no passo 1.
   - **Variables** (não-sensíveis):
     - `ALERT_SENDER_EMAIL`: e-mail remetente verificado no Brevo.
     - `ALERT_RECIPIENTS`: lista de e-mails separados por vírgula que devem
       receber o alerta (ex: `diego.soares@mills.com.br,bianca@mills.com.br`).
4. O workflow já está em `.github/workflows/daily-alerts.yml`, agendado pra
   rodar todo dia às 08:00 (horário de Brasília). Pra testar sem esperar o
   horário, vá em **Actions → Alerta diário de documentos da frota → Run
   workflow** (disparo manual).
5. O e-mail só é enviado se houver pelo menos um ativo com pendência —
   dia sem pendência, sem e-mail.

## Arquitetura de storage: metadados sempre no Firestore

```
src/services/
  storageAdapter.js          <- ponto único de seleção (lê VITE_STORAGE_PROVIDER)
  firebaseStorageAdapter.js  <- upload/download no Firebase Storage
  sharepointAuth.js          <- login MSAL + token do Microsoft Graph
  sharepointStorageAdapter.js<- upload/download via Graph API (SharePoint)
  firestoreService.js        <- metadados + gestão de usuários (sempre Firestore)
  dataSource.js               <- decide mock vs. real conforme .env
```

### Rota A — Firebase Storage (pronta agora)
Não depende de aprovação de TI. Limite do tier gratuito: 5GB armazenados,
1GB/dia de download.

### Rota B — SharePoint via Microsoft Graph (depende do TI)
Ver seção detalhada de setup mais abaixo — exige app registration no Azure AD
e aprovação dos escopos `Files.ReadWrite` e `Sites.ReadWrite.All`.

## Setup da chave do Gemini (upload com IA)

1. Chave gratuita em [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Cole em `VITE_GEMINI_API_KEY` no `.env`.

## Modelo de dados (Firestore)

```
/users/{uid}
  email: string
  name: string
  role: "master" | "gestor" | "analista" | "consultante"
  status: "pendente" | "ativo" | "bloqueado"
  requestedAt: timestamp

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
  fileUrl: string
  storagePath: string
  graphItemId: string|null
  uploadedBy: string
  uploadedAt: timestamp
```

## Categorias de documento (catálogo completo)

CRLV, IPVA, Seguro/Apólice, Licenciamento, Laudo de Tacógrafo, ANTT/RNTRC,
Certificado de Inspeção, CIV, CIPP, NF de Aquisição, Ficha Técnica,
**AET DER-SP, AET DER-PR, AET DER-MG, AGETOP-GO, DNIT**.

> As 5 últimas (AETs/AGETOP/DNIT) foram cadastradas como aplicáveis a
> **caminhão e equipamento pesado** — assumi isso porque são autorizações de
> trânsito pra carga indivisível/excesso de peso, tipicamente referenciando o
> conjunto transportador + equipamento. Se algum desses não fizer sentido pro
> seu caso (ex: só se aplica ao caminhão-prancha, não ao equipamento em si),
> me avisa que ajusto em `src/config/categories.js`.

## Decisões de escopo já fechadas

- Tacógrafo, ANTT/RNTRC e as AETs/AGETOP/DNIT se aplicam a caminhões e vans
  (AETs também a equipamento pesado — ver nota acima).
- CIPP se aplica só a containers/tanques.
- CTPP (certificação do fabricante) e Contrato de locação ficaram fora do
  portal.
- Documentos do Manusis (OS, plano de manutenção) ficam fora do escopo.
- Alerta por e-mail vai pra uma lista fixa de endereços (variável
  `ALERT_RECIPIENTS`), não por responsável individual do ativo.

## Roadmap / próximos passos

- Exportação do relatório de pendências em Excel (botão já existe).
- Upload session do Graph API pra arquivos SharePoint maiores que 4MB.
- Migrar `listDocumentsByAssetId` (N+1 leituras) pra coleção plana se a frota
  crescer muito.
- Exclusão definitiva de conta de Auth (hoje só remove o acesso via Firestore,
  não a conta de login) — precisaria de Cloud Function ou Action específica.
