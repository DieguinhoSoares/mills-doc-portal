/**
 * Mapeia cada "Família" do SIM (subtipo detalhado do ativo) pra lista de
 * categorias de documento obrigatórias. Isso substitui o mapeamento antigo,
 * mais genérico, por tipo de ativo (caminhão/van/pesado/container) - a
 * Família dá uma granularidade muito melhor (ex: "Caminhão Basculante" não
 * precisa de CIV, mas "Caminhão Comboio" precisa de CIPP).
 *
 * Decisões confirmadas com o Diego em 29/06/2026:
 * - Caminhão Comboio: exige CIPP (transporta combustível/óleo)
 * - Caminhão Fora de Estrada: roda em via pública, exige documentação completa
 * - Carretinha/Semirreboque Florestal: têm placa própria (CRLV/IPVA/Licenciamento,
 *   sem Tacógrafo já que não têm motor)
 *
 * MANUTENÇÃO: se aparecer uma Família nova no CSV do SIM que não está aqui,
 * o sistema cai no fallback genérico (FALLBACK_CATEGORIAS) e avisa no log de
 * importação - revisar e adicionar aqui quando acontecer.
 */

// --- Conjuntos de categorias reutilizáveis ---
const VEICULO_RODOVIARIO_COMPLETO = [
  "crlv", "ipva", "seguro_apolice", "licenciamento", "tacografo",
  "antt_rntrc", "certificado_inspecao", "nf_aquisicao", "ficha_tecnica",
];

const VEICULO_RODOVIARIO_PRODUTO_PERIGOSO = [...VEICULO_RODOVIARIO_COMPLETO, "cipp"];

const REBOQUE_COM_PLACA = [
  "crlv", "ipva", "seguro_apolice", "licenciamento", "nf_aquisicao", "ficha_tecnica",
];

const VEICULO_LEVE = [
  "crlv", "ipva", "seguro_apolice", "licenciamento", "certificado_inspecao",
  "nf_aquisicao", "ficha_tecnica",
];

const EQUIPAMENTO_FORA_DE_ESTRADA = ["seguro_apolice", "nf_aquisicao", "ficha_tecnica"];

const IMPLEMENTO_OU_ACESSORIO = ["nf_aquisicao", "ficha_tecnica"];

const CONTAINER_PRODUTO_PERIGOSO = ["seguro_apolice", "cipp", "nf_aquisicao", "ficha_tecnica"];

