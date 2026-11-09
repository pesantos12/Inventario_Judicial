import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import handlers from '../lib/servidor/handlers'

process.env.INVENTARIO_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-api-'))
const H = handlers

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n')
const chama = async (fn, { user = 'u-ana', method = 'GET', body, params = {}, form, url = 'http://x/api' } = {}) => {
  const headers = {}
  if (user) headers['x-user-id'] = user
  let init = { method, headers }
  if (form) init.body = form
  else if (body !== undefined) { init.body = JSON.stringify(body); headers['content-type'] = 'application/json' }
  const res = await fn(new Request(url, init), { params })
  const ct = res.headers.get('content-type') || ''
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text(), res }
}
const criar = async (template_id, user = 'u-ana') => (await chama(H.casesPOST, { user, method: 'POST', body: { template_id } })).data
const patch = (c, body, user = 'u-ana') => chama(H.casePATCH, { user, method: 'PATCH', params: { id: c.id }, body: { version: c.version, ...body } })
const upload = (c, { nome = 'a.pdf', tipo = 'certidao_obito', buf = PDF, mime = 'application/pdf', user = 'u-ana' } = {}) => {
  const form = new FormData()
  form.set('file', new File([buf], nome, { type: mime }))
  form.set('tipo', tipo)
  return chama(H.docsPOST, { user, method: 'POST', params: { id: c.id }, form })
}
const get = async (c, user = 'u-ana') => (await chama(H.caseGET, { user, params: { id: c.id } })).data

test('sem identificação → 401; criar caso de teste desconhecido → 422', async () => {
  assert.equal((await chama(H.casesGET, { user: null })).status, 401)
  assert.equal((await chama(H.casesPOST, { method: 'POST', body: { template_id: 'XX-Z' } })).status, 422)
})

test('cria caso a partir de template, sem vazar saída esperada, e persiste em disco', async () => {
  const c = await criar('01-A')
  assert.match(c.id, /^c-/)
  assert.equal(c.processo_estado.estado, 'RASCUNHO')
  assert.ok(c.avaliacao.requirements.length > 0)
  const txt = JSON.stringify(c)
  assert.ok(!/falha_critica|saida_esperada|esperado/i.test(txt))
  assert.ok(fs.existsSync(path.join(process.env.INVENTARIO_DATA_DIR, 'db.json')))
})

test('T16: outro advogado → 403 + evento de segurança; administrador não acessa caso', async () => {
  const c = await criar('01-A')
  assert.equal((await chama(H.caseGET, { user: 'u-rafael', params: { id: c.id } })).status, 403)
  assert.equal((await chama(H.caseGET, { user: 'u-admin', params: { id: c.id } })).status, 403)
  assert.equal((await chama(H.casesGET, { user: 'u-admin' })).status, 403)
  const { seguranca } = JSON.parse(fs.readFileSync(path.join(process.env.INVENTARIO_DATA_DIR, 'db.json'), 'utf8'))
  assert.ok(seguranca.filter((s) => s.caso_id === c.id).length >= 2)
  assert.equal((await chama(H.caseGET, { params: { id: 'c-9999' } })).status, 404)
  const lista = (await chama(H.casesGET, { user: 'u-rafael' })).data.casos
  assert.ok(!lista.some((x) => x.id === c.id))
})

test('perfis: assistente não revisa, não exporta, não dispensa pendência; administrador só configura', async () => {
  const c = await criar('01-A')
  assert.equal((await chama(H.reviewsPOST, { user: 'u-carla', method: 'POST', params: { id: c.id }, body: { decisao: 'aprovado' } })).status, 403)
  assert.equal((await chama(H.reportGET, { user: 'u-carla', params: { id: c.id } })).status, 403)
  assert.equal((await chama(H.settingsPUT, { user: 'u-ana', method: 'PUT', body: { ia_disponivel: false } })).status, 403)
  assert.equal((await chama(H.settingsPUT, { user: 'u-carla', method: 'PUT', body: { ia_disponivel: false } })).status, 403)
})

