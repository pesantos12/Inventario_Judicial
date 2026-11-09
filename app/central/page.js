'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Selo from '@/components/Selo'
import ProgressoDocumental from '@/components/ProgressoDocumental'
import { api, usuarioAtual, casoAtualId, definirCaso } from '@/lib/cliente'
import { MENSAGENS, PROCESSO_ORDEM, ESTADOS, perfilPode } from '@/lib/estados'

const MODULOS = [
  { titulo: 'Documentação', href: '/documentos', desc: 'Envio e checklist de documentos' },
  { titulo: 'Herdeiros', href: '/herdeiros', desc: 'Cadastro e dados sucessórios' },
  { titulo: 'Patrimônio', href: '/patrimonio', desc: 'Bens declarados' },
  { titulo: 'Árvore Genealógica', href: '/arvore-genealogica', desc: 'Relações familiares informadas' },
  { titulo: 'Análise IA', href: '/analise-ia', desc: 'Alertas e fontes em conflito' },
]

function Erro({ children }) {
  return <p role="alert" className="rounded-sm border border-selo-danger/40 bg-selo-danger/5 px-3 py-2 text-sm text-selo-danger">{children}</p>
}

/** Faixa com os estados do processo (seção 7). Mostra onde o caso está, sem bloquear nenhuma etapa. */
function EtapasDoProcesso({ atual }) {
  const i = PROCESSO_ORDEM.indexOf(atual)
  return (
    <ol className="flex flex-wrap gap-2">
      {PROCESSO_ORDEM.map((e, j) => (
        <li key={e} className={`rounded-sm border px-2 py-1 font-mono text-[11px] uppercase tracking-wide ${j === i ? 'border-ink bg-ink text-parchment' : j < i ? 'border-selo-success/50 text-selo-success' : 'border-ink/15 text-slate'}`}>
          {ESTADOS[e].rotulo}
        </li>
      ))}
    </ol>
  )
}

function EscolherCaso({ user, aoAbrir }) {
  const [casos, setCasos] = useState(null)
  const [templates, setTemplates] = useState([])
  const [escolhido, setEscolhido] = useState('')
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    api('/cases').then((d) => setCasos(d.casos)).catch((e) => setErro(e.message))
    api('/templates').then((d) => { setTemplates(d.casos); setEscolhido(d.casos[0]?.id || '') }).catch(() => {})
  }, [])

  const criar = async (template_id) => {
    setCriando(true); setErro('')
    try {
      const c = await api('/cases', { method: 'POST', body: template_id ? { template_id } : {} })
      aoAbrir(c.id)
    } catch (e) { setErro(e.message); setCriando(false) }
  }

  const porClasse = templates.reduce((acc, t) => { (acc[t.classe] ||= { titulo: t.classe_titulo, itens: [] }).itens.push(t); return acc }, {})
  const escolhidoInfo = templates.find((t) => t.id === escolhido)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card eyebrow="Seus casos" title="Abrir um caso existente">
        {erro && <Erro>{erro}</Erro>}
        {casos === null && !erro && <p className="text-sm text-slate">Carregando…</p>}
        {casos?.length === 0 && <p className="text-sm text-slate">Nenhum caso ainda. Crie um em branco ou a partir de um caso de teste.</p>}
        <ul className="divide-y divide-ink/10">
          {casos?.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
              <div>
                <p className="text-sm font-medium text-ink">{c.titulo}</p>
                <p className="font-mono text-[11px] text-slate">{c.id} · regras {c.rule_version} · {c.resumo.percentual}% das exigências atendidas</p>
              </div>
              <div className="flex items-center gap-3">
                <Selo estado={c.processo_estado} />
                <button onClick={() => aoAbrir(c.id)} className="rounded-sm border border-ink/20 px-3 py-1.5 text-sm hover:bg-ink/5">Abrir</button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card eyebrow="Novo caso" title="Criar inventário judicial">
        <div className="space-y-4">
          <button disabled={criando || !perfilPode(user.perfil, 'editar')} onClick={() => criar()} className="w-full rounded-sm bg-ink px-4 py-2.5 text-sm font-medium text-parchment hover:bg-ink-soft disabled:opacity-50">
            Caso em branco
          </button>
          <div className="border-t border-ink/10 pt-4">
            <label htmlFor="template" className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-bronze-dark">Caso de teste (54 casos hipotéticos)</label>
            <select id="template" value={escolhido} onChange={(e) => setEscolhido(e.target.value)} className="w-full rounded-sm border border-ink/15 bg-white px-2 py-2 text-sm">
              {Object.entries(porClasse).map(([classe, g]) => (
                <optgroup key={classe} label={`${classe}. ${g.titulo}`}>
                  {g.itens.map((t) => (<option key={t.id} value={t.id}>{t.id}</option>))}
                </optgroup>
              ))}
            </select>
            {escolhidoInfo && <p className="mt-2 text-sm text-slate">{escolhidoInfo.entrada}</p>}
            {escolhidoInfo && <p className="mt-1 font-mono text-[11px] text-slate">Nível {escolhidoInfo.metadados.nivel} · complexidade {escolhidoInfo.metadados.complexidade}</p>}
            <button disabled={criando || !escolhido || !perfilPode(user.perfil, 'editar')} onClick={() => criar(escolhido)} className="mt-3 w-full rounded-sm border border-ink/20 px-4 py-2.5 text-sm font-medium hover:bg-ink/5 disabled:opacity-50">
              Criar a partir deste caso de teste
            </button>
          </div>
          {!perfilPode(user.perfil, 'editar') && <p className="text-sm text-slate">Este perfil não pode criar casos.</p>}
        </div>
      </Card>
    </div>
  )
}

