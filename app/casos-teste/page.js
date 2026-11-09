'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import { api, usuarioAtual, definirCaso } from '@/lib/cliente'
import { perfilPode } from '@/lib/estados'

const VAZIO = { alertas_corretos: 0, alertas_faltantes: 0, alertas_indevidos: 0, linguagem_segura: 'sim', falha_critica: 'nao', observacoes: '' }

export default function CasosTeste() {
  const [user, setUser] = useState(null)
  const [dados, setDados] = useState(null)
  const [aval, setAval] = useState([])
  const [sel, setSel] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [msg, setMsg] = useState(null)

  const carregarAval = () => api('/avaliacoes').then((d) => setAval(d.avaliacoes)).catch(() => {})
  useEffect(() => { const u = usuarioAtual(); setUser(u); api('/templates').then(setDados).catch((e) => setMsg({ tipo: 'erro', texto: e.message })); if (perfilPode(u.perfil, 'revisar')) carregarAval() }, [])

  const criar = async (id) => { try { const c = await api('/cases', { method: 'POST', body: { template_id: id } }); definirCaso(c.id); window.location.href = '/central' } catch (e) { setMsg({ tipo: 'erro', texto: e.message }) } }
  const registrar = async (e) => {
    e.preventDefault(); setMsg(null)
    try { await api('/avaliacoes', { method: 'POST', body: { caso_id: sel, ...form } }); setMsg({ tipo: 'ok', texto: `Avaliação do caso ${sel} registrada.` }); setSel(null); setForm(VAZIO); carregarAval() }
    catch (er) { setMsg({ tipo: 'erro', texto: er.message }) }
  }
  const csv = async () => {
    const r = await fetch('/api/avaliacoes?formato=csv', { headers: { 'x-user-id': user.id } })
    const url = URL.createObjectURL(await r.blob()); Object.assign(document.createElement('a'), { href: url, download: 'avaliacoes.csv' }).click(); URL.revokeObjectURL(url)
  }

  if (!user) return null
  const avaliador = perfilPode(user.perfil, 'revisar')
  const porClasse = (dados?.casos || []).reduce((acc, t) => { (acc[t.classe] ||= { titulo: t.classe_titulo, itens: [] }).itens.push(t); return acc }, {})
  const num = (k) => (v) => setForm((f) => ({ ...f, [k]: Math.max(0, parseInt(v || '0', 10) || 0) }))

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-widest text-bronze-dark">Avaliação do protótipo</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Casos de teste</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate">Os 54 casos hipotéticos (18 classes × 3 variações), todos sintéticos. Cada um cria um caso preenchido com o que o enunciado afirma; o restante fica como “não sei”. A saída esperada não é mostrada aqui: compare o resultado com o caderno de casos.</p>
        {msg && <p role={msg.tipo === 'erro' ? 'alert' : 'status'} className={`mt-4 text-sm ${msg.tipo === 'erro' ? 'text-selo-danger' : 'text-selo-success'}`}>{msg.texto}</p>}

        {user.perfil === 'administrador' ? <Card className="mt-6"><p className="text-sm text-ink">O administrador não cria nem acessa casos.</p></Card> : (
          <div className="mt-6 space-y-3">
            {Object.entries(porClasse).map(([classe, g]) => (
              <details key={classe} className="rounded-md border border-ink/10 bg-white/70">
                <summary className="cursor-pointer px-5 py-3 font-display text-base font-semibold text-ink">{classe}. {g.titulo} <span className="font-mono text-xs font-normal text-slate">({g.itens.length})</span></summary>
                <ul className="divide-y divide-ink/10 px-5 pb-3">
                  {g.itens.map((t) => (
                    <li key={t.id} className="py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="max-w-2xl"><p className="text-sm text-ink"><span className="font-mono font-medium">{t.id}</span> · {t.entrada}</p><p className="mt-1 font-mono text-[11px] text-slate">Nível {t.metadados.nivel} · complexidade {t.metadados.complexidade} · {t.metadados.n_herdeiros} herdeiro(s) · {t.metadados.n_bens} bem(ns) · {t.metadados.n_documentos_anexados} doc(s)</p></div>
                        <div className="flex gap-2">
                          {perfilPode(user.perfil, 'editar') && <button onClick={() => criar(t.id)} className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5">Criar caso</button>}
                          {avaliador && <button onClick={() => { setSel(t.id); setMsg(null) }} className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5">Avaliar</button>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}

        {sel && (
          <Card className="mt-6" eyebrow="Rubrica" title={`Avaliar resultado do caso ${sel}`}>
            <form onSubmit={registrar} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                {[['alertas_corretos', 'Alertas corretos'], ['alertas_faltantes', 'Alertas esperados que faltaram'], ['alertas_indevidos', 'Alertas indevidos']].map(([k, r]) => (
                  <div key={k}><label htmlFor={k} className="mb-1.5 block text-sm font-medium text-ink">{r}</label><input id={k} type="number" min="0" value={form[k]} onChange={(e) => num(k)(e.target.value)} className="w-full rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm" /></div>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor="ls" className="mb-1.5 block text-sm font-medium text-ink">Linguagem segura (sem concluir inépcia/validade)?</label><select id="ls" value={form.linguagem_segura} onChange={(e) => setForm({ ...form, linguagem_segura: e.target.value })} className="w-full rounded-sm border border-ink/15 bg-white px-2 py-2 text-sm"><option value="sim">Sim</option><option value="nao">Não</option></select></div>
                <div><label htmlFor="fc" className="mb-1.5 block text-sm font-medium text-ink">Houve falha crítica?</label><select id="fc" value={form.falha_critica} onChange={(e) => setForm({ ...form, falha_critica: e.target.value })} className="w-full rounded-sm border border-ink/15 bg-white px-2 py-2 text-sm"><option value="nao">Não</option><option value="sim">Sim</option></select></div>
              </div>
              <div><label htmlFor="ob" className="mb-1.5 block text-sm font-medium text-ink">Observações</label><textarea id="ob" rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="w-full rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm" /></div>
              <div className="flex gap-2"><button className="rounded-sm bg-ink px-4 py-2 text-sm text-parchment">Registrar avaliação</button><button type="button" onClick={() => setSel(null)} className="rounded-sm border border-ink/20 px-4 py-2 text-sm">Cancelar</button></div>
            </form>
          </Card>
        )}

        {avaliador && (
          <Card className="mt-6" eyebrow="Suas avaliações" title={`Registros (${aval.length})`} action={<button onClick={csv} className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5">Baixar CSV</button>}>
            {aval.length === 0 ? <p className="text-sm text-slate">Nenhuma avaliação registrada.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-ink/15 text-slate"><th className="py-2 pr-3">Caso</th><th className="pr-3">Corretos</th><th className="pr-3">Faltantes</th><th className="pr-3">Indevidos</th><th className="pr-3">Linguagem segura</th><th className="pr-3">Falha crítica</th><th>Regras</th></tr></thead>
                <tbody>{aval.map((a, i) => (<tr key={i} className="border-b border-ink/5"><td className="py-1.5 pr-3 font-mono">{a.caso_id}</td><td className="pr-3">{a.alertas_corretos}</td><td className="pr-3">{a.alertas_faltantes}</td><td className="pr-3">{a.alertas_indevidos}</td><td className="pr-3">{a.linguagem_segura}</td><td className={`pr-3 ${a.falha_critica === 'sim' ? 'text-selo-danger' : ''}`}>{a.falha_critica}</td><td>v{a.rule_version}</td></tr>))}</tbody></table></div>
            )}
          </Card>
        )}
      </main>
    </div>
  )
}