test('conflito de versão → 409; sem version → 422; versão avança', async () => {
  const c = await criar('01-A')
  const a = await patch(c, { op: 'formulario', dados: { processo: { comarca_uf: 'Belo Horizonte/MG' } } })
  assert.equal(a.status, 200)
  assert.equal(a.data.version, c.version + 1)
  assert.equal(a.data.formulario.processo.comarca_uf, 'Belo Horizonte/MG')
  const velho = await patch(c, { op: 'formulario', dados: { processo: { juizo: 'x' } } })
  assert.equal(velho.status, 409)
  assert.equal(velho.data.versao_atual, a.data.version)
  const sem = await chama(H.casePATCH, { method: 'PATCH', params: { id: c.id }, body: { op: 'formulario', dados: {} } })
  assert.equal(sem.status, 422)
})

test('formato inválido → 422 (seção desconhecida, lista errada, JSON quebrado, op desconhecida)', async () => {
  const c = await criar('01-A')
  assert.equal((await patch(c, { op: 'formulario', dados: { xpto: 1 } })).status, 422)
  assert.equal((await patch(c, { op: 'formulario', dados: { herdeiros: 'x' } })).status, 422)
  assert.equal((await patch(c, { op: 'zzz' })).status, 422)
  const r = await H.casePATCH(new Request('http://x', { method: 'PATCH', headers: { 'x-user-id': 'u-ana' }, body: '{quebrado' }), { params: { id: c.id } })
  assert.equal(r.status, 422)
})

test('justificar / não aplicável: exigem requisito válido e motivo; assistente justifica mas não marca não aplicável', async () => {
  let c = await criar('01-A')
  const alvo = c.avaliacao.requirements.find((q) => q.applicable === 'aplicavel' && q.status === 'PENDENTE')
  assert.ok(alvo, 'precisa existir exigência pendente')
  assert.equal((await patch(c, { op: 'justificar', requisito: 'REQ-nao-existe', texto: 'abc' })).status, 422)
  assert.equal((await patch(c, { op: 'justificar', requisito: alvo.id, texto: ' ' })).status, 422)
  const j = await patch(c, { op: 'justificar', requisito: alvo.id, texto: 'Cliente buscará o documento' }, 'u-ana')
  assert.equal(j.status, 200)
  const q = j.data.avaliacao.requirements.find((x) => x.id === alvo.id)
  assert.equal(q.status, 'PENDENTE', 'justificar não torna o documento presente')
  assert.equal(q.justificada, true)
  c = j.data
  assert.equal((await patch(c, { op: 'nao_aplicavel', requisito: alvo.id, motivo: 'não cabe' }, 'u-carla')).status, 403)
  const na = await patch(c, { op: 'nao_aplicavel', requisito: alvo.id, motivo: 'Não se aplica ao caso' })
  assert.equal(na.status, 200)
  assert.equal(na.data.avaliacao.requirements.find((x) => x.id === alvo.id).status, 'NAO_APLICAVEL')
})

test('T10: upload válido, tipo não permitido, arquivo corrompido, vazio e grande demais', async () => {
  const c = await criar('01-A')
  const ok = await upload(c)
  assert.equal(ok.status, 201)
  assert.equal(ok.data.documento.status, 'ANEXADO')
  assert.ok(fs.existsSync(path.join(process.env.INVENTARIO_DATA_DIR, 'uploads', c.id, ok.data.documento.id)))
  const exe = await upload(c, { nome: 'virus.exe', buf: Buffer.from('MZ....'), mime: 'application/octet-stream' })
  assert.equal(exe.status, 422)
  assert.equal(exe.data.codigo, 'tipo_nao_permitido')
  const corr = await upload(c, { nome: 'falso.pdf', buf: Buffer.from('isto não é pdf') })
  assert.equal(corr.status, 422)
  assert.equal(corr.data.codigo, 'arquivo_corrompido')
  assert.equal(corr.data.documento.status, 'FALHA_TECNICA')
  assert.equal((await upload(c, { buf: Buffer.alloc(0) })).data.codigo, 'vazio')
  const grande = await upload(c, { buf: Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]) })
  assert.equal(grande.data.codigo, 'tamanho')
  assert.equal((await upload(c, { tipo: 'inexistente' })).status, 422)
  const atual = await get(c)
  assert.ok(atual.documentos.filter((d) => d.status === 'FALHA_TECNICA').length >= 3, 'falhas ficam registradas, sem exclusão silenciosa')
  const aud = (await chama(H.auditGET, { params: { id: c.id } })).data.eventos
  assert.ok(aud.some((e) => e.evento === 'upload_falhou'))
})

