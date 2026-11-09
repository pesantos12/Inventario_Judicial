'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Selo from '@/components/Selo'
import Gateway from '@/components/Gateway'
import { Campo, Selecao } from '@/components/Campos'
import { api, usuarioAtual, casoAtualId } from '@/lib/cliente'
import { perfilPode, MENSAGENS } from '@/lib/estados'
import { ESTADOS_CIVIS, REGIMES, QUALIDADES } from '@/lib/catalogo'

const SECOES = [
  { id: 'processo', nome: 'Processo' },
  { id: 'partes', nome: 'Requerente e falecido' },
  { id: 'sucessao', nome: 'Situação sucessória' },
  { id: 'conjuge', nome: 'Cônjuge e regime' },
]

const GATEWAYS = [
  ['ha_testamento', 'O falecido deixou testamento?', 'Se não souber, responda "não sei": a inexistência de testamento não é presumida.'],
  ['ha_herdeiros_incapazes', 'Há herdeiros menores ou incapazes?', 'Exige atenção quanto à representação e à intervenção do Ministério Público.'],
  ['ha_conflito', 'Há conflito entre os interessados?', 'Divergência sobre bens, herdeiros, valores ou condução do procedimento.'],
  ['ha_uniao_estavel', 'Há união estável alegada ou reconhecida?', ''],
  ['ha_doacoes', 'Houve doações em vida a herdeiros ou terceiros?', 'Podem exigir análise de colação.'],
  ['ha_renuncia_alegada', 'Alguém alega renúncia à herança?', ''],
  ['ha_cessao', 'Houve cessão de direitos hereditários?', ''],
  ['ha_bens_sonegados', 'Há suspeita de bens ocultos ou sonegados?', ''],
  ['ha_interessado_nao_localizado', 'Há interessado que não foi localizado?', ''],
  ['comoriencia', 'Pode ter havido mortes simultâneas (comoriência)?', 'Situação que exige análise jurídica especializada.'],
  ['sem_parentes_conhecidos', 'Não há parentes ou herdeiros conhecidos?', 'A plataforma não conclui ausência de herdeiros: apenas sinaliza a necessidade de diligências.'],
]

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const soDigitos = (s = '') => s.replace(/\D/g, '')
const cpfSuspeito = (s) => !!s && soDigitos(s).length !== 11

