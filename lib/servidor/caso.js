// Serviço de domínio do caso: criação, visão (caso + avaliação + pendências), auditoria e transições de estado.
// Nenhuma função aqui decide mérito jurídico: o motor de regras (lib/regras.js) apenas sinaliza; humanos decidem.

import { HttpError } from './http'
import { podeVerCaso } from './auth'
import { avaliar, derivarPendencias } from '../regras'
import { montarFormulario, montarDocumentos, existeCaso, metadadosDe } from '../casos'
import { PROCESSO_ORDEM, PENDENCIA_ORDEM } from '../estados'

const agora = () => new Date().toISOString()

export function auditar(db, caso, user, evento, { antes, depois, motivo, source_document_id } = {}) {
  db.seq += 1
  const reg = {
    id: `ev-${db.seq}`,
    em: agora(),
    caso_id: caso?.id || null,
    actor_id: user?.id || null,
    perfil: user?.perfil || null,
    evento,
    antes: antes ?? null,
    depois: depois ?? null,
    motivo: motivo || null,
    rule_version: caso?.rule_version ?? null,
    source_document_id: source_document_id || null,
  }
  if (caso) caso.auditoria.push(reg)
  return reg
}

/** Estado "rastreável" (seção 7): todo estado guarda quem, quando, por quê e o estado anterior. */
export const carimbo = (user, estado, anterior, { motivo, caso, source_document_id } = {}) => ({
  estado,
  updated_at: agora(),
  actor_id: user.id,
  reason: motivo || null,
  rule_version: caso?.rule_version ?? null,
  source_document_id: source_document_id || null,
  previous_state: anterior ?? null,
})

export function carregarCaso(db, id, user) {
  const caso = db.casos[id]
  if (!caso) throw new HttpError(404, 'nao_encontrado', 'Caso não encontrado.')
  if (!podeVerCaso(caso, user)) {
    db.seq += 1
    db.seguranca.push({ id: `sec-${db.seq}`, em: agora(), evento: 'acesso_negado', caso_id: id, actor_id: user.id, perfil: user.perfil })
    const e = new HttpError(403, 'sem_acesso', 'Você não tem acesso a este caso.')
    e.persistir = true
    throw e
  }
  return caso
}

export function criarCaso(db, user, { template_id, titulo } = {}) {
  const hoje = agora().slice(0, 10)
  let formulario
  let documentos = []
  if (template_id) {
    if (!existeCaso(template_id)) throw new HttpError(422, 'template_invalido', `Caso de teste desconhecido: ${template_id}.`)
    formulario = montarFormulario(template_id, { hoje })
    documentos = montarDocumentos(template_id, formulario, { hoje })
  } else {
    formulario = { processo: {}, falecido: {}, requerente: {}, sucessao: {}, conjuge: {}, herdeiros: [], bens: [], dividas: [], fase: {}, tributo: {} }
  }
  db.seq += 1
  const id = `c-${String(db.seq).padStart(4, '0')}`
  const caso = {
    id,
    owner: user.id,
    escritorio: user.escritorio,
    compartilhado_com: [],
    template_id: template_id || null,
    titulo: titulo || (template_id ? `Caso de teste ${template_id}` : 'Novo inventário judicial'),
    version: 1,
    rule_version: db.settings.regras_publicada || 1,
    processo_estado: carimbo(user, 'RASCUNHO', null),
    formulario,
    documentos: documentos.map((d) => ({ ...d, estado_info: carimbo(user, d.status, null, { source_document_id: d.id }) })),
    justificativas: {},
    nao_aplicavel: {},
    pendencias_estado: {},
    revisoes: [],
    protocolo: null,
    historico_avaliacoes: [],
    auditoria: [],
    criado_em: agora(),
    atualizado_em: agora(),
  }
  db.casos[id] = caso
  auditar(db, caso, user, 'caso_criado', { depois: { template_id: template_id || null } })
  return caso
}

export function avaliarCaso(caso, hoje) {
  return avaliar({
    formulario: caso.formulario,
    documentos: caso.documentos,
    justificativas: caso.justificativas,
    nao_aplicavel: caso.nao_aplicavel,
    rule_version: caso.rule_version,
    hoje: hoje || undefined,
  })
}

/** Pendências derivadas + estado de tratamento registrado. Itens tratados que deixaram de ser exigidos aparecem como resolvidos automaticamente. */
export function pendenciasDe(caso, avaliacao) {
  const derivadas = derivarPendencias(avaliacao)
  const ids = new Set(derivadas.map((p) => p.id))
  const lista = derivadas.map((p) => ({ ...p, tratamento: caso.pendencias_estado[p.id] || carimbo({ id: null }, 'ABERTA', null), }))
  Object.entries(caso.pendencias_estado).forEach(([pid, st]) => {
    if (!ids.has(pid) && !['RESOLVIDA', 'DISPENSADA_COM_MOTIVO'].includes(st.estado)) {
      lista.push({ id: pid, origem: 'historico', titulo: pid, severidade: 'INFORMATIVO', tratamento: { ...st, estado: 'RESOLVIDA', reason: st.reason || 'Condição deixou de existir após reavaliação.' } })
    }
  })
  return lista
}

export function visao(caso) {
  const avaliacao = avaliarCaso(caso)
  const { auditoria, historico_avaliacoes, ...resto } = caso
  return {
    ...resto,
    metadados: caso.template_id ? metadadosDe(caso.template_id) : null,
    avaliacao,
    pendencias: pendenciasDe(caso, avaliacao),
    n_eventos_auditoria: auditoria.length,
    n_avaliacoes: historico_avaliacoes.length,
  }
}

export function exigirVersao(caso, version) {
  if (typeof version !== 'number') throw new HttpError(422, 'version_obrigatoria', 'Informe a versão do caso (campo version) para salvar.')
  if (version !== caso.version) throw new HttpError(409, 'conflito_versao', 'O caso foi alterado por outra pessoa ou aba. Recarregue antes de salvar.', { versao_atual: caso.version })
}

export function tocar(caso) {
  caso.version += 1
  caso.atualizado_em = agora()
}

export function transicaoPendencia(de, para) {
  const i = PENDENCIA_ORDEM.indexOf(de)
  const j = PENDENCIA_ORDEM.indexOf(para)
  if (j < 0) throw new HttpError(422, 'estado_invalido', `Estado de pendência desconhecido: ${para}.`)
  const final = (s) => s === 'RESOLVIDA' || s === 'DISPENSADA_COM_MOTIVO'
  if (final(de)) throw new HttpError(409, 'transicao_invalida', 'Pendência já encerrada; o histórico é preservado e não pode ser reaberto por esta via.')
  if (!final(para) && j <= i) throw new HttpError(409, 'transicao_invalida', `Transição inválida: ${de} → ${para}.`)
}

export function transicaoProcesso(de, para) {
  const i = PROCESSO_ORDEM.indexOf(de)
  const j = PROCESSO_ORDEM.indexOf(para)
  if (j < 0) throw new HttpError(422, 'estado_invalido', `Estado de processo desconhecido: ${para}.`)
  const ok = j === i + 1 || (de === 'PRONTO_PARA_REVISAO' && para === 'RASCUNHO')
  if (!ok) throw new HttpError(409, 'transicao_invalida', `Transição inválida: ${de} → ${para}.`)
}
