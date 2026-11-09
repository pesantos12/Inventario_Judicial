'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Card from '@/components/Card'
import Selo from '@/components/Selo'
import CasoGuard from '@/components/CasoGuard'
import { rotuloDe, PARENTESCOS, SITUACOES_VIDA } from '@/lib/catalogo'
import { MENSAGENS } from '@/lib/estados'

function No({ nome, papel, raiz = false, pre = false, notas = [] }) {
  return (
    <div className={`flex w-44 flex-col items-center rounded-sm border px-3 py-2.5 text-center ${raiz ? 'border-bronze bg-bronze/10' : pre ? 'border-dashed border-slate bg-ink/5' : 'border-ink/15 bg-white'}`}>
      <p className="text-xs font-medium leading-tight text-ink">{nome || '(sem nome informado)'}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate">{papel}</p>
      {notas.length > 0 && <div className="mt-1.5 flex flex-wrap justify-center gap-1">{notas.map((n) => <span key={n} className="rounded-sm border border-selo-warning/50 px-1 text-[9px] uppercase text-selo-warning">{n}</span>)}</div>}
    </div>
  )
}

const notasDe = (h) => [h.situacao_vida === 'pre_morto' && 'Pré-morto', h.situacao_vida === 'pos_morto' && 'Pós-morto', h.nao_localizado && 'Não localizado', ['menor', 'incapacidade_alegada'].includes(h.capacidade) && 'Capacidade a revisar'].filter(Boolean)
const papelDe = (h) => rotuloDe(PARENTESCOS, h.parentesco).split(' (')[0]
const Linha = () => <div className="h-6 w-px bg-ink/20" />

function Conteudo({ caso }) {
  const f = caso.formulario
  const hs = (f.herdeiros || []).map((h, i) => ({ ...h, id: h.id || `h${i + 1}` }))
  const ascendentes = hs.filter((h) => h.parentesco === 'ascendente')
  const filhos = hs.filter((h) => h.parentesco === 'filho')
  const netosDe = (id) => hs.filter((h) => h.parentesco === 'neto' && h.pai_id === id)
  const netosSoltos = hs.filter((h) => h.parentesco === 'neto' && !hs.some((p) => p.id === h.pai_id))
  const outros = hs.filter((h) => !['ascendente', 'filho', 'neto', 'conjuge'].includes(h.parentesco))
  const conjugeHerdeiro = hs.filter((h) => h.parentesco === 'conjuge')
  const temConjuge = f.conjuge?.ha_conjuge === 'sim'
  const alertas = caso.avaliacao.alerts.filter((a) => /^ALT-(JUR-(008|009|010|011)|CPL-(003|011))-/.test(a.id))

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-widest text-bronze-dark">Relações familiares · {caso.id}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Árvore genealógica</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate">Representação das relações <strong>informadas</strong> no cadastro. Ela não determina ordem de vocação hereditária, representação sucessória nem quinhões: isso é análise do advogado.</p>

      <Card className="mt-8 overflow-x-auto">
        {hs.length === 0 && !temConjuge ? (
          <p className="text-sm text-slate">Nenhuma relação informada ainda. Cadastre cônjuge e herdeiros em <Link href="/inventario/novo" className="underline">Cadastro</Link> e <Link href="/herdeiros" className="underline">Herdeiros</Link>.</p>
        ) : (
          <div className="flex min-w-[640px] flex-col items-center gap-0 py-4">
            {ascendentes.length > 0 && (<><div className="flex gap-6">{ascendentes.map((h) => <No key={h.id} nome={h.nome} papel={papelDe(h)} pre={h.situacao_vida === 'pre_morto'} notas={notasDe(h)} />)}</div><Linha /></>)}
            <div className="flex items-center gap-6">
              <No nome={f.falecido?.nome || 'Falecido (de cujus)'} papel="De cujus" raiz />
              {(temConjuge || conjugeHerdeiro.length > 0) && (<><span className="text-slate">+</span><No nome={f.conjuge?.nome || conjugeHerdeiro[0]?.nome || 'Cônjuge/companheiro(a)'} papel="Cônjuge / companheiro(a)" /></>)}
            </div>
            {filhos.length > 0 && (
              <>
                <Linha />
                <div className="flex gap-10 border-t border-ink/20 pt-0">
                  {filhos.map((h) => (
                    <div key={h.id} className="flex flex-col items-center">
                      <Linha />
                      <No nome={h.nome} papel={papelDe(h)} pre={h.situacao_vida === 'pre_morto'} notas={notasDe(h)} />
                      {netosDe(h.id).length > 0 && (<><Linha /><div className="flex gap-3">{netosDe(h.id).map((n) => <No key={n.id} nome={n.nome} papel="Neto(a)" notas={notasDe(n)} />)}</div></>)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {(outros.length > 0 || netosSoltos.length > 0) && (
        <Card className="mt-6" eyebrow="Sem posição definida na árvore" title="Outros interessados">
          <div className="flex flex-wrap gap-3">
            {[...outros, ...netosSoltos].map((h) => <No key={h.id} nome={h.nome} papel={papelDe(h)} pre={h.situacao_vida === 'pre_morto'} notas={notasDe(h)} />)}
          </div>
          {netosSoltos.length > 0 && <p className="mt-3 text-xs text-selo-warning">Neto(a) sem vínculo informado: indique de qual herdeiro descende na tela Herdeiros.</p>}
          <p className="mt-3 text-xs text-slate">Colaterais, legatários e demais interessados são listados sem ligação gráfica, porque a relação exata depende de análise jurídica.</p>
        </Card>
      )}

      <Card className="mt-6" title="Pontos de atenção sobre as relações">
        {alertas.length === 0 ? <p className="text-sm text-slate">Nenhum alerta sobre as relações informadas. Isso não significa que não existam outros herdeiros.</p> : (
          <ul className="space-y-3">{alertas.map((a) => (<li key={a.id} className="flex items-start gap-3 text-sm"><Selo estado={a.severidade} /><span className="text-ink">{a.mensagem}</span></li>))}</ul>
        )}
        <p className="mt-4 border-t border-ink/10 pt-3 text-xs text-slate">{MENSAGENS.C} Legenda: borda tracejada = herdeiro pré-morto.</p>
      </Card>
    </>
  )
}

export default function ArvoreGenealogica() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10"><CasoGuard>{(p) => <Conteudo {...p} />}</CasoGuard></main>
    </div>
  )
}
