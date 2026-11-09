'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Selo from '@/components/Selo'
import CasoGuard from '@/components/CasoGuard'
import { api } from '@/lib/cliente'
import { DOC_TIPOS } from '@/lib/catalogo'
import Tratamento from '@/components/Tratamento'
import { MENSAGENS } from '@/lib/estados'

const ORDEM = ['REVISAO_URGENTE', 'ATENCAO', 'INFORMATIVO']
const TITULO = { REVISAO_URGENTE: 'Revisão urgente', ATENCAO: 'Atenção', INFORMATIVO: 'Informativos' }
const RESULTADO = { sim: 'Sim', nao: 'Não', indeterminado: 'Indeterminado ("não sei")', acao: 'Ação do sistema' }

function Fontes({ fontes }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {fontes.map((s, i) => (
        <div key={i} className="rounded-sm border border-ink/15 bg-white p-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-slate">{s.origem}</p>
          <p className="mt-1 text-xs text-slate">{s.campo}</p>
          <p className="font-mono text-sm text-ink">{s.valor}</p>
          {typeof s.confianca === 'number' && <p className="mt-1 text-[11px] text-slate">Confiança da extração: {Math.round(s.confianca * 100)}%</p>}
        </div>
      ))}
    </div>
  )
}

function Conteudo({ caso, user, recarregar }) {
  const [ia, setIa] = useState(null)
  useEffect(() => { api('/settings').then((s) => setIa(s.ia_disponivel)).catch(() => {}) }, [])
  const a = caso.avaliacao
  const lidos = caso.documentos.filter((d) => d.simulado && d.confianca != null)
  const media = lidos.length ? Math.round((lidos.reduce((t, d) => t + d.confianca, 0) / lidos.length) * 100) : null
  const pendDe = (id) => caso.pendencias.find((p) => p.id === id)

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-widest text-bronze-dark">Análise automatizada · {caso.id}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Análise inteligente do caso</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate">Resultado das regras determinísticas e da leitura <strong>simulada</strong> dos documentos. A análise sinaliza e explica; nenhuma conclusão é sobrescrita automaticamente e toda decisão é do advogado.</p>

      {ia === false && <p role="status" className="mt-4 rounded-sm border border-selo-warning/40 bg-selo-warning/5 px-3 py-2 text-sm text-ink">A leitura automática está indisponível no momento. Formulário, checklist e alertas por regra seguem funcionando; documentos novos ficam como “Anexado” até a leitura voltar.</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {ORDEM.map((s) => (<Card key={s}><Selo estado={s} /><p className="mt-3 font-display text-3xl font-semibold text-ink">{a.resumo.alertas[s]}</p></Card>))}
        <Card><p className="font-mono text-[11px] uppercase tracking-wide text-slate">Confiança média da leitura</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{media == null ? '—' : `${media}%`}</p><p className="text-xs text-slate">{lidos.length} documento(s) lido(s) · simulado</p></Card>
      </div>

      {ORDEM.map((s) => {
        const lista = a.alerts.filter((x) => x.severidade === s)
        if (!lista.length) return null
        return (
          <section key={s} className="mt-8">
            <h2 className="mb-3 font-display text-xl font-semibold text-ink">{TITULO[s]} <span className="font-mono text-sm text-slate">({lista.length})</span></h2>
            <div className="space-y-3">
              {lista.map((x) => (
                <Card key={x.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="max-w-3xl text-sm text-ink">{x.mensagem}</p>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-slate">{x.rule_id}</span>
                  </div>
                  {x.fontes && <><p className="mt-3 text-xs font-medium text-ink">Fontes em conflito (nada foi sobrescrito):</p><Fontes fontes={x.fontes} /><p className="mt-2 text-xs text-slate">{MENSAGENS.B}</p></>}
                  <Tratamento caso={caso} alerta={x} pend={pendDe(x.id)} user={user} recarregar={recarregar} />
                </Card>
              ))}
            </div>
          </section>
        )
      })}
      {a.alerts.length === 0 && <Card className="mt-8"><p className="text-sm text-slate">Nenhum alerta com os dados atuais. Isso não é uma conclusão de que o caso esteja regular.</p></Card>}

      <h2 className="mb-3 mt-10 font-display text-xl font-semibold text-ink">Leitura dos documentos</h2>
      <Card>
        {caso.documentos.length === 0 ? <p className="text-sm text-slate">Nenhum documento anexado. <Link href="/documentos" className="underline">Enviar documentos</Link></p> : (
          <ul className="divide-y divide-ink/10">
            {caso.documentos.map((d) => (
              <li key={d.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-ink">{d.nome} <span className="text-xs text-slate">· {DOC_TIPOS[d.tipo] || d.tipo}</span></p>
                  <Selo estado={d.status} simulado={!!d.simulado && !['ANEXADO', 'FALHA_TECNICA'].includes(d.status)} />
                </div>
                {d.confianca != null && <p className="mt-1 text-xs text-slate">Confiança {Math.round(d.confianca * 100)}%{d.legibilidade === 'baixa' ? ' · baixa legibilidade' : ''}{d.tipo_classificado && d.tipo_classificado !== d.tipo ? ` · conteúdo parece ser “${DOC_TIPOS[d.tipo_classificado] || d.tipo_classificado}”` : ''}</p>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 border-t border-ink/10 pt-3 text-xs text-slate">{MENSAGENS.D}</p>
      </Card>

      <details className="mt-8">
        <summary className="cursor-pointer font-display text-lg font-semibold text-ink">Como chegamos a isso: trilha de regras ({a.resumo.regras_avaliadas} avaliadas, versão {a.rule_version})</summary>
        <Card className="mt-3">
          <p className="mb-3 text-xs text-slate">Cada regra é determinística e identificada. “Indeterminado” significa que faltou informação (por exemplo, resposta “não sei”), nunca que a resposta foi “não”.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b border-ink/15 text-slate"><th className="py-2 pr-3 font-medium">Regra</th><th className="py-2 pr-3 font-medium">Descrição</th><th className="py-2 pr-3 font-medium">Base</th><th className="py-2 font-medium">Resultado</th></tr></thead>
              <tbody>
                {a.regras.map((r) => (
                  <tr key={r.id} className="border-b border-ink/5">
                    <td className="py-1.5 pr-3 font-mono">{r.id}</td><td className="py-1.5 pr-3 text-ink">{r.titulo}</td><td className="py-1.5 pr-3 text-slate">{r.base}</td>
                    <td className={`py-1.5 ${r.resultado === 'indeterminado' ? 'text-selo-warning' : 'text-ink'}`}>{RESULTADO[r.resultado] || r.resultado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </details>
    </>
  )
}

export default function AnaliseIA() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10"><CasoGuard>{(p) => <Conteudo {...p} />}</CasoGuard></main>
    </div>
  )
}