function PainelAdmin() {
  const [s, setS] = useState(null)
  const [erro, setErro] = useState('')
  const carregar = () => api('/settings').then(setS).catch((e) => setErro(e.message))
  useEffect(() => { carregar() }, [])
  const salvar = (body) => api('/settings', { method: 'PUT', body }).then(setS).catch((e) => setErro(e.message))
  return (
    <Card eyebrow="Administração" title="Configurações do sistema">
      <p className="mb-4 text-sm text-slate">O administrador gerencia regras e disponibilidade da leitura automática. Dados de casos não são acessíveis a este perfil.</p>
      {erro && <Erro>{erro}</Erro>}
      {s && (
        <div className="space-y-4 text-sm">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={s.ia_disponivel} onChange={(e) => salvar({ ia_disponivel: e.target.checked })} />
            Leitura automática (IA simulada) disponível
          </label>
          <div className="flex items-center gap-3">
            <span>Versão de regras publicada:</span>
            <select value={s.regras_publicada} onChange={(e) => salvar({ regras_publicada: Number(e.target.value) })} className="rounded-sm border border-ink/15 bg-white px-2 py-1">
              {Object.entries(s.versoes).map(([n, r]) => (<option key={n} value={n}>{r}</option>))}
            </select>
          </div>
          <p className="font-mono text-[11px] text-slate">{s.historico.length} alteração(ões) de configuração registrada(s).</p>
        </div>
      )}
    </Card>
  )
}

