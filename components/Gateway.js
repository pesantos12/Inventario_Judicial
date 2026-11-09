'use client'

export const OPCOES = [
  { v: 'sim', r: 'Sim' },
  { v: 'nao', r: 'Não' },
  { v: 'nao_sei', r: 'Não sei' },
  { v: 'nao_se_aplica', r: 'Não se aplica' },
]

/**
 * Pergunta de triagem (gateway) com quatro respostas. "Não sei" é uma resposta própria:
 * nunca é convertida em "não" (a plataforma não presume ausência de testamento, cônjuge, conflito etc.).
 */
export default function Gateway({ id, pergunta, ajuda, valor, onChange, desabilitado }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0" role="group" aria-labelledby={`${id}-q`}>
      <p id={`${id}-q`} className="text-sm font-medium text-ink">{pergunta}</p>
      {ajuda && <p className="mt-0.5 text-xs text-slate">{ajuda}</p>}
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={pergunta}>
        {OPCOES.map((o) => {
          const ativo = valor === o.v
          return (
            <label key={o.v} className={`cursor-pointer rounded-sm border px-3 py-1.5 text-sm transition-colors ${ativo ? (o.v === 'nao_sei' ? 'border-selo-warning bg-selo-warning/10 text-selo-warning' : 'border-ink bg-ink text-parchment') : 'border-ink/15 bg-white text-ink/80 hover:bg-ink/5'} ${desabilitado ? 'opacity-60' : ''}`}>
              <input type="radio" name={id} value={o.v} checked={ativo} disabled={desabilitado} onChange={() => onChange(o.v)} className="sr-only" />
              {o.r}
            </label>
          )
        })}
      </div>
      {valor === 'nao_sei' && <p className="mt-2 text-xs text-selo-warning">Resposta "não sei" não é tratada como "não": a plataforma sinaliza a necessidade de verificar.</p>}
    </div>
  )
}
