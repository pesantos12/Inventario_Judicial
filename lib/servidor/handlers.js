// Handlers da API simulada (seção 11 da especificação). Cada rota em app/api/** apenas reexporta daqui,
// o que permite testá-los chamando as funções diretamente. NUNCA importar lib/casos-referencia (saída esperada).

import fs from 'node:fs'
import path from 'node:path'
import { HttpError, json, rota, corpoJson } from './http'
import { usuarioDe, exigir, USUARIOS, podeVerCaso } from './auth'
import { transacao, ler, dirUploads } from './db'
import { auditar, carimbo, carregarCaso, criarCaso, avaliarCaso, pendenciasDe, visao, exigirVersao, tocar, transicaoPendencia, transicaoProcesso } from './caso'
import { simularLeitura, statusAposLeitura, LEITURAS } from './ia'
import { validarArquivo, nomeSeguro, sha256 } from './upload'
import { DOC_TIPOS } from '../catalogo'
import { listarCasos, CASO_IDS } from '../casos'
import { MENSAGENS, PROCESSO_ORDEM, perfilPode } from '../estados'
import { REGRAS_VERSOES, versaoRotulo } from '../regras'

const agora = () => new Date().toISOString()
const SECOES = ['processo', 'advogado', 'requerente', 'falecido', 'sucessao', 'conjuge', 'herdeiros', 'bens', 'dividas', 'fase', 'tributo']
const ehObjeto = (x) => x && typeof x === 'object' && !Array.isArray(x)

function mesclar(base, patch) {
  const out = { ...base }
  for (const [k, v] of Object.entries(patch)) out[k] = ehObjeto(v) && ehObjeto(base?.[k]) ? mesclar(base[k], v) : v
  return out
}
const texto = (v, campo, min = 3) => {
  if (typeof v !== 'string' || v.trim().length < min) throw new HttpError(422, 'campo_invalido', `Informe ${campo}.`)
  return v.trim()
}

// ---------- Casos ----------
export const casesPOST = rota(async (req) => {
  const user = usuarioDe(req)
  exigir(user, 'editar')
  const b = await corpoJson(req)
  const caso = transacao((db) => criarCaso(db, user, { template_id: b.template_id, titulo: b.titulo }))
  return json(visao(caso), 201)
})

export const casesGET = rota(async (req) => {
  const user = usuarioDe(req)
  if (user.perfil === 'administrador') throw new HttpError(403, 'sem_acesso', 'O administrador não acessa dados de casos.')
  const db = ler()
  const lista = Object.values(db.casos).filter((c) => podeVerCaso(c, user)).map((c) => {
    const a = avaliarCaso(c)
    return { id: c.id, titulo: c.titulo, template_id: c.template_id, processo_estado: c.processo_estado.estado, rule_version: c.rule_version, version: c.version, atualizado_em: c.atualizado_em, resumo: a.resumo }
  })
  return json({ casos: lista })
})

export const caseGET = rota(async (req, { params }) => {
  const user = usuarioDe(req)
  const caso = transacao((db) => carregarCaso(db, params.id, user))
  return json(visao(caso))
})