function Painel({ id, user, aoTrocar }) {
  const [c, setC] = useState(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(() => api(`/cases/${id}`).then((d) => { setC(d); setErro('') }).catch((e) => setErro(e.message)), [id])
  useEffect(() => { carregar() }, [carregar])

  if (erro && !c) return <div className="space-y-3"><Erro>{erro}</Erro><button onClick={aoTrocar} className="text-sm underline">Escolher outro caso</button></div>
  if (!c) return <p className="text-sm text-slate">Carregando caso…</p>

  const a = c.avaliacao
  const r = a.resumo
  const abertas = c.pendencias.filter((p) => !['RESOLVIDA', 'DISPENSADA_COM_MOTIVO'].includes(p.tratamento.estado))
  const urgentes = r.alertas.REVISAO_URGENTE
  const estado = c.processo_estado.estado

  const mover = async (para) => {
    setSalvando(true); setErro('')
    try { setC(await api(`/cases/${id}`, { method: 'PATCH', body: { version: c.version, op: 'estado', estado: para } })) }
    catch (e) { setErro(e.message); if (e.status === 409) carregar() }
    setSalvando(false)
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-bronze-dark">Central do inventário judicial · {c.id}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">{c.titulo}</h1>
          <p className="mt-1 font-mono text-[11px] text-slate">Regras {a.rule_version} · versão do caso {c.version}{c.template_id ? ` · caso de teste ${c.template_id}` : ''}</p>
        </div>
        <button onClick={aoTrocar} className="rounded-sm border border-ink/20 px-4 py-2.5 text-sm hover:bg-ink/5">Trocar de caso</button>
      </div>

      {erro && <div className="mb-4"><Erro>{erro}</Erro></div>}

      <Card eyebrow="Situação" title="Estado do rascunho" className="mb-6">
        <EtapasDoProcesso atual={estado} />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {estado === 'RASCUNHO' && perfilPode(user.perfil, 'editar') && (
            <button disabled={salvando} onClick={() => mover('PRONTO_PARA_REVISAO')} className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-parchment hover:bg-ink-soft disabled:opacity-50">Enviar para revisão do advogado</button>
          )}
          {estado === 'PRONTO_PARA_REVISAO' && perfilPode(user.perfil, 'editar') && (
            <button disabled={salvando} onClick={() => mover('RASCUNHO')} className="rounded-sm border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5 disabled:opacity-50">Voltar para rascunho</button>
          )}
          <p className="text-sm text-slate">Pendências não impedem a preparação do rascunho; elas orientam a revisão. O protocolo é feito fora da plataforma.</p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card eyebrow="Progresso" title="Exigências atendidas" className="lg:col-span-2">
          <ProgressoDocumental percentual={r.percentual} />
          <p className="mt-2 text-xs text-slate">Mede apenas o que já foi informado ou classificado, não a suficiência jurídica da petição.</p>
          <div className="mt-6 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
            <div><p className="font-display text-2xl font-semibold text-ink">{r.atendidas}<span className="text-base text-slate">/{r.exigencias_base}</span></p><p className="text-xs text-slate">Exigências atendidas</p></div>
            <div><p className="font-display text-2xl font-semibold text-selo-warning">{abertas.length}</p><p className="text-xs text-slate">Pendências abertas</p></div>
            <div><p className="font-display text-2xl font-semibold text-ink">{r.justificadas}</p><p className="text-xs text-slate">Justificadas</p></div>
            <div><p className="font-display text-2xl font-semibold text-ink">{c.documentos.length}</p><p className="text-xs text-slate">Documentos anexados</p></div>
          </div>
        </Card>

        <Card eyebrow="Alertas" title="Pontos para o advogado">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between"><Selo estado="REVISAO_URGENTE" /><span className="font-mono">{urgentes}</span></li>
            <li className="flex items-center justify-between"><Selo estado="ATENCAO" /><span className="font-mono">{r.alertas.ATENCAO}</span></li>
            <li className="flex items-center justify-between"><Selo estado="INFORMATIVO" /><span className="font-mono">{r.alertas.INFORMATIVO}</span></li>
          </ul>
          <p className="mt-4 text-xs text-slate">{MENSAGENS.C}</p>
        </Card>
      </div>

      <h2 className="mb-4 mt-10 font-display text-xl font-semibold text-ink">Pendências em aberto</h2>
      <Card>
        {abertas.length === 0 ? <p className="text-sm text-slate">Nenhuma pendência em aberto.</p> : (
          <ul className="divide-y divide-ink/10">
            {abertas.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm text-ink">{p.titulo}</p>
                  {p.detalhe && <p className="mt-0.5 text-xs text-slate">{p.detalhe}</p>}
                  {p.justificada && <p className="mt-0.5 text-xs text-bronze-dark">Justificativa registrada, aguardando avaliação do advogado.</p>}
                </div>
                <div className="flex shrink-0 gap-2"><Selo estado={p.severidade} /><Selo estado={p.tratamento.estado} /></div>
              </li>
            ))}
          </ul>
        )}
        {abertas.length > 8 && <p className="mt-3 text-xs text-slate">E mais {abertas.length - 8} pendência(s).</p>}
        <p className="mt-4 border-t border-ink/10 pt-3 text-xs text-slate">{MENSAGENS.A}</p>
      </Card>

      <h2 className="mb-4 mt-10 font-display text-xl font-semibold text-ink">Módulos</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <h3 className="font-display text-base font-semibold text-ink">{m.titulo}</h3>
              <p className="mt-1.5 text-sm text-slate">{m.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-8 text-xs text-slate">{MENSAGENS.D}</p>
    </>
  )
}

export default function Central() {
  const [user, setUser] = useState(null)
  const [id, setId] = useState(undefined)

  useEffect(() => { setUser(usuarioAtual()); setId(casoAtualId()) }, [])
  const abrir = (novo) => { definirCaso(novo); window.location.reload() }
  const trocar = () => { definirCaso(null); window.location.reload() }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        {!user || id === undefined ? <p className="text-sm text-slate">Carregando…</p>
          : user.perfil === 'administrador' ? <PainelAdmin />
          : id ? <Painel id={id} user={user} aoTrocar={trocar} />
          : <><div className="mb-8"><p className="font-mono text-xs uppercase tracking-widest text-bronze-dark">Central do inventário judicial</p><h1 className="mt-1 font-display text-3xl font-semibold text-ink">Escolha ou crie um caso</h1></div><EscolherCaso user={user} aoAbrir={abrir} /></>}
      </main>
    </div>
  )
}
