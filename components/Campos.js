'use client'

export function Campo({ label, id, valor, onChange, tipo = 'text', placeholder, dica, aviso, desabilitado, step }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      <input id={id} type={tipo} step={step} value={valor ?? ''} placeholder={placeholder} disabled={desabilitado} onChange={(e) => onChange(e.target.value)} aria-describedby={aviso || dica ? `${id}-d` : undefined}
        className="w-full rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate/60 focus:border-bronze focus:outline-none disabled:bg-ink/5" />
      {(aviso || dica) && <p id={`${id}-d`} className={`mt-1 text-xs ${aviso ? 'text-selo-warning' : 'text-slate'}`}>{aviso || dica}</p>}
    </div>
  )
}

export function Selecao({ label, id, valor, onChange, opcoes, desabilitado }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      <select id={id} value={valor ?? ''} disabled={desabilitado} onChange={(e) => onChange(e.target.value)} className="w-full rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm text-ink disabled:bg-ink/5">
        {opcoes.map((o) => (<option key={o.valor} value={o.valor}>{o.rotulo}</option>))}
      </select>
    </div>
  )
}

export function Marca({ id, label, valor, onChange, desabilitado, dica }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm text-ink">
      <input id={id} type="checkbox" checked={!!valor} disabled={desabilitado} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <span>{label}{dica && <span className="block text-xs text-slate">{dica}</span>}</span>
    </label>
  )
}
