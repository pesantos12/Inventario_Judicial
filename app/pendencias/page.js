'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Selo from '@/components/Selo'
import CasoGuard from '@/components/CasoGuard'
import Tratamento from '@/components/Tratamento'
import { PENDENCIA_ORDEM, MENSAGENS } from '@/lib/estados'

const ORIGEM = { exigencia: 'Exigência documental', alerta: 'Alerta de revisão', historico: 'Histórico' }

function Conteudo({ caso, user, recarregar }) {
  const [estado, setEstado] = useState('abertas')
  const [sev, setSev] = useState('todas')
  const todas = caso.pendencias
  const final = (p) => ['RESOLVIDA', 'DISPENSADA_COM_MOTIVO'].includes(p.tratamento.estado)
  const lista = todas.filter((p) => (estado === 'abertas' ? !final(p) : estado === 'encerradas' ? final(p) : true) && (sev === 'todas' || p.severidade === sev))
  const contagem = PENDENCIA_ORDEM.map((e) => [e, todas.filter((p) => p.tratamento.estado === e).length])

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-widest text-bronze-dark">Acompanhamento · {caso.id}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Pendências</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate">Reúne exigências ainda não atendidas e alertas que pedem revisão. Pendências não bloqueiam o rascunho: orientam o trabalho e ficam registradas com responsável e motivo.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-5">
        {contagem.map(([e, n]) => (<Card key={e} className="!p-4"><Selo estado={e} /><p className="mt-2 font-display text-2xl font-semibold text-ink">{n}</p></Card>))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="f-estado" className="text-slate">Mostrar</label>
        <select id="f-estado" value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-sm border border-ink/15 bg-white px-2 py-1.5"><option value="abertas">Em aberto</option><option value="encerradas">Encerradas</option><option value="todas">Todas</option></select>
        <label htmlFor="f-sev" className="text-slate">Gravidade</label>
        <select id="f-sev" value={sev} onChange={(e) => setSev(e.target.value)} className="rounded-sm border border-ink/15 bg-white px-2 py-1.5"><option value="todas">Todas</option><option value="REVISAO_URGENTE">Revisão urgente</option><option value="ATENCAO">Atenção</option><option value="INFORMATIVO">Informativo</option></select>
        <span className="text-xs text-slate">{lista.length} item(ns)</span>
      </div>

      <Card className="mt-4">
        {lista.length === 0 ? <p className="text-sm text-slate">Nenhuma pendência neste filtro.</p> : (
          <ul className="divide-y divide-ink/10">
            {lista.map((p) => (
              <li key={p.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-2xl">
                    <p className="text-sm font-medium text-ink">{p.titulo}</p>
                    {p.detalhe && <p className="mt-0.5 text-xs text-slate">{p.detalhe}</p>}
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-slate/80">{ORIGEM[p.origem]}{p.rule_ids?.length ? ` · ${p.rule_ids.join(' · ')}` : ''}</p>
                    {p.justificada && <p className="mt-1 text-xs text-bronze-dark">Justificativa registrada, aguardando avaliação do advogado.</p>}
                  </div>
                  <div className="flex gap-2"><Selo estado={p.severidade} /></div>
                </div>
                <Tratamento caso={caso} alerta={p} pend={p} user={user} recarregar={recarregar} />
                {p.origem === 'exigencia' && !final(p) && <p className="mt-2 text-xs text-slate"><Link href="/documentos/checklist" className="underline">Ir ao checklist</Link> para anexar ou justificar.</p>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 border-t border-ink/10 pt-3 text-xs text-slate">{MENSAGENS.A}</p>
      </Card>
    </>
  )
}

export default function Pendencias() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10"><CasoGuard>{(p) => <Conteudo {...p} />}</CasoGuard></main>
    </div>
  )
}