export const casePATCH = rota(async (req, { params }) => {
  const user = usuarioDe(req)
  const b = await corpoJson(req)
  const resultado = transacao((db) => {
    const caso = carregarCaso(db, params.id, user)
    exigirVersao(caso, b.version)
    const reg = (evento, extra) => auditar(db, caso, user, evento, extra)
    switch (b.op) {
      case 'formulario': {
        exigir(user, 'editar')
        if (!ehObjeto(b.dados)) throw new HttpError(422, 'formato_invalido', 'Envie dados como objeto.')
        const desconhecidas = Object.keys(b.dados).filter((k) => !SECOES.includes(k))
        if (desconhecidas.length) throw new HttpError(422, 'secao_desconhecida', `Seções desconhecidas: ${desconhecidas.join(', ')}.`)
        for (const k of ['herdeiros', 'bens', 'dividas']) if (k in b.dados && !Array.isArray(b.dados[k])) throw new HttpError(422, 'formato_invalido', `${k} deve ser uma lista.`)
        const antes = Object.fromEntries(Object.keys(b.dados).map((k) => [k, caso.formulario[k] ?? null]))
        caso.formulario = mesclar(caso.formulario, b.dados)
        reg('formulario_alterado', { antes, depois: b.dados })
        break
      }
      case 'justificar': {
        exigir(user, 'justificar')
        const av = avaliarCaso(caso)
        const req_ = av.requirements.find((q) => q.id === b.requisito)
        if (!req_) throw new HttpError(422, 'requisito_invalido', 'Exigência não encontrada para este caso.')
        const t = texto(b.texto, 'a justificativa (mínimo 3 caracteres)')
        const antes = caso.justificativas[b.requisito] || null
        caso.justificativas[b.requisito] = { texto: t, autor: user.id, perfil: user.perfil, em: agora() }
        reg('justificativa_registrada', { antes, depois: caso.justificativas[b.requisito], motivo: t })
        break
      }
      case 'nao_aplicavel': {
        exigir(user, 'nao_aplicavel')
        const av = avaliarCaso(caso)
        if (!av.requirements.some((q) => q.id === b.requisito)) throw new HttpError(422, 'requisito_invalido', 'Exigência não encontrada para este caso.')
        const motivo = texto(b.motivo, 'o motivo (mínimo 3 caracteres)')
        const antes = caso.nao_aplicavel[b.requisito] || null
        caso.nao_aplicavel[b.requisito] = { motivo, autor: user.id, em: agora() }
        reg('exigencia_nao_aplicavel', { antes, depois: caso.nao_aplicavel[b.requisito], motivo })
        break
      }
      case 'pendencia': {
        const para = b.estado
        const dispensa = para === 'DISPENSADA_COM_MOTIVO'
        exigir(user, dispensa ? 'dispensar_pendencia' : 'editar')
        const pend = pendenciasDe(caso, avaliarCaso(caso)).find((p) => p.id === b.pendencia)
        if (!pend) throw new HttpError(404, 'pendencia_nao_encontrada', 'Pendência não encontrada.')
        const atual = pend.tratamento.estado
        transicaoPendencia(atual, para)
        const motivo = dispensa || para === 'RESOLVIDA' ? texto(b.motivo, 'o motivo da decisão') : b.motivo
        caso.pendencias_estado[b.pendencia] = carimbo(user, para, atual, { motivo, caso, source_document_id: b.source_document_id })
        reg('pendencia_estado', { antes: atual, depois: para, motivo, source_document_id: b.source_document_id })
        break
      }
      case 'estado': {
        const para = b.estado
        transicaoProcesso(caso.processo_estado.estado, para)
        if (para === 'PRONTO_PARA_REVISAO') exigir(user, 'editar')
        if (para === 'REVISADO') {
          exigir(user, 'revisar')
          if (!caso.revisoes.some((r) => r.decisao === 'aprovado' && r.caso_version >= 0)) throw new HttpError(409, 'revisao_necessaria', 'Registre a revisão do advogado (POST /reviews) antes de marcar como revisado.')
        }
        if (para === 'PROTOCOLO_EXTERNO_REGISTRADO') throw new HttpError(409, 'use_protocolo', 'O protocolo externo é registrado com op "protocolo".')
        if (['ACOMPANHAMENTO', 'ENCERRADO'].includes(para)) exigir(user, 'fase')
        const antes = caso.processo_estado.estado
        caso.processo_estado = carimbo(user, para, antes, { motivo: b.motivo, caso })
        reg('processo_estado', { antes, depois: para, motivo: b.motivo })
        break
      }
      case 'protocolo': {
        exigir(user, 'registrar_protocolo')
        if (caso.processo_estado.estado !== 'REVISADO') throw new HttpError(409, 'transicao_invalida', 'O protocolo só pode ser registrado após a revisão do advogado.')
        const numero = texto(b.numero_processo, 'o número do processo informado pelo advogado', 5)
        caso.protocolo = { numero_processo: numero, data: b.data || agora().slice(0, 10), autor: user.id, em: agora(), observacao: 'Protocolo realizado fora da plataforma; este registro é apenas informativo.' }
        caso.formulario.processo = { ...caso.formulario.processo, numero_processo: numero }
        const antes = caso.processo_estado.estado
        caso.processo_estado = carimbo(user, 'PROTOCOLO_EXTERNO_REGISTRADO', antes, { motivo: 'Protocolo externo registrado', caso })
        reg('protocolo_registrado', { antes, depois: caso.protocolo })
        break
      }
      case 'fase': {
        exigir(user, 'fase')
        if (!ehObjeto(b.dados)) throw new HttpError(422, 'formato_invalido', 'Envie dados como objeto.')
        const antes = caso.formulario.fase || {}
        caso.formulario.fase = mesclar(antes, b.dados)
        reg('fase_alterada', { antes, depois: b.dados })
        break
      }
      case 'regra_versao': {
        exigir(user, 'editar')
        const v = Number(b.versao)
        if (!REGRAS_VERSOES[v]) throw new HttpError(422, 'versao_invalida', 'Versão de regras desconhecida.')
        if (v > db.settings.regras_publicada) throw new HttpError(409, 'versao_nao_publicada', 'Esta versão de regras ainda não foi publicada pelo administrador.')
        const antes = caso.rule_version
        caso.rule_version = v
        reg('regra_versao_alterada', { antes: versaoRotulo(antes), depois: versaoRotulo(v), motivo: b.motivo })
        break
      }
      default:
        throw new HttpError(422, 'op_invalida', 'Operação desconhecida.')
    }
    tocar(caso)
    return caso
  })
  return json(visao(resultado))
})