test('nome de arquivo malicioso é sanitizado', async () => {
  const c = await criar('01-A')
  const r = await upload(c, { nome: '../../etc/passwd.pdf' })
  assert.equal(r.status, 201)
  assert.ok(!r.data.documento.nome.includes('/'))
})

test('T08/T09: leitura simulada — legível classifica; CPF divergente → DIVERGENTE; conteúdo outro; baixa legibilidade; terceiro em quarentena', async () => {
  const c = await criar('01-A')
  const ler_ = async (leitura, tipo = 'certidao_obito') => {
    const d = (await upload(c, { tipo })).data.documento
    const r = await chama(H.docExtract, { method: 'POST', params: { id: c.id, docId: d.id }, body: { leitura } })
    assert.equal(r.status, 200)
    assert.equal(r.data.documento.simulado, true)
    return r.data.documento
  }
  assert.equal((await ler_('legivel')).status, 'CLASSIFICADO')
  assert.equal((await ler_('cpf_divergente')).status, 'DIVERGENTE')
  assert.equal((await ler_('baixa_legibilidade')).legibilidade, 'baixa')
  const outro = await ler_('conteudo_outro')
  assert.notEqual(outro.tipo_classificado, outro.tipo_declarado)
  const terc = await ler_('documento_terceiro')
  assert.equal(terc.quarentena, true)
  assert.notEqual(terc.status, 'CLASSIFICADO')
  assert.equal((await chama(H.docExtract, { method: 'POST', params: { id: c.id, docId: outro.id }, body: { leitura: 'xx' } })).status, 422)
  const v = await get(c)
  assert.ok(v.avaliacao.alerts.length >= 0)
})

test('T15: IA indisponível → 503 na extração, formulário/checklist seguem funcionando; admin reativa', async () => {
  const c = await criar('01-A')
  const d = (await upload(c)).data.documento
  assert.equal((await chama(H.settingsPUT, { user: 'u-admin', method: 'PUT', body: { ia_disponivel: false } })).status, 200)
  const r = await chama(H.docExtract, { method: 'POST', params: { id: c.id, docId: d.id }, body: {} })
  assert.equal(r.status, 503)
  assert.equal(r.data.erro, 'ia_indisponivel')
  assert.equal((await chama(H.reqsGET, { params: { id: c.id } })).status, 200)
  const c2 = await get(c)
  assert.equal((await patch(c2, { op: 'formulario', dados: { processo: { juizo: '1ª Vara' } } })).status, 200)
  await chama(H.settingsPUT, { user: 'u-admin', method: 'PUT', body: { ia_disponivel: true } })
  assert.equal((await chama(H.docExtract, { method: 'POST', params: { id: c.id, docId: d.id }, body: {} })).status, 200)
})

test('estado do documento: só advogado aceita, com motivo; quarentena sai só por decisão humana', async () => {
  const c = await criar('01-A')
  const d = (await upload(c)).data.documento
  await chama(H.docExtract, { method: 'POST', params: { id: c.id, docId: d.id }, body: { leitura: 'cpf_divergente' } })
  let cur = await get(c)
  const pt = (body, user = 'u-ana') => chama(H.docPATCH, { user, method: 'PATCH', params: { id: c.id, docId: d.id }, body: { version: cur.version, ...body } })
  assert.equal((await pt({ estado: 'REVISADO', motivo: 'ok' }, 'u-carla')).status, 403)
  assert.equal((await pt({ estado: 'REVISADO' })).status, 422)
  assert.equal((await pt({ estado: 'ANEXADO', motivo: 'xx' })).status, 422)
  const ok = await pt({ estado: 'REVISADO', motivo: 'Conferido manualmente com o original' })
  assert.equal(ok.status, 200)
  assert.equal(ok.data.documento.estado_info.previous_state, 'DIVERGENTE')
  assert.equal(ok.data.documento.estado_info.actor_id, 'u-ana')
})

