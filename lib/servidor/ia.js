// LEITURA SIMULADA de documentos (substitui o OCR/NER, que é responsabilidade do módulo de IA).
// Não lê o conteúdo do arquivo: aplica um "perfil de leitura" escolhido no envio, para reproduzir de forma
// controlada os cenários do caderno (baixa legibilidade, CPF divergente, documento errado, terceiro).
// Todo resultado sai marcado simulado:true. Conteúdo de arquivo nunca é tratado como instrução.

import { DOC_TIPOS } from '../catalogo'

export const LEITURAS = {
  legivel: 'Legível, dados coerentes com o formulário',
  baixa_legibilidade: 'Imagem desfocada / baixa legibilidade',
  cpf_divergente: 'CPF do documento diverge do formulário',
  conteudo_outro: 'Conteúdo é de outro tipo de documento',
  documento_terceiro: 'Documento de terceiro (quarentena)',
}

const cpfAlterado = (cpf) => (cpf ? cpf.slice(0, -1) + (cpf.endsWith('1') ? '2' : '1') : '000.000.000-01')
const E = (campo, valor, confianca) => ({ campo, valor, confianca })

export function simularLeitura({ tipo, leitura = 'legivel', formulario }) {
  const fal = formulario?.falecido || {}
  const marca = { simulado: true, modelo: 'simulador-deterministico-v1', leitura }
  const dadosDoObito = (cpf = fal.cpf) => {
    const extraido = {}
    const entidades = []
    if (fal.nome) { extraido.nome = fal.nome; entidades.push(E('nome', fal.nome, 0.95)) }
    if (cpf) { extraido.cpf = cpf; entidades.push(E('cpf', cpf, 0.93)) }
    if (fal.data_obito) { extraido.data_obito = fal.data_obito; entidades.push(E('data_obito', fal.data_obito, 0.96)) }
    return { extraido, entidades }
  }

  if (leitura === 'baixa_legibilidade') {
    return { ...marca, tipo_classificado: tipo, legibilidade: 'baixa', confianca: 0.31, entidades: [E('nome', '(trecho ilegível)', 0.31)], extraido: {} }
  }
  if (leitura === 'conteudo_outro') {
    return { ...marca, tipo_classificado: 'foto_imovel', legibilidade: 'ok', confianca: 0.88, entidades: [E('tipo_documento', DOC_TIPOS.foto_imovel, 0.88)], extraido: {} }
  }
  const comuns = { ...marca, tipo_classificado: tipo, legibilidade: 'ok' }
  if (tipo === 'certidao_obito') {
    const d = dadosDoObito(leitura === 'cpf_divergente' ? cpfAlterado(fal.cpf) : fal.cpf)
    return { ...comuns, confianca: leitura === 'cpf_divergente' ? 0.9 : 0.94, ...d, quarentena: leitura === 'documento_terceiro' || undefined }
  }
  const base = { ...comuns, confianca: leitura === 'documento_terceiro' ? 0.8 : 0.92, entidades: [E('tipo_documento', DOC_TIPOS[tipo] || tipo, 0.92)], extraido: {} }
  if (leitura === 'cpf_divergente') base.extraido = { cpf: cpfAlterado(fal.cpf) }
  if (leitura === 'documento_terceiro') base.quarentena = true
  return base
}

/** Estado do documento após a leitura (especificação, seção 7). */
export function statusAposLeitura(doc, formulario) {
  if (doc.legibilidade === 'baixa') return 'ANEXADO' // aguarda novo arquivo; nada é confirmado
  if (doc.quarentena) return 'EM_ANALISE'
  const fal = formulario?.falecido || {}
  const x = doc.extraido || {}
  const diverge = (a, b) => a && b && String(a).trim().toLowerCase() !== String(b).trim().toLowerCase()
  if (diverge(x.cpf, fal.cpf) || diverge(x.nome, fal.nome) || diverge(x.data_obito, fal.data_obito)) return 'DIVERGENTE'
  return 'CLASSIFICADO'
}