// ---------- Documentos ----------
const docPublico = (d) => d

export const docsGET = rota(async (req, { params }) => {
  const user = usuarioDe(req)
  const caso = transacao((db) => carregarCaso(db, params.id, user))
  return json({ documentos: caso.documentos.map(docPublico) })
})

export const docsPOST = rota(async (req, { params }) => {
  const user = usuarioDe(req)
  exigir(user, 'anexar')
  let form
  try { form = await req.formData() } catch { throw new HttpError(422, 'formato_invalido', 'Envie o arquivo como multipart/form-data.') }
  const arquivo = form.get('file')
  const tipo = String(form.get('tipo') || '')
  if (!arquivo || typeof arquivo === 'string') throw new HttpError(422, 'arquivo_ausente', 'Nenhum arquivo enviado (campo "file").')
  if (!DOC_TIPOS[tipo]) throw new HttpError(422, 'tipo_invalido', `Tipo de documento desconhecido: ${tipo || '(vazio)'}.`)
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const nome = nomeSeguro(arquivo.name)
  const v = validarArquivo({ nome, mime: arquivo.type, buffer })

  const { doc, caso } = transacao((db) => {
    const caso = carregarCaso(db, params.id, user)
    db.seq += 1
    const id = `d-${String(db.seq).padStart(5, '0')}`
    const base = { id, tipo, nome, tamanho: buffer.length, hash: buffer.length ? sha256(buffer) : null, enviado_em: agora(), enviado_por: user.id, simulado: true }
    let doc
    if (!v.ok) {
      doc = { ...base, status: 'FALHA_TECNICA', motivo_tecnico: v.motivo, codigo_falha: v.codigo, legibilidade: null }
      doc.estado_info = carimbo(user, 'FALHA_TECNICA', null, { motivo: v.motivo, caso, source_document_id: id })
      auditar(db, caso, user, 'upload_falhou', { depois: { nome, codigo: v.codigo }, motivo: v.motivo, source_document_id: id })
    } else {
      const dir = path.join(dirUploads(), caso.id)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, id), buffer)
      doc = { ...base, status: 'ANEXADO', legibilidade: null }
      doc.estado_info = carimbo(user, 'ANEXADO', null, { caso, source_document_id: id })
      auditar(db, caso, user, 'documento_anexado', { depois: { nome, tipo, hash: doc.hash }, source_document_id: id })
    }
    caso.documentos.push(doc)
    tocar(caso)
    return { doc, caso }
  })
  if (!v.ok) return json({ erro: 'upload_invalido', mensagem: v.motivo, codigo: v.codigo, documento: doc, version: caso.version }, 422)
  return json({ documento: doc, version: caso.version }, 201)
})