test('pendências: transições válidas, dispensa exige advogado+motivo, estado final não reabre, carimbo completo', async () => {
  let c = await criar('01-A')
  const p = c.pendencias[0]
  assert.ok(p)
  assert.equal(p.tratamento.estado, 'ABERTA')
  const pat = async (estado, extra = {}, user = 'u-ana') => { const r = await patch(c, { op: 'pendencia', pendencia: p.id, estado, ...extra }, user); if (r.status === 200) c = r.data; return r }
  assert.equal((await pat('ABERTA')).status, 409)
  assert.equal((await pat('ATRIBUIDA')).status, 200)
  assert.equal((await pat('DISPENSADA_COM_MOTIVO', { motivo: 'x' }, 'u-carla')).status, 403)
  assert.equal((await pat('DISPENSADA_COM_MOTIVO')).status, 422)
  assert.equal((await pat('XPTO')).status, 422)
  const fim = await pat('DISPENSADA_COM_MOTIVO', { motivo: 'Dispensado por decisão do advogado responsável' })
  assert.equal(fim.status, 200)
  const t = fim.data.pendencias.find((x) => x.id === p.id).tratamento
  assert.equal(t.estado, 'DISPENSADA_COM_MOTIVO')
  assert.equal(t.previous_state, 'ATRIBUIDA')
  for (const k of ['updated_at', 'actor_id', 'reason', 'rule_version', 'source_document_id']) assert.ok(k in t, k)
  assert.equal((await pat('EM_TRATAMENTO')).status, 409)
})

test('processo: fluxo RASCUNHO→…→PROTOCOLO só com revisão; nunca bloqueia por pendências; pulo → 409; assistente não revisa', async () => {
  let c = await criar('01-A')
  assert.ok(c.pendencias.length > 0)
  const est = async (estado, user = 'u-ana') => { const r = await patch(c, { op: 'estado', estado }, user); if (r.status === 200) c = r.data; return r }
  assert.equal((await est('REVISADO')).status, 409)
  assert.equal((await est('PRONTO_PARA_REVISAO', 'u-carla')).status, 200, 'rascunho nunca é bloqueado por pendências')
  assert.equal((await est('REVISADO')).status, 409, 'sem revisão registrada')
  assert.equal((await patch(c, { op: 'protocolo', numero_processo: '1234567-89.2026.8.13.0024' })).status, 409)
  const rv = await chama(H.reviewsPOST, { method: 'POST', params: { id: c.id }, body: { decisao: 'aprovado', observacoes: 'ok' } })
  assert.equal(rv.status, 201)
  assert.equal(rv.data.processo_estado, 'REVISADO')
  c = await get(c)
  assert.equal((await patch(c, { op: 'protocolo', numero_processo: '123' }, 'u-carla')).status, 403)
  assert.equal((await patch(c, { op: 'protocolo', numero_processo: '12' })).status, 422)
  const pr = await patch(c, { op: 'protocolo', numero_processo: '1234567-89.2026.8.13.0024' })
  assert.equal(pr.status, 200)
  assert.equal(pr.data.processo_estado.estado, 'PROTOCOLO_EXTERNO_REGISTRADO')
  assert.match(pr.data.protocolo.observacao, /fora da plataforma/)
})

