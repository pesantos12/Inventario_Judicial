'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Selo from '@/components/Selo'
import CasoGuard from '@/components/CasoGuard'
import { api } from '@/lib/cliente'
import { DOC_TIPOS } from '@/lib/catalogo'
import { MENSAGENS, perfilPode } from '@/lib/estados'

const LEITURAS = {
  legivel: 'Legível, dados coerentes com o formulário',
  baixa_legibilidade: 'Imagem desfocada / baixa legibilidade',
  cpf_divergente: 'CPF do documento diverge do formulário',
  conteudo_outro: 'Conteúdo é de outro tipo de documento',
  documento_terceiro: 'Documento de terceiro (quarentena)',
}

const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

function Upload({ caso, recarregar, user }) {
  const [tipo, setTipo] = useState('certidao_obito')
  const [leitura, setLeitura] = useState('legivel')
  const [msg, setMsg] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const arq = useRef(null)

  useEffect(() => { const t = new URLSearchParams(window.location.search).get('tipo'); if (t && DOC_TIPOS[t]) setTipo(t) }, [])

  const enviar = async (e) => {
    e.preventDefault()
    const file = arq.current?.files?.[0]
    if (!file) return setMsg({ tipo: 'erro', texto: 'Escolha um arquivo (PDF, PNG ou JPG, até 10 MB).' })
    setEnviando(true); setMsg(null)
    const form = new FormData(); form.set('file', file); form.set('tipo', tipo)
    try {
      const r = await api(`/cases/${caso.id}/documents`, { method: 'POST', form })
      try {
        await api(`/cases/${caso.id}/documents/${r.documento.id}/extract`, { method: 'POST', body: { leitura } })
        setMsg({ tipo: 'ok', texto: 'Arquivo enviado e lido (leitura simulada). Confira o resultado abaixo.' })
      } catch (e2) {
        setMsg({ tipo: e2.status === 503 ? 'aviso' : 'erro', texto: e2.status === 503 ? e2.message : `Arquivo enviado, mas a leitura falhou: ${e2.message}` })
      }
      arq.current.value = ''
    } catch (e2) {
      setMsg({ tipo: 'erro', texto: e2.dados?.mensagem || e2.message })
    }
    setEnviando(false); recarregar()
  }

  const cor = { ok: 'text-selo-success', erro: 'text-selo-danger', aviso: 'text-selo-warning' }
  return (
    <Card eyebrow="Novo arquivo" title="Enviar documento">
      <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tipo" className="mb-1.5 block text-sm font-medium text-ink">Tipo de documento</label>
          <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full rounded-sm border border-ink/15 bg-white px-2 py-2 text-sm">
            {Object.entries(DOC_TIPOS).map(([k, r]) => (<option key={k} value={k}>{r}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="arq" className="mb-1.5 block text-sm font-medium text-ink">Arquivo (PDF, PNG ou JPG · até 10 MB)</label>
          <input id="arq" ref={arq} type="file" accept=".pdf,.png,.jpg,.jpeg" className="w-full text-sm" />
        </div>
        <div className="sm:col-span-2 rounded-sm border border-dashed border-slate/50 p-3">
          <label htmlFor="leitura" className="mb-1.5 block text-sm font-medium text-ink">Resultado da leitura simulada <Selo estado="CLASSIFICADO" texto="Apenas para teste" simulado /></label>
          <select id="leitura" value={leitura} onChange={(e) => setLeitura(e.target.value)} className="w-full rounded-sm border border-ink/15 bg-white px-2 py-2 text-sm">
            {Object.entries(LEITURAS).map(([k, r]) => (<option key={k} value={k}>{r}</option>))}
          </select>
          <p className="mt-1 text-xs text-slate">O protótipo não lê o conteúdo do arquivo: este controle reproduz cenários do caderno de casos. Em produção, a leitura seria feita pelo módulo de IA.</p>
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button disabled={enviando || !perfilPode(user.perfil, 'anexar')} className="rounded-sm bg-ink px-4 py-2.5 text-sm font-medium text-parchment hover:bg-ink-soft disabled:opacity-50">{enviando ? 'Enviando…' : 'Enviar e ler'}</button>
          {msg && <p role={msg.tipo === 'erro' ? 'alert' : 'status'} className={`text-sm ${cor[msg.tipo]}`}>{msg.texto}</p>}
        </div>
      </form>
    </Card>
  )
}

function Linha({ d, caso, user, recarregar }) {
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const decidir = async (estado) => {
    setErro('')
    try { await api(`/cases/${caso.id}/documents/${d.id}`, { method: 'PATCH', body: { version: caso.version, estado, motivo } }); setAberto(false); setMotivo(''); recarregar() }
    catch (e) { setErro(e.message); if (e.status === 409) recarregar() }
  }
  const relerAgora = async () => {
    setErro('')
    try { await api(`/cases/${caso.id}/documents/${d.id}/extract`, { method: 'POST', body: { leitura: 'legivel' } }); recarregar() } catch (e) { setErro(e.message) }
  }
  const tipoDiverge = d.tipo_classificado && d.tipo_classificado !== d.tipo
  const decidivel = ['CLASSIFICADO', 'DIVERGENTE', 'EM_ANALISE', 'REVISADO'].includes(d.status)

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">{d.nome}</p>
          <p className="text-xs text-slate">{DOC_TIPOS[d.tipo] || d.tipo}{d.tamanho ? ` · ${kb(d.tamanho)}` : ''}{d.hash && !d.hash.startsWith('simulado') ? ` · sha256 ${d.hash.slice(0, 10)}…` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d.quarentena && <Selo estado="EM_ANALISE" texto="Quarentena" />}
          <Selo estado={d.status} simulado={!!d.simulado && d.status !== 'ANEXADO' && d.status !== 'FALHA_TECNICA'} />
        </div>
      </div>

      {d.status === 'FALHA_TECNICA' && <p className="mt-2 text-xs text-selo-danger">{d.motivo_tecnico} Envie um novo arquivo; este registro permanece no histórico.</p>}
      {d.status === 'DIVERGENTE' && <p className="mt-2 text-xs text-selo-danger">{MENSAGENS.B}</p>}
      {d.legibilidade === 'baixa' && <p className="mt-2 text-xs text-selo-warning">Baixa legibilidade (confiança {Math.round((d.confianca || 0) * 100)}%): nenhum dado foi confirmado. Envie um arquivo mais nítido.</p>}
      {d.quarentena && <p className="mt-2 text-xs text-selo-warning">Possível documento de terceiro. Ele não é usado no caso até decisão do advogado.</p>}
      {tipoDiverge && <p className="mt-2 text-xs text-selo-warning">O conteúdo parece ser “{DOC_TIPOS[d.tipo_classificado] || d.tipo_classificado}”, não “{DOC_TIPOS[d.tipo] || d.tipo}”. A classificação segue o conteúdo; confira o arquivo.</p>}

      {d.entidades?.length > 0 && d.legibilidade !== 'baixa' && (
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
          {d.entidades.map((e) => (<div key={e.campo}><dt className="inline text-slate">{e.campo}: </dt><dd className="inline font-mono text-ink">{e.valor}</dd> <span className="text-slate">({Math.round(e.confianca * 100)}%)</span></div>))}
        </dl>
      )}
      {d.simulado && d.status !== 'ANEXADO' && d.status !== 'FALHA_TECNICA' && <p className="mt-1 text-[11px] text-slate">{MENSAGENS.D}</p>}
      {d.estado_info?.reason && <p className="mt-1 text-[11px] text-slate">Último registro: {d.estado_info.reason} ({d.estado_info.actor_id})</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {d.status === 'ANEXADO' && perfilPode(user.perfil, 'anexar') && <button onClick={relerAgora} className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5">Tentar leitura (simulada)</button>}
        {decidivel && perfilPode(user.perfil, 'aceitar_documento') && <button onClick={() => setAberto(true)} className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5">Registrar decisão do advogado</button>}
      </div>
      {aberto && (
        <div className="mt-3 space-y-2 rounded-sm border border-ink/15 bg-white/70 p-3">
          <label htmlFor={`m-${d.id}`} className="block text-sm font-medium text-ink">Motivo da decisão</label>
          <p className="text-xs text-slate">“Aceito para organização” significa apenas que o arquivo será usado na organização do caso, não que o documento seja juridicamente válido.</p>
          <textarea id={`m-${d.id}`} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            <button disabled={motivo.trim().length < 3} onClick={() => decidir('REVISADO')} className="rounded-sm bg-ink px-3 py-1.5 text-sm text-parchment disabled:opacity-50">Marcar como revisado</button>
            <button disabled={motivo.trim().length < 3} onClick={() => decidir('ACEITO_PARA_ORGANIZACAO')} className="rounded-sm border border-ink/20 px-3 py-1.5 text-sm disabled:opacity-50">Aceitar para organização</button>
            <button onClick={() => setAberto(false)} className="rounded-sm border border-ink/20 px-3 py-1.5 text-sm">Cancelar</button>
          </div>
        </div>
      )}
      {erro && <p role="alert" className="mt-2 text-xs text-selo-danger">{erro}</p>}
    </li>
  )
}

function Conteudo({ caso, user, recarregar }) {
  const docs = [...caso.documentos].reverse()
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-bronze-dark">Documentação · {caso.id}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Gerenciamento de documentos</h1>
        </div>
        <Link href="/documentos/checklist" className="rounded-sm border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink hover:bg-ink/5">Ver checklist</Link>
      </div>
      <div className="mt-6"><Upload caso={caso} recarregar={recarregar} user={user} /></div>
      <h2 className="mb-4 mt-10 font-display text-xl font-semibold text-ink">Arquivos do caso ({docs.length})</h2>
      <Card>
        {docs.length === 0 ? <p className="text-sm text-slate">Nenhum documento anexado ainda.</p> : <ul className="divide-y divide-ink/10">{docs.map((d) => <Linha key={d.id} d={d} caso={caso} user={user} recarregar={recarregar} />)}</ul>}
      </Card>
      <p className="mt-4 text-xs text-slate">Arquivos não são excluídos: falhas e substituições ficam no histórico. Não há varredura de vírus no protótipo (funcionalidade planejada).</p>
    </>
  )
}

export default function Documentos() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10"><CasoGuard>{(p) => <Conteudo {...p} />}</CasoGuard></main>
    </div>
  )
}
