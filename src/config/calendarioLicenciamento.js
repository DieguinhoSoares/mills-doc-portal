/**
 * O CRLV-e NÃO tem data de vencimento impressa no documento - ele só
 * confirma que o "exercício" (ano) indicado já está pago. O vencimento real
 * é o prazo definido pelo Detran de cada estado pra pagar o licenciamento do
 * EXERCÍCIO SEGUINTE, e esse prazo muda todo ano e varia por estado (alguns
 * têm data única, outros escalonam por final de placa, alguns distinguem
 * veículos leves de pesados).
 *
 * IMPORTANTE - LIMITAÇÃO CONHECIDA:
 * Tabela cobre só os estados confirmados com o Diego em 28/06/2026, cruzados
 * com busca própria em fontes da Detran/imprensa especializada no momento da
 * construção (SP leves e taxa do PR bateram exatamente com fontes
 * independentes; SP pesados e os dias específicos do PR não foram
 * re-confirmados nó-a-nó por uma segunda fonte, mas são consistentes entre
 * duas consultas separadas). Estados ou anos ausentes retornam `null`
 * propositalmente - melhor pedir preenchimento manual do que arriscar uma
 * data errada num documento de compliance.
 *
 * MANUTENÇÃO: os Detrans publicam o calendário do exercício seguinte
 * geralmente entre janeiro e março. Revisar e completar esta tabela todo
 * início de ano usando como fonte o portal oficial do Detran de cada estado
 * (nunca blogs/sites de terceiros como fonte definitiva).
 */

// "categoria" no licenciamento: CAMINHAO conta como "pesado", VAN como "leve".
function categoriaLicenciamento(assetType) {
  return assetType === "caminhao" ? "pesado" : "leve";
}

export const CALENDARIO_LICENCIAMENTO = {
  SP: {
    2026: {
      type: "porFinalPlacaPorCategoria",
      leve: [
        { finais: [1, 2], data: "07-31" },
        { finais: [3, 4], data: "08-31" },
        { finais: [5, 6], data: "09-30" },
        { finais: [7, 8], data: "10-31" },
        { finais: [9], data: "11-30" },
        { finais: [0], data: "12-31" },
      ],
      pesado: [
        { finais: [1, 2], data: "09-30" },
        { finais: [3, 4], data: "10-31" },
        { finais: [5], data: "10-31" },
        { finais: [6], data: "11-30" },
        { finais: [7, 8], data: "11-30" },
        { finais: [9, 0], data: "12-31" },
      ],
    },
    2027: null, // preencher quando o Detran-SP divulgar (geralmente até março/2027)
  },
  PR: {
    2026: {
      // Detran-PR usa o mesmo calendário pra leves e pesados.
      type: "porFinalPlaca",
      faixas: [
        { finais: [1], data: "08-14" },
        { finais: [2], data: "08-28" },
        { finais: [3], data: "09-09" },
        { finais: [4], data: "09-18" },
        { finais: [5], data: "09-28" },
        { finais: [6], data: "10-09" },
        { finais: [7], data: "10-20" },
        { finais: [8], data: "10-30" },
        { finais: [9], data: "11-13" },
        { finais: [0], data: "11-27" },
      ],
    },
    2027: null,
  },
  MG: {
    // TRLAV (taxa de licenciamento) vence em data única, mesma pra todas as
    // placas e categorias - é o gatilho que efetivamente libera o novo CRLV.
    2026: { type: "unico", data: "03-31" },
    2027: null,
  },
};

export const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

/**
 * Calcula o vencimento real do licenciamento (prazo pra pagar o exercício
 * seguinte) com base no estado de registro, no exercício pago indicado no
 * CRLV, no final da placa, e no tipo de ativo (leve/pesado, só importa pra
 * estados como SP que diferenciam).
 *
 * @returns {string|null} Data no formato YYYY-MM-DD, ou null se não houver
 *   dado confiável cadastrado pra esse estado/ano/categoria - nesse caso, o
 *   analista precisa preencher manualmente consultando o Detran do estado.
 */
export function calcularVencimentoLicenciamento({ uf, exercicioPago, placa, assetType }) {
  if (!uf || !exercicioValido(exercicioPago)) return null;

  const proximoExercicio = exercicioPago + 1;
  const calendarioEstado = CALENDARIO_LICENCIAMENTO[uf]?.[proximoExercicio];
  if (!calendarioEstado) return null;

  const finalPlaca = Number(String(placa).replace(/\D/g, "").slice(-1));

  if (calendarioEstado.type === "unico") {
    return `${proximoExercicio}-${calendarioEstado.data}`;
  }

  if (calendarioEstado.type === "porFinalPlaca") {
    const faixa = calendarioEstado.faixas.find((f) => f.finais.includes(finalPlaca));
    return faixa ? `${proximoExercicio}-${faixa.data}` : null;
  }

  if (calendarioEstado.type === "porFinalPlacaPorCategoria") {
    const categoria = categoriaLicenciamento(assetType);
    const faixas = calendarioEstado[categoria];
    const faixa = faixas?.find((f) => f.finais.includes(finalPlaca));
    return faixa ? `${proximoExercicio}-${faixa.data}` : null;
  }

  return null;
}

function exercicioValido(ano) {
  return Number.isInteger(ano) && ano > 2000 && ano < 2100;
}
