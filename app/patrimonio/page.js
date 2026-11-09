'use client'

import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Selo from '@/components/Selo'
import CasoGuard from '@/components/CasoGuard'
import useLista from '@/components/useLista'
import { Campo, Selecao, Marca } from '@/components/Campos'
import { TIPOS_BEM, rotuloDe } from '@/lib/catalogo'
import { MENSAGENS, perfilPode } from '@/lib/estados'

const CHAVES = ['bens', 'dividas']
const PREFIXO = { bens: 'b', dividas: 'd' }
const AQUISICAO = [{ valor: '', rotulo: 'Não informada' }, { valor: 'anterior_casamento', rotulo: 'Antes do casamento' }, { valor: 'constancia', rotulo: 'Na constância do casamento' }, { valor: 'desconhecida', rotulo: 'Desconhecida' }]
const AVALIACAO = [{ valor: '', rotulo: 'Não informada' }, { valor: 'pendente', rotulo: 'Pendente' }, { valor: 'realizada', rotulo: 'Realizada' }]
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v) => (v === '' || v == null ? undefined : Number(v))

function Conteudo({ caso, user, recarregar }) {
  const L = useLista(caso, recarregar, CHAVES, PREFIXO)
  const podeEditar = perfilPode(user.perfil, 'editar')
  const { bens, dividas } = L.listas
  const alertas = caso.avaliacao.alerts
  const dosBens = (b) => alertas.filter((a) => a.id.endsWith(`-${b.id}`))
  const informados = bens.filter((b) => typeof b.valor_estimado === 'number')
  const soma = informados.reduce((t, b) => t + b.valor_estimado, 0)
  const semValor = bens.length - informados.length

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-bronze-dark">Bens · {caso.id}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Patrimônio e dívidas</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate">Informe os bens e dívidas conhecidos. Valores são opcionais e nunca são estimados pela plataforma; origem do bem e posse sem matrícula geram alertas, não conclusões.</p>
        </div>
        {podeEditar && <button onClick={() => L.adicionar('bens', { tipo: 'imovel', descricao: '' })} className="rounded-sm bg-ink px-4 py-2.5 text-sm font-medium text-parchment hover:bg-ink-soft">+ Declarar bem</button>}
      </div>

      <Card className="mt-6">
        <div className="grid gap-4 text-center sm:grid-cols-3">
          <div><p className="font-display text-2xl font-semibold text-ink">{bens.length}</p><p className="text-xs text-slate">Bens declarados</p></div>
          <div><p className="font-display text-2xl font-semibold text-ink">{informados.length ? brl(soma) : '—'}</p><p className="text-xs text-slate">Soma dos valores informados ({informados.length})</p></div>
          <div><p className="font-display text-2xl font-semibold text-selo-warning">{semValor}</p><p className="text-xs text-slate">Sem valor informado</p></div>
        </div>
        <p className="mt-3 text-xs text-slate">A soma considera só valores digitados e não é avaliação nem base de cálculo de tributo ou partilha.</p>
      </Card>

      <div className="mt-6 space-y-4">
        {bens.length === 0 && <Card><p className="text-sm text-slate">Nenhum bem declarado ainda.</p></Card>}
        {bens.map((b, i) => {
          const set = (campo) => (v) => L.mudar('bens', b.id, campo, v)
          const flags = dosBens(b)
          return (
            <Card key={b.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-base font-semibold text-ink">{b.descricao || `Bem ${i + 1}`} <span className="font-mono text-xs font-normal text-slate">· {rotuloDe(TIPOS_BEM, b.tipo)}</span></p>
                <div className="flex gap-2">{b.nao_confirmado && <Selo estado="NAO_INFORMADO" texto="Não confirmado" />}{b.posse && <Selo estado="ATENCAO" texto="Posse sem matrícula" />}{b.exterior && <Selo estado="ATENCAO" texto="No exterior" />}</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Selecao id={`t-${b.id}`} label="Tipo" valor={b.tipo} onChange={set('tipo')} opcoes={TIPOS_BEM} desabilitado={!podeEditar} />
                <Campo id={`d-${b.id}`} label="Descrição" valor={b.descricao} onChange={set('descricao')} desabilitado={!podeEditar} />
                <Campo id={`m-${b.id}`} label="Município" valor={b.municipio} onChange={set('municipio')} desabilitado={!podeEditar} />
                <Campo id={`u-${b.id}`} label="UF" valor={b.uf} onChange={(v) => set('uf')(v.toUpperCase().slice(0, 2))} desabilitado={!podeEditar} />
                <Campo id={`v-${b.id}`} label="Valor estimado (R$, opcional)" tipo="number" step="0.01" valor={b.valor_estimado} onChange={(v) => set('valor_estimado')(num(v))} dica="Deixe em branco se não houver valor conhecido." desabilitado={!podeEditar} />
                <Selecao id={`a-${b.id}`} label="Origem da aquisição" valor={b.aquisicao} onChange={set('aquisicao')} opcoes={AQUISICAO} desabilitado={!podeEditar} />
                <Selecao id={`av-${b.id}`} label="Avaliação" valor={b.avaliacao} onChange={set('avaliacao')} opcoes={AVALIACAO} desabilitado={!podeEditar} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Marca id={`ex-${b.id}`} label="Bem no exterior" valor={b.exterior} onChange={set('exterior')} desabilitado={!podeEditar} />
                <Marca id={`po-${b.id}`} label="Apenas posse (sem matrícula em nome do falecido)" valor={b.posse} onChange={set('posse')} desabilitado={!podeEditar} />
                <Marca id={`nc-${b.id}`} label="Existência não confirmada" valor={b.nao_confirmado} onChange={set('nao_confirmado')} desabilitado={!podeEditar} />
                <Marca id={`da-${b.id}`} label="Descoberto após as primeiras declarações" valor={b.descoberto_apos_declaracoes} onChange={set('descoberto_apos_declaracoes')} desabilitado={!podeEditar} />
                <Marca id={`dp-${b.id}`} label="Descoberto após a partilha" valor={b.descoberto_apos_partilha} onChange={set('descoberto_apos_partilha')} desabilitado={!podeEditar} />
              </div>
              {podeEditar && <div className="mt-4 text-right"><button onClick={() => { if (window.confirm(`Remover “${b.descricao || 'bem'}” do rascunho? A alteração fica registrada na auditoria.`)) L.remover('bens', b.id) }} className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5">Remover do rascunho</button></div>}
              {flags.length > 0 && <ul className="mt-4 space-y-2 border-t border-ink/10 pt-3">{flags.map((a) => (<li key={a.id} className="flex items-start gap-3 text-xs"><Selo estado={a.severidade} /><span className="text-ink">{a.mensagem}</span></li>))}</ul>}
            </Card>
          )
        })}
      </div>

      <div className="mb-3 mt-10 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-ink">Dívidas do espólio</h2>
        {podeEditar && <button onClick={() => L.adicionar('dividas', { credor: '' })} className="rounded-sm border border-ink/20 px-3 py-1.5 text-sm hover:bg-ink/5">+ Adicionar dívida</button>}
      </div>
      <Card>
        {dividas.length === 0 ? <p className="text-sm text-slate">Nenhuma dívida informada. Isso não significa que não existam; só que não foram informadas.</p> : (
          <ul className="divide-y divide-ink/10">
            {dividas.map((d) => {
              const set = (campo) => (v) => L.mudar('dividas', d.id, campo, v)
              return (
                <li key={d.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo id={`dc-${d.id}`} label="Credor" valor={d.credor} onChange={set('credor')} desabilitado={!podeEditar} />
                    <Campo id={`dv-${d.id}`} label="Valor (R$, opcional)" tipo="number" step="0.01" valor={d.valor} onChange={(v) => set('valor')(num(v))} desabilitado={!podeEditar} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-6">
                      <Marca id={`dcp-${d.id}`} label="Comprovada por documento" valor={d.comprovada} onChange={set('comprovada')} desabilitado={!podeEditar} />
                      <Marca id={`dct-${d.id}`} label="Contestada" valor={d.contestada} onChange={set('contestada')} desabilitado={!podeEditar} />
                    </div>
                    {podeEditar && <button onClick={() => { if (window.confirm('Remover esta dívida do rascunho? A alteração fica registrada na auditoria.')) L.remover('dividas', d.id) }} className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5">Remover do rascunho</button>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-ink/10 bg-parchment/95 p-4 shadow backdrop-blur">
        <p className="text-xs text-slate">{MENSAGENS.D}</p>
        <div className="flex items-center gap-3">
          {L.msg && <span role={L.msg.tipo === 'erro' ? 'alert' : 'status'} className={`text-sm ${L.msg.tipo === 'erro' ? 'text-selo-danger' : 'text-selo-success'}`}>{L.msg.texto}</span>}
          {L.alterado && <span className="text-xs text-selo-warning">Alterações não salvas</span>}
          <button disabled={!podeEditar || !L.alterado || L.salvando} onClick={L.salvar} className="rounded-sm bg-ink px-5 py-2 text-sm font-medium text-parchment hover:bg-ink-soft disabled:opacity-50">{L.salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </>
  )
}

export default function Patrimonio() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10"><CasoGuard>{(p) => <Conteudo {...p} />}</CasoGuard></main>
    </div>
  )
}