export const docExtract = rota(async (req, { params }) => {
  const user = usuarioDe(req)
  exigir(user, 'anexar')
  const b = await corpoJson(req)
  const leitura = b.leitura || 'legivel'
  if (!LEITURAS[leitura]) throw new HttpError(422, 'leitura_invalida', `Perfil de leitura desconhecido: ${leitura}.`)
  const out = transacao((db) => {
    const caso = carregarCaso(db, params.id, user)
    const doc = caso.documentos.find((d) => d.id === params.docId)
    if (!doc) throw new HttpError(404, 'documento_nao_encontrado', 'Documento não encontrado.')
    if (doc.status === 'FALHA_TECNICA') throw new HttpError(409, 'documento_com_falha', 'Documento com falha técnica; envie um novo arquivo.')
    if (!db.settings.ia_disponivel) {
      auditar(db, caso, user, 'ia_indisponivel', { motivo: 'Leitura automática indisponível', source_document_id: doc.id })
      throw Object.assign(new HttpError(503, 'ia_indisponivel', 'A leitura automática está indisponível. O formulário e o checklist continuam funcionando; você pode tentar novamente mais tarde ou revisar o documento manualmente.'), { persistir: true })
    }
    const antes = doc.status
    Object.assign(doc, simularLeitura({ tipo: doc.tipo, leitura, formulario: caso.formulario }))
    delete doc.modelo
    doc.tipo_declarado = doc.tipo
    doc.status = statusAposLeitura(doc, caso.formulario)
    doc.estado_info = carimbo(user, doc.status, antes, { caso, source_document_id: doc.id, motivo: `Leitura simulada (${leitura})` })
    auditar(db, caso, user, 'documento_lido_simulado', { antes, depois: doc.status, motivo: `Leitura simulada: ${LEITURAS[leitura]}`, source_document_id: doc.id })
    tocar(caso)
    return { documento: doc, version: caso.version, aviso: MENSAGENS.D }
  })
  return json(out)
})

export const docPATCH = rota(async (req, { params }) => {
  const user = usuarioDe(req)
  const b = await corpoJson(req)
  const out = transacao((db) => {
    const caso = carregarCaso(db, params.id, user)
    exigirVersao(caso, b.version)
    const doc = caso.documentos.find((d) => d.id === params.docId)
    if (!doc) throw new HttpError(404, 'documento_nao_encontrado', 'Documento não encontrado.')
    const antes = doc.status
    if (b.tipo !== undefined) {
      exigir(user, 'anexar')
      if (!DOC_TIPOS[b.tipo]) throw new HttpError(422, 'tipo_invalido', 'Tipo de documento desconhecido.')
      const t0 = doc.tipo
      doc.tipo = b.tipo
      auditar(db, caso, user, 'documento_tipo_corrigido', { antes: t0, depois: b.tipo, source_document_id: doc.id })
    }
    if (b.estado !== undefined) {
      exigir(user, 'aceitar_documento')
      if (!['REVISADO', 'ACEITO_PARA_ORGANIZACAO'].includes(b.estado)) throw new HttpError(422, 'estado_invalido', 'Estado de destino inválido para o documento.')
      if (!['CLASSIFICADO', 'DIVERGENTE', 'EM_ANALISE', 'REVISADO'].includes(doc.status)) throw new HttpError(409, 'transicao_invalida', `Transição inválida: ${doc.status} → ${b.estado}.`)
      const motivo = texto(b.motivo, 'o motivo da decisão')
      doc.status = b.estado
      if (doc.quarentena) doc.quarentena = false
      doc.estado_info = carimbo(user, b.estado, antes, { motivo, caso, source_document_id: doc.id })
      auditar(db, caso, user, 'documento_estado', { antes, depois: b.estado, motivo, source_document_id: doc.id })
    }
    if (b.tipo === undefined && b.estado === undefined) throw new HttpError(422, 'op_invalida', 'Nada a alterar.')
    tocar(caso)
    return { documento: doc, version: caso.version }
  })
  return json(out)
})

// ---------- Avaliação ----------
export const reqsGET = rota(async (req, { params }) => {
  const user = usuarioDe(req)
  const caso = transacao((db) => carregarCaso(db, params.id, user))
  const a = avaliarCaso(caso)
  return json({ requirements: a.requirements, resumo: a.resumo, rule_version: a.rule_version, evaluation_version: a.evaluation_version })
})

export const alertsGET = rota(async (req, { params }) => {
  const user = usuarioDe(req)
  const caso = transacao((db) => carregarCaso(db, params.id, user))
  const a = avaliarCaso(caso)
  return json({ alerts: a.alerts.map((x) => ({ ...x, tratamento: caso.pendencias_estado[x.id] || null })), aviso: MENSAGENS.C })
})

