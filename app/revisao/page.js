'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Selo from '@/components/Selo'
import CasoGuard from '@/components/CasoGuard'
import { api } from '@/lib/cliente'
import { MENSAGENS, PROCESSO_ORDEM, ESTADOS, perfilPode } from '@/lib/estados'

const dataBR = (s) => (s ? new Date(s).toLocaleString('pt-BR') : '—')

function Relatorio({ r }) {
  const baixar = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `relatorio-${r.caso.id}.json` })
    a.click(); URL.revokeObjectURL(url)
  }
  const f = r.formulario
  return (
    <Card className="mt-4" eyebrow="Relatório gerado" title={r.titulo}>
      <p className="rounded-sm border border-selo-warning/40 bg-selo-warning/5 px-3 py-2 text-sm text-ink">{r.natureza}</p>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-slate">Falecido</dt><dd>{f.falecido?.nome || '—'}</dd></div>
        <div><dt className="text-xs text-slate">Requerente</dt><dd>{f.requerente?.nome || '—'}</dd></div>
        <div><dt className="text-xs text-slate">Comarca / juízo</dt><dd>{[f.processo?.comarca_uf, f.processo?.juizo].filter(Boolean).join(' · ') || '—'}</dd></div>
        <div><dt className="text-xs text-slate">Gerado em</dt><dd>{dataBR(r.gerado_em)} · regras {r.caso.rule_version}</dd></div>
      </dl>
      <p className="mt-4 text-sm font-medium text-ink">Exigências ({r.resumo.atendidas} de {r.resumo.exigencias_base} atendidas)</p>
      <ul className="mt-1 space-y-1 text-sm">{r.exigencias.filter((q) => q.applicable !== 'nao_aplicavel').map((q) => (<li key={q.id} className="flex items-center justify-between gap-3"><span>{q.rotulo}</span><Selo estado={q.status} /></li>))}</ul>
      <p className="mt-4 text-sm font-medium text-ink">Alertas ({r.alertas.length}) e pendências abertas ({r.pendencias.filter((p) => !['RESOLVIDA', 'DISPENSADA_COM_MOTIVO'].includes(p.tratamento.estado)).length})</p>
      <ul className="mt-1 space-y-1 text-sm">{r.alertas.map((a) => (<li key={a.id} className="flex items-start gap-3"><Selo estado={a.severidade} /><span>{a.mensagem}</span></li>))}</ul>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
        <button onClick={baixar} className="rounded-sm border border-ink/20 px-3 py-1.5 text-sm hover:bg-ink/5">Baixar JSON</button>
        <button onClick={() => window.print()} className="rounded-sm border border-ink/20 px-3 py-1.5 text-sm hover:bg-ink/5">Imprimir</button>
        <p className="text-xs text-slate">{r.aviso}</p>
      </div>
    </Card>
  )
}

