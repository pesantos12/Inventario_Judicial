'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Selo from '@/components/Selo'
import CasoGuard from '@/components/CasoGuard'
import useLista from '@/components/useLista'
import { Campo, Selecao, Marca } from '@/components/Campos'
import { PARENTESCOS, SITUACOES_VIDA, CAPACIDADES, rotuloDe } from '@/lib/catalogo'
import { MENSAGENS, perfilPode } from '@/lib/estados'

const CHAVES = ['herdeiros']
const PREFIXO = { herdeiros: 'h' }
const SUPORTES = [{ valor: '', rotulo: 'Não se aplica / não informado' }, { valor: 'representacao', rotulo: 'Representação (menor de 16 anos)' }, { valor: 'assistencia', rotulo: 'Assistência (relativamente incapaz)' }]

function Conteudo({ caso, user, recarregar }) {
  const L = useLista(caso, recarregar, CHAVES, PREFIXO)
  const podeEditar = perfilPode(user.perfil, 'editar')
  const hs = L.listas.herdeiros
  const alertas = caso.avaliacao.alerts
  const doHerdeiro = (h) => alertas.filter((a) => a.id.endsWith(`-${h.id}`))
  const gerais = alertas.filter((a) => /^ALT-JUR-(008|009|010|011)-/.test(a.id) && !hs.some((h) => a.id.endsWith(`-${h.id}`)))

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-bronze-dark">Sucessão · {caso.id}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Herdeiros e interessados</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate">Registre apenas o que é conhecido. A plataforma não define quem herda nem calcula quinhões: organiza os dados e sinaliza situações para o advogado.</p>
        </div>
        {podeEditar && <button onClick={() => L.adicionar('herdeiros', { nome: '', parentesco: 'filho', situacao_vida: 'vivo', capacidade: 'desconhecido' })} className="rounded-sm bg-ink px-4 py-2.5 text-sm font-medium text-parchment hover:bg-ink-soft">+ Adicionar interessado</button>}
      </div>

      {gerais.length > 0 && (
        <Card className="mt-6" eyebrow="Alertas gerais" title="Pontos para revisão">
          <ul className="space-y-3">{gerais.map((a) => (<li key={a.id} className="flex items-start gap-3 text-sm"><Selo estado={a.severidade} /><span className="text-ink">{a.mensagem}</span></li>))}</ul>
        </Card>
      )}

      <div className="mt-6 space-y-4">
        {hs.length === 0 && <Card><p className="text-sm text-slate">Nenhum herdeiro informado. Se não há parentes conhecidos, responda isso no Cadastro (a plataforma não conclui ausência de herdeiros).</p></Card>}
        {hs.map((h, i) => {
          const set = (campo) => (v) => L.mudar('herdeiros', h.id, campo, v)
          const pre = h.situacao_vida === 'pre_morto' || h.situacao_vida === 'pos_morto'
          const incapaz = h.capacidade === 'menor' || h.capacidade === 'incapacidade_alegada'
          const flags = doHerdeiro(h)
          return (
            <Card key={h.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-base font-semibold text-ink">{h.nome || `Interessado ${i + 1}`} <span className="font-mono text-xs font-normal text-slate">· {rotuloDe(PARENTESCOS, h.parentesco)} · {rotuloDe(SITUACOES_VIDA, h.situacao_vida).split(' (')[0]}</span></p>
                <div className="flex gap-2">{h.nao_localizado && <Selo estado="PENDENTE" texto="Não localizado" />}{incapaz && <Selo estado="ATENCAO" texto="Capacidade a revisar" />}</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id={`n-${h.id}`} label="Nome" valor={h.nome} onChange={set('nome')} desabilitado={!podeEditar} />
                <Selecao id={`p-${h.id}`} label="Parentesco" valor={h.parentesco} onChange={set('parentesco')} opcoes={PARENTESCOS} desabilitado={!podeEditar} />
                <Selecao id={`s-${h.id}`} label="Situação de vida" valor={h.situacao_vida} onChange={set('situacao_vida')} opcoes={SITUACOES_VIDA} desabilitado={!podeEditar} />
                <Selecao id={`c-${h.id}`} label="Capacidade (conforme declarado)" valor={h.capacidade} onChange={set('capacidade')} opcoes={CAPACIDADES} desabilitado={!podeEditar} />
                {pre && <Campo id={`o-${h.id}`} label="Data do falecimento do herdeiro" tipo="date" valor={h.data_obito} onChange={set('data_obito')} dica={h.situacao_vida === 'pos_morto' ? 'Necessária para analisar a sucessão encadeada.' : ''} desabilitado={!podeEditar} />}
                {h.parentesco === 'neto' && (
                  <Selecao id={`pai-${h.id}`} label="Descende de (herdeiro pré-morto)" valor={h.pai_id} onChange={set('pai_id')} opcoes={[{ valor: '', rotulo: 'Não informado' }, ...hs.filter((x) => x.id !== h.id).map((x) => ({ valor: x.id, rotulo: x.nome || x.id }))]} desabilitado={!podeEditar} />
                )}
                {incapaz && (
                  <>
                    <Selecao id={`sup-${h.id}`} label="Forma de suporte" valor={h.suporte} onChange={set('suporte')} opcoes={SUPORTES} desabilitado={!podeEditar} />
                    <Campo id={`rep-${h.id}`} label="Representante / assistente" valor={h.representante} onChange={set('representante')} placeholder="Nome, se conhecido" desabilitado={!podeEditar} />
                  </>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Marca id={`nl-${h.id}`} label="Interessado ainda não localizado" valor={h.nao_localizado} onChange={set('nao_localizado')} desabilitado={!podeEditar} dica="Endereços desconhecidos não são inventados; registre as diligências no Cadastro." />
                {podeEditar && <button onClick={() => { if (window.confirm(`Remover “${h.nome || 'interessado'}” do rascunho? A alteração fica registrada na auditoria.`)) L.remover('herdeiros', h.id) }} className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5">Remover do rascunho</button>}
              </div>
              {flags.length > 0 && <ul className="mt-4 space-y-2 border-t border-ink/10 pt-3">{flags.map((a) => (<li key={a.id} className="flex items-start gap-3 text-xs"><Selo estado={a.severidade} /><span className="text-ink">{a.mensagem}</span></li>))}</ul>}
            </Card>
          )
        })}
      </div>

      <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-ink/10 bg-parchment/95 p-4 shadow backdrop-blur">
        <p className="text-xs text-slate">{MENSAGENS.C}</p>
        <div className="flex items-center gap-3">
          {L.msg && <span role={L.msg.tipo === 'erro' ? 'alert' : 'status'} className={`text-sm ${L.msg.tipo === 'erro' ? 'text-selo-danger' : 'text-selo-success'}`}>{L.msg.texto}</span>}
          {L.alterado && <span className="text-xs text-selo-warning">Alterações não salvas</span>}
          <button disabled={!podeEditar || !L.alterado || L.salvando} onClick={L.salvar} className="rounded-sm bg-ink px-5 py-2 text-sm font-medium text-parchment hover:bg-ink-soft disabled:opacity-50">{L.salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
      <p className="mt-4 text-xs text-slate">Documentos de identificação dos herdeiros são anexados em <Link href="/documentos" className="underline">Documentação</Link>. {MENSAGENS.D}</p>
    </>
  )
}

export default function Herdeiros() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10"><CasoGuard>{(p) => <Conteudo {...p} />}</CasoGuard></main>
    </div>
  )
}