export const evaluatePOST = rota(async (req, { params }) => {
  const user = usuarioDe(req)
  const out = transacao((db) => {
    const caso = carregarCaso(db, params.id, user)
    const a = avaliarCaso(caso)
    const ultimo = caso.historico_avaliacoes.at(-1)
    const chave = JSON.stringify({ r: a.requirements, al: a.alerts, rv: a.rule_version })
    if (!ultimo || ultimo.chave !== chave) {
      caso.historico_avaliacoes.push({ n: caso.historico_avaliacoes.length + 1, em: agora(), actor_id: user.id, rule_version: a.rule_version, resumo: a.resumo, chave, avaliacao: a })
      auditar(db, caso, user, 'avaliacao_registrada', { depois: a.resumo })
    }
    return { avaliacao: a, pendencias: pendenciasDe(caso, a), snapshots: caso.historico_avaliacoes.length }
  })
  return json(out)
})

// ---------- Revisão / relatório / auditoria ----------
export const reviewsPOST = rota(async (req, { params }) => {
  const user = usuarioDe(req)
  exigir(user, 'revisar', 'Apenas advogado(a) pode registrar a revisão.')
  const b = await corpoJson(req)
  if (!['aprovado', 'ajustes'].includes(b.decisao)) throw new HttpError(422, 'decisao_invalida', 'decisao deve ser "aprovado" ou "ajustes".')
  const out = transacao((db) => {
    const caso = carregarCaso(db, params.id, user)
    const a = avaliarCaso(caso)
    const abertas = pendenciasDe(caso, a).filter((p) => !['RESOLVIDA', 'DISPENSADA_COM_MOTIVO'].includes(p.tratamento.estado))
    const urgentes = a.alerts.filter((x) => x.severidade === 'REVISAO_URGENTE' && !['RESOLVIDA', 'DISPENSADA_COM_MOTIVO'].includes(caso.pendencias_estado[x.id]?.estado)).map((x) => x.id)
    const rev = { id: `rev-${caso.revisoes.length + 1}`, em: agora(), advogado_id: user.id, decisao: b.decisao, observacoes: b.observacoes || '', caso_version: caso.version, rule_version: caso.rule_version, pendencias_abertas: abertas.length, alertas_urgentes_abertos: urgentes, aviso: 'Revisão registrada pelo advogado; a plataforma não atesta validade ou suficiência da petição.' }
    caso.revisoes.push(rev)
    auditar(db, caso, user, 'revisao_registrada', { depois: rev, motivo: b.observacoes })
    if (b.decisao === 'aprovado' && caso.processo_estado.estado === 'PRONTO_PARA_REVISAO') {
      const antes = caso.processo_estado.estado
      caso.processo_estado = carimbo(user, 'REVISADO', antes, { motivo: 'Revisão do advogado', caso })
      auditar(db, caso, user, 'processo_estado', { antes, depois: 'REVISADO' })
    }
    tocar(caso)
    return { revisao: rev, processo_estado: caso.processo_estado.estado, version: caso.version }
  })
  return json(out, 201)
})

export const reviewsGET = rota(async (req, { params }) => {
  const user = usuarioDe(req)
  const caso = transacao((db) => carregarCaso(db, params.id, user))
  return json({ revisoes: caso.revisoes })
})

export const reportGET = rota(async (req, { params }) => {
  const user = usuarioDe(req)
  exigir(user, 'exportar', 'Apenas advogado(a) pode gerar o relatório de organização.')
  const out = transacao((db) => {
    const caso = carregarCaso(db, params.id, user)
    const a = avaliarCaso(caso)
    auditar(db, caso, user, 'relatorio_gerado')
    return {
      titulo: 'Relatório de organização para minuta de petição inicial de inventário judicial',
      natureza: 'Rascunho de apoio à revisão do advogado. Não é peça processual e não afirma validade, suficiência ou conformidade.',
      aviso: MENSAGENS.D,
      gerado_em: agora(),
      caso: { id: caso.id, titulo: caso.titulo, processo_estado: caso.processo_estado.estado, rule_version: caso.rule_version },
      formulario: caso.formulario,
      exigencias: a.requirements,
      alertas: a.alerts,
      pendencias: pendenciasDe(caso, a),
      documentos: caso.documentos.map((d) => ({ id: d.id, tipo: d.tipo, nome: d.nome, status: d.status, simulado: !!d.simulado })),
      revisoes: caso.revisoes,
      protocolo: caso.protocolo,
      resumo: a.resumo,
    }
  })
  return json(out)
})

export const auditGET = rota(async (req, { params }) => {
  const user = usuarioDe(req)
  const caso = transacao((db) => carregarCaso(db, params.id, user))
  return json({ eventos: caso.auditoria })
})