// --- Mapeamento Família -> categorias ---
export const FAMILIA_CATEGORIAS = {
  // Caminhões - documentação rodoviária completa
  "Caminhão Basculante": VEICULO_RODOVIARIO_COMPLETO,
  "Caminhão Pipa": VEICULO_RODOVIARIO_COMPLETO,
  "Caminhão Carroceria": VEICULO_RODOVIARIO_COMPLETO,
  "Caminhão Guindauto": VEICULO_RODOVIARIO_COMPLETO,
  "Caminhão Betoneira": VEICULO_RODOVIARIO_COMPLETO,
  "Caminhão Transtora": VEICULO_RODOVIARIO_COMPLETO,
  "Caminhão Plataforma Linha Branca": VEICULO_RODOVIARIO_COMPLETO,
  "Caminhão Fora de Estrada": VEICULO_RODOVIARIO_COMPLETO,
  "Caminhão Varredeira": VEICULO_RODOVIARIO_COMPLETO,
  "Caminhão Autocarregável": VEICULO_RODOVIARIO_COMPLETO,
  "Cavalo Mecânico": VEICULO_RODOVIARIO_COMPLETO,

  // Caminhão que carrega produto perigoso (combustível/óleo)
  "Caminhão Comboio": VEICULO_RODOVIARIO_PRODUTO_PERIGOSO,

  // Reboques com placa própria, sem motor (sem Tacógrafo/ANTT)
  "Carretinha": REBOQUE_COM_PLACA,
  "Semirreboque Florestal": REBOQUE_COM_PLACA,

  // Veículos leves
  "Veículo Utilitário": VEICULO_LEVE,
  "Veículo Passeio": VEICULO_LEVE,

  // Linha Amarela / Verde / Florestal - equipamento fora de estrada
  "Carregadeira de Pneus": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Escavadeira de esteiras": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Escavadeira de Pneus": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Mini Escavadeira": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Motoniveladora": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Trator Agrícola": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Trator de Esteiras": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Compactador Vibratório": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Compactador de Pneus": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Compactador Tandem": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Mini Compactador": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Retroescavadeira": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Mini Carregadeira": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Feller Buncher de Esteira": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Feller Buncher de Pneus": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Skidder Pneus": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Track Dumper": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Plataforma Articulada": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Plataforma Elevatória": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Máquina Florestal": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Cabeçote Florestal": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Picador Florestal": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Gerador": EQUIPAMENTO_FORA_DE_ESTRADA,

  // Intralogística
  "Empilhadeira GLP": EQUIPAMENTO_FORA_DE_ESTRADA, // tem combustão, mas não roda fora do armazém
  "Empilhadeira Diesel": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Empilhadeira Retratil": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Empilhadeira Todo Terreno": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Empilhadeira Elétrica": EQUIPAMENTO_FORA_DE_ESTRADA,
  "Transpaleteira Eletrica": IMPLEMENTO_OU_ACESSORIO,
  "Rebocador Eletrico": IMPLEMENTO_OU_ACESSORIO,
  "Rebocador": IMPLEMENTO_OU_ACESSORIO,

  // Implementos e acessórios (não circulam sozinhos, não têm registro próprio)
  "Implemento Rodoviário": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Máquina Caçamba Carregadeira": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Máquina Caçamba Escavadeira": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Máquina Grade Aradora": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Máquina Braço e Garra Fixa": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Máquina Engate Rápido Carregadeira": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Máquina Garfo Pallet": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Máquina Rompedor Hidráulico": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Máquina Plaina": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Máquina Vassoura Mecânica": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Sobre Chassis Caminhão Pipa": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Sobre Chassis Caminhão Guindauto": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Sobre Chassis Caminhão Betoneira": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Sobre Chassis Caminhão Báscula": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Sobre Chassis Caminhão Comboio": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Sobre Chassis Caminhão Bau": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Sobre Chassis Caminhão Guincho Rodoviário": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Giratório": IMPLEMENTO_OU_ACESSORIO,
  "Implemento Sistema 3": IMPLEMENTO_OU_ACESSORIO,
  "Garra Florestal": IMPLEMENTO_OU_ACESSORIO,
  "Prolongador de Eixo": IMPLEMENTO_OU_ACESSORIO,
  "Espeto": IMPLEMENTO_OU_ACESSORIO,
  "Kit Rádio Controle": IMPLEMENTO_OU_ACESSORIO,
  "Kit Anfibio": IMPLEMENTO_OU_ACESSORIO,
  "Roçadeira Rádio Controlada": IMPLEMENTO_OU_ACESSORIO,
  "Posicionador de Garfos": IMPLEMENTO_OU_ACESSORIO,
  "Long Reach": IMPLEMENTO_OU_ACESSORIO,
  "Boom Híbrido": IMPLEMENTO_OU_ACESSORIO,
  "Boom Diesel": IMPLEMENTO_OU_ACESSORIO,
  "Caçamba Retroescavadeira": IMPLEMENTO_OU_ACESSORIO,
  "Rampa Reboque": IMPLEMENTO_OU_ACESSORIO,
  "Carroceria Plataforma Transtora": IMPLEMENTO_OU_ACESSORIO,
  "Medidor Volumétrico de Carga": IMPLEMENTO_OU_ACESSORIO,
  "Georeferenciador": IMPLEMENTO_OU_ACESSORIO,
  "Piloto Automático": IMPLEMENTO_OU_ACESSORIO,
  "Material Rodante": IMPLEMENTO_OU_ACESSORIO,

  // Baterias e infraestrutura de carga - sem documentação de trânsito
  "Bateria Tracionária": IMPLEMENTO_OU_ACESSORIO,
  "Carregador de bateria": IMPLEMENTO_OU_ACESSORIO,
  "Berço de Bateria": IMPLEMENTO_OU_ACESSORIO,
  "Carregador Horizontal": IMPLEMENTO_OU_ACESSORIO,
  "Carrinho de Baterias": IMPLEMENTO_OU_ACESSORIO,
  "Base de Bateria": IMPLEMENTO_OU_ACESSORIO,

  // Container (produto perigoso)
  "Container": CONTAINER_PRODUTO_PERIGOSO,
};

// Usado quando aparece uma Família nova que ainda não está mapeada acima -
// fica no nível mais conservador (só o básico), pra não gerar alerta falso
// nem deixar passar batido. O importador de CSV avisa quando isso acontece.
export const FALLBACK_CATEGORIAS = ["nf_aquisicao", "ficha_tecnica"];

export function getCategoriasPorFamilia(familia) {
  return FAMILIA_CATEGORIAS[familia] || FALLBACK_CATEGORIAS;
}
