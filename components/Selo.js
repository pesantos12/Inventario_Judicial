import { ESTADOS } from '@/lib/estados'

const TONS = {
  sucesso: { cor: 'text-selo-success border-selo-success', ponto: 'bg-selo-success' },
  bronze: { cor: 'text-bronze-dark border-bronze', ponto: 'bg-bronze' },
  alerta: { cor: 'text-selo-warning border-selo-warning', ponto: 'bg-selo-warning' },
  perigo: { cor: 'text-selo-danger border-selo-danger', ponto: 'bg-selo-danger' },
  neutro: { cor: 'text-selo-neutral border-selo-neutral', ponto: 'bg-selo-neutral' },
}

// Compatibilidade com as telas ainda não adaptadas (vocabulário antigo).
const LEGADO = {
  concluido: ['sucesso', 'Concluído'],
  em_analise: ['bronze', 'Em análise'],
  pendente: ['alerta', 'Pendente'],
  rejeitado: ['perigo', 'Rejeitado'],
  nao_iniciado: ['neutro', 'Não iniciado'],
}

/**
 * Selo: badge de estado. Use `estado` com o vocabulário da especificação (lib/estados.js);
 * `status` mantém o vocabulário antigo. `simulado` acrescenta a marca de dado simulado
 * (leitura automática de teste, nunca confirmação do conteúdo).
 */
export default function Selo({ estado, status, texto, simulado = false, titulo }) {
  let tom = 'neutro'
  let rotulo = texto
  if (estado) {
    const e = ESTADOS[estado]
    tom = e?.tom || 'neutro'
    rotulo = texto || e?.rotulo || estado
  } else {
    const [t, r] = LEGADO[status] || LEGADO.pendente
    tom = t
    rotulo = texto || r
  }
  const estilo = TONS[tom] || TONS.neutro
  return (
    <span className="inline-flex items-center gap-1" title={titulo}>
      <span className={`inline-flex items-center gap-1.5 rounded-sm border bg-white/60 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${estilo.cor}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${estilo.ponto}`} />
        {rotulo}
      </span>
      {simulado && (
        <span className="rounded-sm border border-dashed border-slate px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate" title="Resultado simulado, sem leitura real do documento">
          Simulado
        </span>
      )}
    </span>
  )
}