// ---------- Configurações (administrador) ----------
export const settingsGET = rota(async (req) => {
  usuarioDe(req)
  const { settings } = ler()
  return json({ ...settings, versoes: REGRAS_VERSOES })
})

export const settingsPUT = rota(async (req) => {
  const user = usuarioDe(req)
  exigir(user, 'regras', 'Apenas o administrador altera configurações.')
  const b = await corpoJson(req)
  const out = transacao((db) => {
    const s = db.settings
    const antes = { ia_disponivel: s.ia_disponivel, regras_publicada: s.regras_publicada }
    if (b.ia_disponivel !== undefined) {
      if (typeof b.ia_disponivel !== 'boolean') throw new HttpError(422, 'formato_invalido', 'ia_disponivel deve ser verdadeiro ou falso.')
      s.ia_disponivel = b.ia_disponivel
    }
    if (b.regras_publicada !== undefined) {
      if (!REGRAS_VERSOES[b.regras_publicada]) throw new HttpError(422, 'versao_invalida', 'Versão de regras desconhecida.')
      s.regras_publicada = b.regras_publicada
    }
    s.historico.push({ em: agora(), actor_id: user.id, antes, depois: { ia_disponivel: s.ia_disponivel, regras_publicada: s.regras_publicada } })
    auditar(db, null, user, 'configuracao_alterada', { antes, depois: { ia_disponivel: s.ia_disponivel, regras_publicada: s.regras_publicada } })
    return s
  })
  return json({ ...out, versoes: REGRAS_VERSOES })
})

// ---------- Casos de teste e avaliação da IA ----------
export const templatesGET = rota(async (req) => {
  usuarioDe(req)
  return json({ casos: listarCasos(), leituras: LEITURAS })
})

export const RUBRICA = ['alertas_corretos', 'alertas_faltantes', 'alertas_indevidos', 'linguagem_segura', 'observacoes']
const COLUNAS = ['caso_id', 'avaliador_id', 'rule_version', 'alertas_corretos', 'alertas_faltantes', 'alertas_indevidos', 'linguagem_segura', 'falha_critica', 'observacoes', 'registrado_em']
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

export const avaliacoesPOST = rota(async (req) => {
  const user = usuarioDe(req)
  exigir(user, 'revisar', 'Apenas advogado(a) registra a avaliação de um caso de teste.')
  const b = await corpoJson(req)
  if (!CASO_IDS.includes(b.caso_id)) throw new HttpError(422, 'caso_invalido', 'Caso de teste desconhecido.')
  for (const k of ['alertas_corretos', 'alertas_faltantes', 'alertas_indevidos']) if (!Number.isInteger(b[k]) || b[k] < 0) throw new HttpError(422, 'campo_invalido', `${k} deve ser inteiro ≥ 0.`)
  if (!['sim', 'nao'].includes(b.linguagem_segura)) throw new HttpError(422, 'campo_invalido', 'linguagem_segura deve ser "sim" ou "nao".')
  if (!['sim', 'nao'].includes(b.falha_critica)) throw new HttpError(422, 'campo_invalido', 'falha_critica deve ser "sim" ou "nao".')
  const reg = transacao((db) => {
    const r = { ...Object.fromEntries(COLUNAS.map((c) => [c, null])), caso_id: b.caso_id, avaliador_id: user.id, rule_version: db.settings.regras_publicada, alertas_corretos: b.alertas_corretos, alertas_faltantes: b.alertas_faltantes, alertas_indevidos: b.alertas_indevidos, linguagem_segura: b.linguagem_segura, falha_critica: b.falha_critica, observacoes: String(b.observacoes || '').slice(0, 2000), registrado_em: agora() }
    db.avaliacoes.push(r)
    return r
  })
  return json(reg, 201)
})

export const avaliacoesGET = rota(async (req) => {
  const user = usuarioDe(req)
  exigir(user, 'revisar')
  const db = ler()
  const lista = db.avaliacoes.filter((a) => a.avaliador_id === user.id)
  if (new URL(req.url).searchParams.get('formato') === 'csv') {
    const linhas = [COLUNAS.join(','), ...lista.map((a) => COLUNAS.map((c) => csv(a[c])).join(','))]
    return new Response('﻿' + linhas.join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="avaliacoes.csv"' } })
  }
  return json({ avaliacoes: lista })
})

export const usuariosGET = rota(async () => json({ usuarios: Object.values(USUARIOS) }))
