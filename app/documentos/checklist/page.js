'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Selo from '@/components/Selo'
import CasoGuard from '@/components/CasoGuard'
import ProgressoDocumental from '@/components/ProgressoDocumental'
import { api } from '@/lib/cliente'
import { MENSAGENS, perfilPode } from '@/lib/estados'

const CLASSES = [
  { id: 'ESSENCIAL_PETICAO', titulo: 'Essenciais para a petição inicial', nota: 'Normalmente indispensáveis. A ausência não gera classificação automática de inépcia: registre justificativa para avaliação do advogado.' },
  { id: 'CONDICIONAL', titulo: 'Condicionais', nota: 'Exigidas conforme as respostas do cadastro e os documentos anexados.' },
  { id: 'RECOMENDADO_LOCAL', titulo: 'Recomendados por regra local', nota: 'Dependem de regra do foro/UF simulada; confirmar com o profissional responsável.' },
  { id: 'FASE_POSTERIOR', titulo: 'Fases posteriores', nota: 'Não são exigidas para preparar a petição inicial; ficam listadas para acompanhamento.' },
]

function Item({ q, caso, user, aoMudar }) {
  const [aberto, setAberto] = useState(null) // 'justificar' | 'nao_aplicavel'
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const justificativa = caso.justificativas[q.id]
  const na = q.status === 'NAO_APLICAVEL'
  const atendido = ['CLASSIFICADO', 'REVISADO', 'ACEITO_PARA_ORGANIZACAO', 'INFORMADO', 'CONFIRMADO_PELO_USUARIO'].includes(q.status)

  const enviar = async () => {
    setSalvando(true); setErro('')
    try {
      const body = aberto === 'justificar' ? { op: 'justificar', requisito: q.id, texto } : { op: 'nao_aplicavel', requisito: q.id, motivo: texto }
      await api(`/cases/${caso.id}`, { method: 'PATCH', body: { version: caso.version, ...body } })
      setAberto(null); setTexto(''); await aoMudar()
    } catch (e) { setErro(e.message); if (e.status === 409) aoMudar() }
    setSalvando(false)
  }

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-ink">{q.rotulo}</p>
          <p className="mt-0.5 text-xs text-slate">{q.porque}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-slate/80">{q.rule_ids.join(' · ')}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {q.classe === 'FASE_POSTERIOR' && !na ? <Selo estado="NAO_APLICAVEL" texto="Fase posterior" /> : <Selo estado={q.status} />}
          {q.status === 'PENDENTE' && justificativa && <span className="text-[11px] text-bronze-dark">Justificada</span>}
        </div>
      </div>
      {q.detalhe && !atendido && !na && <p className="mt-2 text-xs text-slate">{q.detalhe}</p>}
      {na && <p className="mt-2 text-xs text-slate">{q.reason}</p>}
      {justificativa && <p className="mt-2 rounded-sm border border-bronze/30 bg-bronze/5 px-3 py-2 text-xs text-ink"><span className="font-medium">Justificativa:</span> {justificativa.texto} <span className="text-slate">— {justificativa.autor}, aguardando avaliação do advogado</span></p>}

      {!na && !atendido && q.classe !== 'FASE_POSTERIOR' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {q.tipo === 'documento' && <Link href={`/documentos?tipo=${q.doc}`} className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5">Anexar documento</Link>}
          {perfilPode(user.perfil, 'justificar') && <button onClick={() => { setAberto('justificar'); setTexto(justificativa?.texto || '') }} className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5">{justificativa ? 'Editar justificativa' : 'Registrar justificativa'}</button>}
          {perfilPode(user.perfil, 'nao_aplicavel') && <button onClick={() => { setAberto('nao_aplicavel'); setTexto('') }} className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5">Marcar como não aplicável</button>}
        </div>
      )}

      {aberto && (
        <div className="mt-3 space-y-2 rounded-sm border border-ink/15 bg-white/70 p-3">
          <label htmlFor={`t-${q.id}`} className="block text-sm font-medium text-ink">{aberto === 'justificar' ? 'Justificativa' : 'Motivo (decisão do advogado)'}</label>
          {aberto === 'justificar' && <p className="text-xs text-slate">{MENSAGENS.A}</p>}
          <textarea id={`t-${q.id}`} rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} className="w-full rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm" />
          {erro && <p role="alert" className="text-xs text-selo-danger">{erro}</p>}
          <div className="flex gap-2">
            <button disabled={salvando || texto.trim().length < 3} onClick={enviar} className="rounded-sm bg-ink px-3 py-1.5 text-sm text-parchment disabled:opacity-50">Salvar</button>
            <button onClick={() => { setAberto(null); setErro('') }} className="rounded-sm border border-ink/20 px-3 py-1.5 text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </li>
  )
}

function Conteudo({ caso, user, recarregar }) {
  const a = caso.avaliacao
  const aplicaveis = a.requirements.filter((q) => q.applicable !== 'nao_aplicavel')
  const naoAplic = a.requirements.filter((q) => q.status === 'NAO_APLICAVEL')
  const indeterminadas = aplicaveis.filter((q) => q.applicable === 'indeterminado')

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-widest text-bronze-dark">Documentação · {caso.id}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Checklist documental</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate">Gerado pelas regras (versão {a.rule_version}) a partir do cadastro e dos documentos. Muda sozinho quando você altera as respostas.</p>

      <Card className="mt-6">
        <ProgressoDocumental percentual={a.resumo.percentual} rotulo={`${a.resumo.atendidas} de ${a.resumo.exigencias_base} exigências-base atendidas`} />
        <p className="mt-2 text-xs text-slate">{a.resumo.pendentes} pendente(s) · {a.resumo.justificadas} justificada(s). O percentual mede organização, não a suficiência jurídica.</p>
      </Card>

      {indeterminadas.length > 0 && (
        <p className="mt-4 rounded-sm border border-selo-warning/40 bg-selo-warning/5 px-3 py-2 text-sm text-ink">Há {indeterminadas.length} exigência(s) que dependem de respostas "não sei" no cadastro; foram mantidas na lista por cautela. <Link href="/inventario/novo" className="underline">Revisar cadastro</Link></p>
      )}

      {CLASSES.map((c) => {
        const itens = aplicaveis.filter((q) => q.classe === c.id)
        if (!itens.length) return null
        return (
          <section key={c.id} className="mt-8">
            <h2 className="font-display text-xl font-semibold text-ink">{c.titulo} <span className="font-mono text-sm text-slate">({itens.length})</span></h2>
            <p className="mb-3 mt-1 text-sm text-slate">{c.nota}</p>
            <Card><ul className="divide-y divide-ink/10">{itens.map((q) => <Item key={q.id} q={q} caso={caso} user={user} aoMudar={recarregar} />)}</ul></Card>
          </section>
        )
      })}

      {naoAplic.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer font-display text-lg font-semibold text-ink">Não aplicáveis a este caso ({naoAplic.length})</summary>
          <Card className="mt-3"><ul className="divide-y divide-ink/10">{naoAplic.map((q) => <Item key={q.id} q={q} caso={caso} user={user} aoMudar={recarregar} />)}</ul></Card>
        </details>
      )}
      <p className="mt-8 text-xs text-slate">{MENSAGENS.D}</p>
    </>
  )
}

export default function Checklist() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-10"><CasoGuard>{(p) => <Conteudo {...p} />}</CasoGuard></main>
    </div>
  )
}