test('T17/T18: avaliação idempotente (snapshot só muda se muda o resultado); reavaliação após mudança; versão de regras', async () => {
  let c = await criar('01-A')
  const a1 = await chama(H.evaluatePOST, { method: 'POST', params: { id: c.id } })
  const a2 = await chama(H.evaluatePOST, { method: 'POST', params: { id: c.id } })
  assert.equal(a1.data.snapshots, 1)
  assert.equal(a2.data.snapshots, 1)
  assert.deepEqual(a1.data.avaliacao.requirements, a2.data.avaliacao.requirements)
  c = await get(c)
  assert.equal(c.rule_version, 1)
  assert.equal((await patch(c, { op: 'regra_versao', versao: 2 })).status, 409, 'versão 2 ainda não publicada')
  await chama(H.settingsPUT, { user: 'u-admin', method: 'PUT', body: { regras_publicada: 2 } })
  const up = await patch(c, { op: 'regra_versao', versao: 2, motivo: 'Adoção da nova versão' })
  assert.equal(up.status, 200)
  assert.equal(up.data.rule_version, 2)
  assert.equal(up.data.avaliacao.rule_version, '2026.10.28-2')
  const a3 = await chama(H.evaluatePOST, { method: 'POST', params: { id: c.id } })
  assert.equal(a3.data.snapshots, 2)
  assert.equal(a3.data.avaliacao.rule_version, '2026.10.28-2')
  assert.equal((await patch(up.data, { op: 'regra_versao', versao: 9 })).status, 422)
  await chama(H.settingsPUT, { user: 'u-admin', method: 'PUT', body: { regras_publicada: 1 } })
})

test('relatório (JUR-049): só advogado, com aviso de rascunho e sem afirmar validade', async () => {
  const c = await criar('01-A')
  const r = await chama(H.reportGET, { params: { id: c.id } })
  assert.equal(r.status, 200)
  assert.match(r.data.natureza, /Não é peça processual/)
  assert.ok(r.data.aviso)
  assert.ok(!/(petição|peticao) (é )?(válida|valida|apta)/i.test(JSON.stringify(r.data)))
})

test('auditoria registra ator, perfil, antes/depois, motivo e rule_version; não há DELETE', async () => {
  const c = await criar('01-A')
  await patch(c, { op: 'formulario', dados: { falecido: { nome: 'Fulano Fictício' } } })
  const eventos = (await chama(H.auditGET, { params: { id: c.id } })).data.eventos
  const e = eventos.find((x) => x.evento === 'formulario_alterado')
  assert.equal(e.actor_id, 'u-ana')
  assert.equal(e.perfil, 'advogado')
  assert.ok('antes' in e && 'depois' in e && e.rule_version === 1)
  assert.equal(Object.keys(H).filter((k) => /DELETE/i.test(k)).length, 0)
  assert.equal((await chama(H.auditGET, { user: 'u-rafael', params: { id: c.id } })).status, 403)
})

test('avaliações da IA: rubrica validada, CSV, só do próprio avaliador', async () => {
  const body = { caso_id: '02-B', alertas_corretos: 3, alertas_faltantes: 1, alertas_indevidos: 0, linguagem_segura: 'sim', falha_critica: 'nao', observacoes: 'Ficou "bom"' }
  assert.equal((await chama(H.avaliacoesPOST, { method: 'POST', user: 'u-carla', body })).status, 403)
  assert.equal((await chama(H.avaliacoesPOST, { method: 'POST', body: { ...body, caso_id: 'zz' } })).status, 422)
  assert.equal((await chama(H.avaliacoesPOST, { method: 'POST', body: { ...body, alertas_corretos: -1 } })).status, 422)
  assert.equal((await chama(H.avaliacoesPOST, { method: 'POST', body })).status, 201)
  const csv = await chama(H.avaliacoesGET, { url: 'http://x/api/avaliacoes?formato=csv' })
  assert.match(csv.data, /caso_id,avaliador_id/)
  assert.match(csv.data, /""bom""/)
  assert.equal((await chama(H.avaliacoesGET, { user: 'u-rafael', url: 'http://x/api/avaliacoes?formato=csv' })).data.split('\n').length, 1)
})

test('templates: lista 54 casos sem saída esperada', async () => {
  const r = await chama(H.templatesGET)
  assert.equal(r.data.casos.length, 54)
  assert.ok(!/falha_critica|esperado/i.test(JSON.stringify(r.data)))
})