export default function Cadastro() {
  const [user, setUser] = useState(null)
  const [id, setId] = useState(undefined)
  const [caso, setCaso] = useState(null)
  const [f, setF] = useState(null)
  const [secao, setSecao] = useState(0)
  const [msg, setMsg] = useState(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { setUser(usuarioAtual()); setId(casoAtualId()) }, [])
  const carregar = useCallback((cid) => api(`/cases/${cid}`).then((c) => { setCaso(c); setF(c.formulario); setMsg(null) }).catch((e) => setMsg({ tipo: 'erro', texto: e.message })), [])
  useEffect(() => { if (id) carregar(id) }, [id, carregar])

  const podeEditar = !!user && perfilPode(user.perfil, 'editar')
  const alterado = useMemo(() => !!caso && JSON.stringify(f) !== JSON.stringify(caso.formulario), [f, caso])
  const set = (sec, campo) => (v) => setF((x) => ({ ...x, [sec]: { ...(x[sec] || {}), [campo]: v } }))
  const val = (sec, campo) => f?.[sec]?.[campo]

  const salvar = async () => {
    setSalvando(true); setMsg(null)
    try {
      const dados = Object.fromEntries(['processo', 'requerente', 'falecido', 'sucessao', 'conjuge'].map((k) => [k, f[k] || {}]))
      const novo = await api(`/cases/${id}`, { method: 'PATCH', body: { version: caso.version, op: 'formulario', dados } })
      setCaso(novo); setF(novo.formulario)
      setMsg({ tipo: 'ok', texto: 'Rascunho salvo. A avaliação foi atualizada com as regras vigentes.' })
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e.status === 409 ? 'Este caso foi alterado em outra aba ou por outra pessoa. Recarreguei a versão atual; reaplique sua edição.' : e.message })
      if (e.status === 409) carregar(id)
    }
    setSalvando(false)
  }

  const alertas = caso?.avaliacao.alerts || []
  const cpfRq = val('requerente', 'cpf'); const cpfFal = val('falecido', 'cpf')

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-widest text-bronze-dark">Preparação da minuta de petição inicial</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Cadastro do inventário judicial</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate">Registre os dados do caso. Nenhum campo é obrigatório para salvar: o que faltar vira pendência para a revisão do advogado, e a plataforma nunca declara a petição válida ou inválida.</p>

        {id === undefined || (id && !f && !msg) ? <p className="mt-8 text-sm text-slate">Carregando…</p>
          : !id ? <Card className="mt-8"><p className="text-sm text-ink">Nenhum caso aberto. <Link href="/central" className="underline">Abra ou crie um caso na Central</Link>.</p></Card>
          : !f ? <p role="alert" className="mt-8 text-sm text-selo-danger">{msg?.texto}</p>
          : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <nav aria-label="Seções" className="mb-4 flex flex-wrap gap-2">
                {SECOES.map((s, i) => (
                  <button key={s.id} onClick={() => setSecao(i)} className={`rounded-sm border px-3 py-1.5 text-sm ${i === secao ? 'border-ink bg-ink text-parchment' : 'border-ink/15 text-ink/80 hover:bg-ink/5'}`}>{i + 1}. {s.nome}</button>
                ))}
              </nav>

              <Card>
                {!podeEditar && <p className="mb-4 rounded-sm border border-ink/15 bg-ink/5 px-3 py-2 text-sm text-slate">Seu perfil só pode consultar este cadastro.</p>}

                {secao === 0 && (
                  <div className="space-y-5">
                    <h2 className="font-display text-lg font-semibold text-ink">Dados do processo</h2>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Campo id="comarca" label="Comarca / UF" valor={val('processo', 'comarca_uf')} onChange={set('processo', 'comarca_uf')} placeholder="Belo Horizonte/MG" dica="Informe a comarca onde se pretende ajuizar." desabilitado={!podeEditar} />
                      <Campo id="juizo" label="Juízo" valor={val('processo', 'juizo')} onChange={set('processo', 'juizo')} placeholder="Vara de Sucessões" desabilitado={!podeEditar} />
                    </div>
                    <Gateway id="ja_distribuido" pergunta="O inventário já foi distribuído?" ajuda="Se já houver processo, informe o número abaixo. O protocolo em si é feito fora da plataforma." valor={val('processo', 'ja_distribuido')} onChange={set('processo', 'ja_distribuido')} desabilitado={!podeEditar} />
                    {val('processo', 'ja_distribuido') === 'sim' && <Campo id="numproc" label="Número do processo" valor={val('processo', 'numero_processo')} onChange={set('processo', 'numero_processo')} placeholder="0000000-00.0000.0.00.0000" desabilitado={!podeEditar} />}
                  </div>
                )}

                {secao === 1 && (
                  <div className="space-y-8">
                    <section className="space-y-5">
                      <h2 className="font-display text-lg font-semibold text-ink">Requerente</h2>
                      <Campo id="rq-nome" label="Nome completo" valor={val('requerente', 'nome')} onChange={set('requerente', 'nome')} desabilitado={!podeEditar} />
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Campo id="rq-cpf" label="CPF" valor={cpfRq} onChange={set('requerente', 'cpf')} placeholder="000.000.000-00" aviso={cpfSuspeito(cpfRq) ? 'O CPF deve ter 11 dígitos. Você pode salvar assim mesmo e corrigir depois.' : ''} desabilitado={!podeEditar} />
                        <Selecao id="rq-qual" label="Qualidade do requerente" valor={val('requerente', 'qualidade')} onChange={set('requerente', 'qualidade')} opcoes={[{ valor: '', rotulo: 'Não informado' }, ...QUALIDADES]} desabilitado={!podeEditar} />
                      </div>
                    </section>
                    <section className="space-y-5 border-t border-ink/10 pt-6">
                      <h2 className="font-display text-lg font-semibold text-ink">Falecido (de cujus)</h2>
                      <Campo id="f-nome" label="Nome completo" valor={val('falecido', 'nome')} onChange={set('falecido', 'nome')} desabilitado={!podeEditar} />
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Campo id="f-cpf" label="CPF" valor={cpfFal} onChange={set('falecido', 'cpf')} placeholder="000.000.000-00" aviso={cpfSuspeito(cpfFal) ? 'O CPF deve ter 11 dígitos. Você pode salvar assim mesmo e corrigir depois.' : ''} desabilitado={!podeEditar} />
                        <Campo id="f-obito" label="Data do óbito" tipo="date" valor={val('falecido', 'data_obito')} onChange={set('falecido', 'data_obito')} desabilitado={!podeEditar} />
                      </div>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Campo id="f-dom" label="Último domicílio" valor={val('falecido', 'ultimo_domicilio')} onChange={set('falecido', 'ultimo_domicilio')} placeholder="Cidade/UF" desabilitado={!podeEditar} />
                        <Campo id="f-local" label="Local do óbito" valor={val('falecido', 'local_obito')} onChange={set('falecido', 'local_obito')} placeholder="Cidade/UF" dica="O local do óbito, sozinho, não define o foro competente." desabilitado={!podeEditar} />
                      </div>
                      <Selecao id="f-ec" label="Estado civil na data do óbito" valor={val('falecido', 'estado_civil')} onChange={set('falecido', 'estado_civil')} opcoes={ESTADOS_CIVIS} desabilitado={!podeEditar} />
                      <p className="text-xs text-slate">A certidão de óbito e demais documentos são anexados na tela de Documentação.</p>
                    </section>
                  </div>
                )}

                {secao === 2 && (
                  <div>
                    <h2 className="mb-1 font-display text-lg font-semibold text-ink">Situação sucessória</h2>
                    <p className="mb-4 text-sm text-slate">Responda o que souber. Cada resposta aciona regras de verificação, não decisões jurídicas.</p>
                    <div className="divide-y divide-ink/10">
                      {GATEWAYS.map(([campo, pergunta, ajuda]) => (
                        <Gateway key={campo} id={campo} pergunta={pergunta} ajuda={ajuda} valor={val('sucessao', campo)} onChange={set('sucessao', campo)} desabilitado={!podeEditar} />
                      ))}
                    </div>
                    <div className="mt-4 border-t border-ink/10 pt-4">
                      <label htmlFor="obs" className="mb-1.5 block text-sm font-medium text-ink">Observações livres</label>
                      <textarea id="obs" rows={3} disabled={!podeEditar} value={val('sucessao', 'observacoes_livres') ?? ''} onChange={(e) => set('sucessao', 'observacoes_livres')(e.target.value)} className="w-full rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm" />
                      <p className="mt-1 text-xs text-slate">Texto livre é tratado como dado, nunca como instrução ao sistema.</p>
                    </div>
                  </div>
                )}

                {secao === 3 && (
                  <div className="space-y-2">
                    <h2 className="font-display text-lg font-semibold text-ink">Cônjuge ou companheiro(a)</h2>
                    <Gateway id="ha_conjuge" pergunta="O falecido deixou cônjuge ou companheiro(a)?" valor={val('conjuge', 'ha_conjuge')} onChange={set('conjuge', 'ha_conjuge')} desabilitado={!podeEditar} />
                    {val('conjuge', 'ha_conjuge') === 'sim' && (
                      <div className="space-y-5 border-t border-ink/10 pt-5">
                        <Campo id="c-nome" label="Nome do cônjuge/companheiro(a)" valor={val('conjuge', 'nome')} onChange={set('conjuge', 'nome')} desabilitado={!podeEditar} />
                        <Selecao id="c-reg" label="Regime de bens" valor={val('conjuge', 'regime_bens')} onChange={set('conjuge', 'regime_bens')} opcoes={REGIMES} desabilitado={!podeEditar} />
                        <Gateway id="pacto" pergunta="Há pacto antenupcial?" valor={val('conjuge', 'pacto_antenupcial')} onChange={set('conjuge', 'pacto_antenupcial')} desabilitado={!podeEditar} />
                        <p className="text-xs text-slate">A plataforma não calcula meação nem quinhões; apenas organiza as informações para o advogado.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
                  <div className="flex gap-2">
                    <button disabled={secao === 0} onClick={() => setSecao(secao - 1)} className="rounded-sm border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5 disabled:opacity-40">Anterior</button>
                    <button disabled={secao === SECOES.length - 1} onClick={() => setSecao(secao + 1)} className="rounded-sm border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5 disabled:opacity-40">Próxima</button>
                  </div>
                  <div className="flex items-center gap-3">
                    {alterado && <span className="text-xs text-selo-warning">Alterações não salvas</span>}
                    <button disabled={!podeEditar || !alterado || salvando} onClick={salvar} className="rounded-sm bg-ink px-5 py-2 text-sm font-medium text-parchment hover:bg-ink-soft disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar rascunho'}</button>
                  </div>
                </div>
                {msg && <p role={msg.tipo === 'erro' ? 'alert' : 'status'} className={`mt-3 text-sm ${msg.tipo === 'erro' ? 'text-selo-danger' : 'text-selo-success'}`}>{msg.texto}</p>}
              </Card>
              <p className="mt-4 text-xs text-slate">Herdeiros e bens são cadastrados nas telas Herdeiros e Patrimônio.</p>
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Card eyebrow="Última avaliação salva" title="Alertas do cadastro">
                <div className="mb-3 flex items-center justify-between"><Selo estado={caso.processo_estado.estado} /><span className="font-mono text-[11px] text-slate">regras {caso.avaliacao.rule_version}</span></div>
                {alertas.length === 0 ? <p className="text-sm text-slate">Nenhum alerta com os dados atuais.</p> : (
                  <ul className="max-h-[420px] space-y-3 overflow-auto pr-1">
                    {alertas.map((a) => (
                      <li key={a.id} className="text-sm">
                        <Selo estado={a.severidade} />
                        <p className="mt-1 text-ink">{a.mensagem}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 border-t border-ink/10 pt-3 text-xs text-slate">{MENSAGENS.D}</p>
              </Card>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