function Conteudo({ caso, user, recarregar }) {
  const estado = caso.processo_estado.estado
  const [revs, setRevs] = useState([])
  const [decisao, setDecisao] = useState('aprovado')
  const [obs, setObs] = useState('')
  const [numero, setNumero] = useState('')
  const [relatorio, setRelatorio] = useState(null)
  const [msg, setMsg] = useState(null)
  const carregarRevs = () => api(`/cases/${caso.id}/reviews`).then((d) => setRevs(d.revisoes)).catch(() => {})
  useEffect(() => { carregarRevs() }, [caso.version])

  const abertas = caso.pendencias.filter((p) => !['RESOLVIDA', 'DISPENSADA_COM_MOTIVO'].includes(p.tratamento.estado))
  const urgentes = abertas.filter((p) => p.severidade === 'REVISAO_URGENTE')
  const executar = async (fn, ok) => { setMsg(null); try { await fn(); setMsg({ tipo: 'ok', texto: ok }); await recarregar() } catch (e) { setMsg({ tipo: 'erro', texto: e.dados?.mensagem || e.message }); if (e.status === 409) recarregar() } }
  const patch = (body) => api(`/cases/${caso.id}`, { method: 'PATCH', body: { version: caso.version, ...body } })
  const advogado = perfilPode(user.perfil, 'revisar')
  const i = PROCESSO_ORDEM.indexOf(estado)

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-widest text-bronze-dark">Revisão do advogado · {caso.id}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Revisão e encaminhamento</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate">A plataforma apoia o levantamento e a preparação da minuta. A revisão, o protocolo e qualquer conclusão jurídica são do advogado responsável e acontecem fora da plataforma.</p>

      <Card className="mt-6" eyebrow="Situação" title="Estado do caso">
        <ol className="flex flex-wrap gap-2">{PROCESSO_ORDEM.map((e, j) => (<li key={e} className={`rounded-sm border px-2 py-1 font-mono text-[11px] uppercase tracking-wide ${j === i ? 'border-ink bg-ink text-parchment' : j < i ? 'border-selo-success/50 text-selo-success' : 'border-ink/15 text-slate'}`}>{ESTADOS[e].rotulo}</li>))}</ol>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <p><span className="font-display text-2xl font-semibold text-selo-warning">{abertas.length}</span> <span className="text-slate">pendência(s) em aberto</span></p>
          <p><span className="font-display text-2xl font-semibold text-selo-danger">{urgentes.length}</span> <span className="text-slate">de revisão urgente</span></p>
          <p><span className="font-display text-2xl font-semibold text-ink">{caso.avaliacao.resumo.percentual}%</span> <span className="text-slate">das exigências atendidas</span></p>
        </div>
        <p className="mt-3 text-xs text-slate">Pendências em aberto não impedem a revisão: o advogado decide como tratá-las e a revisão registra quantas existiam.</p>
        {msg && <p role={msg.tipo === 'erro' ? 'alert' : 'status'} className={`mt-3 text-sm ${msg.tipo === 'erro' ? 'text-selo-danger' : 'text-selo-success'}`}>{msg.texto}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {estado === 'RASCUNHO' && perfilPode(user.perfil, 'editar') && <button onClick={() => executar(() => patch({ op: 'estado', estado: 'PRONTO_PARA_REVISAO' }), 'Enviado para revisão.')} className="rounded-sm bg-ink px-4 py-2 text-sm text-parchment">Enviar para revisão</button>}
          {estado === 'PRONTO_PARA_REVISAO' && perfilPode(user.perfil, 'editar') && <button onClick={() => executar(() => patch({ op: 'estado', estado: 'RASCUNHO' }), 'Voltou para rascunho.')} className="rounded-sm border border-ink/20 px-4 py-2 text-sm">Voltar para rascunho</button>}
          {estado === 'PROTOCOLO_EXTERNO_REGISTRADO' && perfilPode(user.perfil, 'fase') && <button onClick={() => executar(() => patch({ op: 'estado', estado: 'ACOMPANHAMENTO' }), 'Caso em acompanhamento.')} className="rounded-sm bg-ink px-4 py-2 text-sm text-parchment">Passar para acompanhamento</button>}
          {estado === 'ACOMPANHAMENTO' && perfilPode(user.perfil, 'fase') && <button onClick={() => executar(() => patch({ op: 'estado', estado: 'ENCERRADO' }), 'Caso encerrado.')} className="rounded-sm border border-ink/20 px-4 py-2 text-sm">Encerrar caso</button>}
        </div>
      </Card>

      <Card className="mt-6" eyebrow="Advogado(a)" title="Registrar revisão">
        {!advogado ? <p className="text-sm text-slate">Apenas advogado(a) registra a revisão.</p> : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="decisao" checked={decisao === 'aprovado'} onChange={() => setDecisao('aprovado')} />Revisado, sem ajustes pendentes</label>
              <label className="flex items-center gap-2"><input type="radio" name="decisao" checked={decisao === 'ajustes'} onChange={() => setDecisao('ajustes')} />Revisado, com ajustes a fazer</label>
            </div>
            <label htmlFor="obs" className="block text-sm font-medium text-ink">Observações</label>
            <textarea id="obs" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} className="w-full rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm" />
            <button onClick={() => executar(async () => { await api(`/cases/${caso.id}/reviews`, { method: 'POST', body: { decisao, observacoes: obs } }); setObs('') }, 'Revisão registrada.')} className="rounded-sm bg-ink px-4 py-2 text-sm text-parchment">Registrar revisão</button>
            <p className="text-xs text-slate">A revisão aprovada só muda o estado para “Revisado” se o caso estiver “Pronto p/ revisão”. Ela não atesta validade ou suficiência da petição.</p>
          </div>
        )}
        {revs.length > 0 && (
          <ul className="mt-5 space-y-2 border-t border-ink/10 pt-4 text-sm">
            {revs.map((r) => (<li key={r.id}><span className="font-medium">{r.decisao === 'aprovado' ? 'Sem ajustes pendentes' : 'Com ajustes'}</span> · {dataBR(r.em)} · {r.advogado_id} <span className="text-xs text-slate">({r.pendencias_abertas} pendência(s) abertas, {r.alertas_urgentes_abertos.length} urgente(s))</span>{r.observacoes && <p className="text-xs text-slate">{r.observacoes}</p>}</li>))}
          </ul>
        )}
      </Card>

      <Card className="mt-6" eyebrow="Fora da plataforma" title="Protocolo externo">
        {caso.protocolo ? (
          <div className="text-sm"><p>Número informado: <span className="font-mono">{caso.protocolo.numero_processo}</span></p><p className="text-xs text-slate">Registrado por {caso.protocolo.autor} em {dataBR(caso.protocolo.em)}. {caso.protocolo.observacao}</p></div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate">A plataforma não protocola nada. Depois que o advogado protocolar a petição no tribunal, registre aqui o número do processo apenas como informação.</p>
            {estado === 'REVISADO' && perfilPode(user.perfil, 'registrar_protocolo') ? (
              <div className="flex flex-wrap items-end gap-3">
                <div><label htmlFor="num" className="mb-1.5 block text-sm font-medium text-ink">Número do processo</label><input id="num" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="0000000-00.0000.0.00.0000" className="w-72 rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm" /></div>
                <button disabled={numero.trim().length < 5} onClick={() => executar(() => patch({ op: 'protocolo', numero_processo: numero }), 'Protocolo externo registrado.')} className="rounded-sm bg-ink px-4 py-2 text-sm text-parchment disabled:opacity-50">Registrar</button>
              </div>
            ) : <p className="text-xs text-slate">Disponível para advogado(a) quando o caso estiver “Revisado”.</p>}
          </div>
        )}
      </Card>

      <Card className="mt-6" eyebrow="Saída" title="Relatório de organização">
        <p className="text-sm text-slate">Resumo do levantamento para apoiar a minuta. É um rascunho de apoio, não uma peça processual.</p>
        {perfilPode(user.perfil, 'exportar') ? <button onClick={() => executar(async () => setRelatorio(await api(`/cases/${caso.id}/report`)), 'Relatório gerado.')} className="mt-3 rounded-sm border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5">Gerar relatório</button> : <p className="mt-2 text-xs text-slate">Apenas advogado(a) gera o relatório.</p>}
        {relatorio && <Relatorio r={relatorio} />}
      </Card>
      <p className="mt-6 text-xs text-slate">{MENSAGENS.D}</p>
    </>
  )
}

export default function Revisao() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-10"><CasoGuard>{(p) => <Conteudo {...p} />}</CasoGuard></main>
    </div>
  )
}
