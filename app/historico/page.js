'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import CasoGuard from '@/components/CasoGuard'
import { api } from '@/lib/cliente'

const ROTULOS = {
  caso_criado: 'Caso criado', formulario_alterado: 'Formulário alterado', justificativa_registrada: 'Justificativa registrada', exigencia_nao_aplicavel: 'Exigência marcada como não aplicável',
  pendencia_estado: 'Estado de pendência', processo_estado: 'Estado do caso', protocolo_registrado: 'Protocolo externo registrado', fase_alterada: 'Fase alterada', regra_versao_alterada: 'Versão de regras alterada',
  documento_anexado: 'Documento anexado', upload_falhou: 'Falha técnica no envio', documento_lido_simulado: 'Leitura simulada do documento', documento_estado: 'Decisão sobre documento', documento_tipo_corrigido: 'Tipo de documento corrigido',
  ia_indisponivel: 'Leitura automática indisponível', avaliacao_registrada: 'Avaliação registrada', revisao_registrada: 'Revisão registrada', relatorio_gerado: 'Relatório gerado',
}
const resumo = (v) => (v == null ? null : typeof v === 'string' ? v : JSON.stringify(v))
const dataBR = (s) => new Date(s).toLocaleString('pt-BR')

function Conteudo({ caso }) {
  const [ev, setEv] = useState(null)
  const [filtro, setFiltro] = useState('')
  const [erro, setErro] = useState('')
  useEffect(() => { api(`/cases/${caso.id}/audit`).then((d) => setEv(d.eventos)).catch((e) => setErro(e.message)) }, [caso.id, caso.version])
  const tipos = ev ? [...new Set(ev.map((e) => e.evento))] : []
  const lista = (ev || []).filter((e) => !filtro || e.evento === filtro).slice().reverse()

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-widest text-bronze-dark">Rastreabilidade · {caso.id}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Histórico de auditoria</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate">Todo evento relevante registra quem fez, quando, o que mudou, o motivo e a versão das regras vigente. Registros não são editados nem excluídos.</p>
      {erro && <p role="alert" className="mt-4 text-sm text-selo-danger">{erro}</p>}
      <div className="mt-6 flex items-center gap-3 text-sm">
        <label htmlFor="ft" className="text-slate">Tipo de evento</label>
        <select id="ft" value={filtro} onChange={(e) => setFiltro(e.target.value)} className="rounded-sm border border-ink/15 bg-white px-2 py-1.5"><option value="">Todos</option>{tipos.map((t) => <option key={t} value={t}>{ROTULOS[t] || t}</option>)}</select>
        <span className="text-xs text-slate">{lista.length} evento(s)</span>
      </div>
      <Card className="mt-4">
        {!ev ? <p className="text-sm text-slate">Carregando…</p> : lista.length === 0 ? <p className="text-sm text-slate">Nenhum evento.</p> : (
          <ol className="divide-y divide-ink/10">
            {lista.map((e) => (
              <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{ROTULOS[e.evento] || e.evento}</p>
                  <p className="font-mono text-[11px] text-slate">{dataBR(e.em)} · {e.actor_id} ({e.perfil}) · regras v{e.rule_version}</p>
                </div>
                {e.motivo && <p className="mt-1 text-xs text-slate">Motivo: {e.motivo}</p>}
                {(e.antes != null || e.depois != null) && (
                  <details className="mt-1"><summary className="cursor-pointer text-xs text-bronze-dark">Ver antes e depois</summary>
                    <div className="mt-1 grid gap-2 sm:grid-cols-2"><pre className="overflow-auto rounded-sm bg-ink/5 p-2 text-[11px]">{resumo(e.antes) ?? '—'}</pre><pre className="overflow-auto rounded-sm bg-ink/5 p-2 text-[11px]">{resumo(e.depois) ?? '—'}</pre></div>
                  </details>
                )}
                {e.source_document_id && <p className="mt-1 font-mono text-[10px] text-slate">Documento de origem: {e.source_document_id}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  )
}

export default function Historico() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-10"><CasoGuard>{(p) => <Conteudo {...p} />}</CasoGuard></main>
    </div>
  )
}
