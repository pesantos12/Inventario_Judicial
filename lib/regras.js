// Motor determinístico de regras jurídicas condicionais (matriz JUR-001 a JUR-051).
// Isomórfico: roda na rota /api/cases/[id]/evaluate e, como contingência, no navegador.
// As regras só organizam informação e sinalizam pendências — nunca decidem direitos,
// nunca declaram inépcia e nunca bloqueiam o rascunho (especificação, seções 1, 3 e 12).

import { ATENDIDOS } from './estados'
import { DOC_TIPOS } from './catalogo'

export const REGRAS_VERSOES = { 1: '2026.10.21-1', 2: '2026.10.28-2' }
export const versaoRotulo = (n) => REGRAS_VERSOES[n] || REGRAS_VERSOES[1]

// ---------- utilitários ----------
const arr = (v) => (Array.isArray(v) ? v : [])
const herdeiros = (f) => arr(f.herdeiros)
const bens = (f) => arr(f.bens)
const dividas = (f) => arr(f.dividas)
const temBem = (f, tipo) => bens(f).some((b) => b.tipo === tipo)
const norm = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const ufDe = (s = '') => {
  const m = String(s).match(/(?:\/|\b)([A-Za-z]{2})\s*$/)
  return m ? m[1].toUpperCase() : ''
}
const mesesDesde = (iso, hoje) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return (hoje.getFullYear() - d.getFullYear()) * 12 + (hoje.getMonth() - d.getMonth()) - (hoje.getDate() < d.getDate() ? 1 : 0)
}
const docsDe = (ctx, tipo) => ctx.docs.filter((d) => d.tipo === tipo)
const docUtil = (d) => d.status !== 'FALHA_TECNICA'
const triSim = (v) => (v === 'sim' ? 'sim' : v === 'nao' ? 'nao' : 'indeterminado')
const soSim = (v) => (v === 'sim' ? 'sim' : 'nao')

const DESCENDENTES = ['filho', 'neto']
const ehDescendente = (h) => DESCENDENTES.includes(h.parentesco)
const ehIncapaz = (h) => ['menor', 'incapacidade_alegada'].includes(h.capacidade)

// ---------- exigências reutilizáveis ----------
const docReq = (chave, rotulo, porque, classe = 'CONDICIONAL', fase = 'cadastro') => ({ chave, doc: chave, tipo: 'documento', rotulo, porque, classe, fase })
const campoReq = (chave, rotulo, porque, cumprida, classe = 'CONDICIONAL', fase = 'cadastro') => ({ chave, tipo: 'campo', rotulo, porque, classe, fase, cumprida })
const tarefaReq = (chave, rotulo, porque, fase, extra = {}) => ({ chave, tipo: 'tarefa', rotulo, porque, classe: 'FASE_POSTERIOR', fase, ...extra })

const A = (codigo, severidade, mensagem, extra = {}) => ({ codigo, severidade, mensagem, revisao: severidade !== 'INFORMATIVO', ...extra })

// ---------- matriz de regras ----------
// avalia() devolve 'sim' | 'nao' | 'indeterminado'.
// exige: exigências que passam a valer quando 'sim' (viram NAO_APLICAVEL quando 'nao').
// exigeNao: exigências que valem apenas quando 'nao'.
const MATRIZ = [
  {
    id: 'JUR-001', titulo: 'Óbito informado', base: 'CPC 615; prova do falecimento',
    avalia: (f) => (f.falecido?.data_obito ? 'sim' : 'nao'),
    exige: [docReq('certidao_obito', 'Certidão de óbito', 'Prova inicial do falecimento. Normalmente indispensável, mas a ausência não gera classificação automática de inépcia: registre justificativa para avaliação do advogado.', 'ESSENCIAL_PETICAO')],
    exigeNao: [campoReq('declaracao_ausencia_obito', 'Declaração de ausência de data/prova do óbito', 'Sem data de óbito informada: registre a declaração de ausência e mantenha o rascunho.', (f) => !!f.falecido?.justificativa_obito, 'ESSENCIAL_PETICAO')],
  },
  {
    id: 'JUR-002', titulo: 'Requerente declara ser legitimado', base: 'CPC 615–616',
    avalia: (f) => (f.requerente?.qualidade ? 'sim' : 'nao'),
    exige: [
      docReq('identificacao_requerente', 'Identificação do requerente (RG/CPF)', 'Qualificação do requerente conforme a representação processual.'),
      docReq('procuracao', 'Procuração / representação', 'Instrumento de mandato do advogado, quando atua por procuração.'),
    ],
    exigeNao: [campoReq('qualidade_requerente', 'Qualidade do requerente', 'Informe se é cônjuge, herdeiro, credor ou outro — a legitimidade é apenas declarada.', () => false, 'ESSENCIAL_PETICAO')],
    alertas: (f, ctx, res) => (res === 'nao' ? [A('QUALIDADE_NAO_INFORMADA', 'ATENCAO', 'A qualidade do requerente não foi informada: a legitimidade declarada precisa ser registrada e revisada.')] : []),
  },
  {
    id: 'JUR-003', titulo: 'Há cônjuge sobrevivente', base: 'CC 1.829 e seguintes',
    avalia: (f) => triSim(f.conjuge?.ha_conjuge),
    exige: [
      docReq('certidao_casamento', 'Certidão de casamento', 'Necessária para identificar o regime de bens e a possível meação.'),
      campoReq('regime_bens', 'Regime de bens do casamento', 'Informe o regime; se desconhecido, a meação não será calculada.', (f) => !!f.conjuge?.regime_bens && f.conjuge.regime_bens !== 'desconhecido'),
    ],
    alertas: (f, ctx, res) => {
      if (res === 'sim') return [A('MEACAO_POTENCIAL', 'INFORMATIVO', 'Há cônjuge sobrevivente: possível meação e direitos sucessórios a analisar por profissional habilitado. Percentuais não são calculados pela plataforma.', { revisao: true })]
      if (res === 'indeterminado') return [A('CONJUGE_NAO_ESCLARECIDO', 'INFORMATIVO', 'Situação conjugal não esclarecida: a ausência de cônjuge ou companheiro não é presumida.', { revisao: false })]
      return []
    },
  },
  {
    id: 'JUR-004', titulo: 'Há união estável declarada', base: 'CC 1.723 e seguintes',
    avalia: (f) => soSim(f.sucessao?.ha_uniao_estavel),
    exige: [docReq('prova_uniao_estavel', 'Prova de união estável', 'Período, provas e interessados exigem análise humana; o sistema não reconhece nem nega a união.')],
    alertas: (f, ctx, res) => (res === 'sim' ? [A('UNIAO_ESTAVEL_ALEGADA', 'ATENCAO', 'União estável declarada: registre período, provas e interessados. O reconhecimento depende de análise jurídica/probatória.')] : []),
  },
  {
    id: 'JUR-005', titulo: 'Regime de bens desconhecido', base: 'CC — regime de bens',
    avalia: (f) => (f.conjuge?.ha_conjuge === 'sim' && (!f.conjuge.regime_bens || f.conjuge.regime_bens === 'desconhecido') ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => {
      if (res === 'sim') return [A('REGIME_DESCONHECIDO', 'ATENCAO', 'Regime de bens desconhecido: o cálculo automático de meação fica impedido até que o regime seja informado.')]
      if (f.conjuge?.ha_conjuge === 'sim') return [A('REGIME_DECLARADO', 'INFORMATIVO', 'Regime de bens registrado conforme declaração, ainda sujeito a revisão (datas e origem de cada bem importam).', { revisao: true })]
      return []
    },
  },
  {
    id: 'JUR-006', titulo: 'Há pacto antenupcial declarado', base: 'CC 1.653 e seguintes',
    avalia: (f) => (f.conjuge?.ha_conjuge === 'sim' && f.conjuge?.pacto_antenupcial === 'sim' ? 'sim' : 'nao'),
    exige: [docReq('pacto_antenupcial', 'Pacto antenupcial', 'Solicite o pacto e o registro quando aplicável; o conteúdo do pacto não é presumido.')],
  },
  {
    id: 'JUR-007', titulo: 'Há descendentes', base: 'CC 1.829',
    avalia: (f) => (herdeiros(f).some(ehDescendente) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => (res === 'nao' ? [A('SEM_DESCENDENTES', 'INFORMATIVO', 'Nenhum descendente cadastrado: verifique ascendentes e demais classes sucessórias. Ausência de cadastro não significa ausência de herdeiros.', { revisao: false })] : []),
  },
  {
    id: 'JUR-008', titulo: 'Há herdeiro pré-morto', base: 'CC 1.851 e seguintes',
    avalia: (f) => (herdeiros(f).some((h) => h.situacao_vida === 'pre_morto' && h.parentesco !== 'ascendente') ? 'sim' : 'nao'),
    exige: [docReq('certidoes_vinculo', 'Certidões de vínculo familiar', 'Vínculos entre o pré-morto e seus descendentes/colaterais para avaliar representação.')],
    alertas: (f, ctx, res) => {
      if (res !== 'sim') return []
      const colateral = herdeiros(f).some((h) => h.situacao_vida === 'pre_morto' && h.parentesco === 'colateral')
      return [A('PRE_MORTO', 'ATENCAO', colateral
        ? 'Colateral pré-morto: a representação na linha colateral segue regras próprias, distintas das dos descendentes. Revisão jurídica obrigatória; nenhuma quota é atribuída.'
        : 'Herdeiro pré-morto: possível representação sucessória pelos descendentes. Revisão jurídica obrigatória; nenhuma quota é atribuída automaticamente.')]
    },
  },
  {
    id: 'JUR-009', titulo: 'Há herdeiro pós-morto', base: 'Sucessões encadeadas',
    avalia: (f) => (herdeiros(f).some((h) => h.situacao_vida === 'pos_morto') ? 'sim' : 'nao'),
    exige: [campoReq('datas_sucessao_subsequente', 'Datas e sucessão subsequente do herdeiro pós-morto', 'Registre a data de falecimento do herdeiro e quem o sucede.', (f) => herdeiros(f).filter((h) => h.situacao_vida === 'pos_morto').every((h) => !!h.data_obito))],
    alertas: (f, ctx, res) => (res === 'sim' ? [A('POS_MORTO', 'ATENCAO', 'Herdeiro que morreu após o autor da herança: possível transmissão (sucessões encadeadas). Não se aplica representação sem avaliar a transmissão.')] : []),
  },
  {
    id: 'JUR-010', titulo: 'Há herdeiro menor ou incapaz', base: 'CPC 178, II; CC capacidade',
    avalia: (f) => (herdeiros(f).some(ehIncapaz) || f.sucessao?.ha_herdeiros_incapazes === 'sim' ? 'sim' : f.sucessao?.ha_herdeiros_incapazes === 'nao' ? 'nao' : 'indeterminado'),
    exige: [
      docReq('identificacao_representante', 'Identificação do representante/assistente', 'Representante (menor de 16) ou assistente (relativamente incapaz) — declare qual é o caso.'),
      docReq('certidao_nascimento', 'Certidão de nascimento / documento do herdeiro menor ou incapaz', 'Documento pertinente à identificação e à capacidade declarada.'),
    ],
    alertas: (f, ctx, res) => {
      const out = []
      if (res === 'sim') out.push(A('INCAPAZ', 'ATENCAO', 'Herdeiro menor ou incapaz: possível intervenção do Ministério Público (CPC 178, II) e controles processuais — avaliação do advogado. A plataforma não diagnostica incapacidade.'))
      if (res === 'indeterminado') out.push(A('INCAPAZ_NAO_ESCLARECIDO', 'INFORMATIVO', 'Não foi esclarecido se há herdeiros menores ou incapazes.', { revisao: false }))
      herdeiros(f).filter((h) => h.suporte === 'assistencia').forEach((h) => out.push(A('ASSISTENCIA', 'INFORMATIVO', `${h.nome}: registrado como assistência (relativamente incapaz), situação distinta da representação.`, { sufixo: h.id, revisao: true })))
      return out
    },
  },
  {
    id: 'JUR-011', titulo: 'Há interessado não localizado', base: 'CPC — citações/intimações',
    avalia: (f) => (herdeiros(f).some((h) => h.nao_localizado) || f.sucessao?.ha_interessado_nao_localizado === 'sim' ? 'sim' : 'nao'),
    exige: [campoReq('diligencias_localizacao', 'Diligências para localizar interessados', 'Registre as diligências realizadas; endereços desconhecidos não são inventados.', (f) => !!f.sucessao?.diligencias_texto)],
    alertas: (f, ctx, res) => (res === 'sim' ? [A('NAO_LOCALIZADO', 'ATENCAO', 'Interessado não localizado: registre diligências e mantenha o endereço como desconhecido. Ausência de parentes conhecidos não equivale a ausência de herdeiros.')] : []),
  },
  {
    id: 'JUR-012', titulo: 'Há testamento', base: 'CPC 610; 735 e seguintes',
    avalia: (f) => triSim(f.sucessao?.ha_testamento),
    exige: [docReq('testamento', 'Testamento (cópia/atos)', 'Dados e arquivo do testamento para análise judicial específica; o sistema não infere beneficiários.')],
    alertas: (f, ctx, res) => {
      if (res === 'sim') return [A('TESTAMENTO', 'REVISAO_URGENTE', 'Testamento declarado: exige análise judicial específica e revisão do advogado. A plataforma não valida o testamento nem gera partilha legal automática.')]
      if (res === 'nao') return [A('TESTAMENTO_INEXISTENCIA_DECLARADA', 'INFORMATIVO', 'Inexistência de testamento registrada como declaração do usuário — não como verificação documental.', { revisao: false })]
      return []
    },
  },
  {
    id: 'JUR-013', titulo: 'Situação testamentária desconhecida', base: 'Verificação documental',
    avalia: (f) => (!f.sucessao?.ha_testamento || f.sucessao.ha_testamento === 'nao_sei' ? 'sim' : 'nao'),
    exige: [docReq('consulta_testamento', 'Consulta/certidão de testamento', 'Sugestão de consulta pertinente para confirmar a existência de testamento.', 'RECOMENDADO_LOCAL')],
    alertas: (f, ctx, res) => (res === 'sim' ? [A('TESTAMENTO_DESCONHECIDO', 'ATENCAO', 'Situação testamentária desconhecida: considere a consulta pertinente. A inexistência de testamento não é presumida.', { revisao: false })] : []),
  },
  {
    id: 'JUR-014', titulo: 'Há litígio declarado', base: 'CPC — inventário e partilha',
    avalia: (f) => triSim(f.sucessao?.ha_conflito),
    alertas: (f, ctx, res) => {
      if (res === 'sim') return [A('LITIGIO', 'REVISAO_URGENTE', 'Litígio ou controvérsia declarado: revisão especializada e trilha de divergência. A plataforma não gera plano consensual nem declara partilha amigável.')]
      if (res !== 'nao' && herdeiros(f).length > 1) return [A('CONSENSO_NAO_PRESUMIDO', 'INFORMATIVO', 'A concordância entre os herdeiros não foi informada e não é presumida.', { revisao: false })]
      return []
    },
  },
  {
    id: 'JUR-015', titulo: 'Existe bem imóvel', base: 'CPC 620; registros imobiliários',
    avalia: (f) => (temBem(f, 'imovel') ? 'sim' : 'nao'),
    exige: [
      docReq('matricula_imovel', 'Matrícula do imóvel', 'Matrícula atualizada para conferir titularidade, localização e ônus.'),
      docReq('titulo_aquisitivo', 'Título aquisitivo do imóvel', 'Escritura ou documento de aquisição (importa para origem e data de aquisição).'),
      docReq('onus_dados_fiscais', 'Ônus e dados fiscais do imóvel', 'Conferir exigências do TJES/vara e do município.', 'RECOMENDADO_LOCAL'),
    ],
    alertas: (f, ctx, res) => {
      if (res !== 'sim') return []
      const out = []
      docsDe(ctx, 'matricula_imovel').filter((d) => d.desatualizada).forEach((d) => out.push(A('MATRICULA_DESATUALIZADA', 'ATENCAO', `Certidão de matrícula desatualizada (${d.nome}): confira a situação registral atual. A titularidade não é presumida como incontroversa.`, { sufixo: d.id })))
      bens(f).filter((b) => b.posse).forEach((b) => out.push(A('POSSE_SEM_MATRICULA', 'ATENCAO', `${b.descricao}: direito possessório sem matrícula em nome do falecido — diferencie posse de propriedade registral e peça provas. Domínio pleno não é afirmado.`, { sufixo: b.id })))
      return out
    },
  },
  {
    id: 'JUR-016', titulo: 'Imóvel em outra UF', base: 'ITCMD — legislação aplicável',
    avalia: (f) => {
      const ufDom = ufDe(f.falecido?.ultimo_domicilio)
      return ufDom && bens(f).some((b) => b.tipo === 'imovel' && b.uf && b.uf.toUpperCase() !== ufDom) ? 'sim' : 'nao'
    },
    alertas: (f, ctx, res) => (res === 'sim' ? [A('IMOVEL_OUTRA_UF', 'ATENCAO', 'Imóvel em UF diferente do domicílio do falecido: competência tributária e exigências registrais distintas, para revisão. Nenhuma alíquota única é aplicada.')] : []),
  },
  {
    id: 'JUR-017', titulo: 'Existe veículo', base: 'CPC 620',
    avalia: (f) => (temBem(f, 'veiculo') ? 'sim' : 'nao'),
    exige: [docReq('crlv_veiculo', 'CRLV / registro do veículo', 'Placa/RENAVAM, se disponíveis, e prova de propriedade.')],
  },
  {
    id: 'JUR-018', titulo: 'Existem contas ou investimentos', base: 'CPC 620',
    avalia: (f) => (temBem(f, 'conta') ? 'sim' : 'nao'),
    exige: [docReq('extrato_bancario', 'Extratos e saldos bancários', 'Instituição e saldo na data-base do óbito, se conhecidos. Nenhum saldo é inventado.')],
    alertas: (f, ctx, res) => {
      if (res !== 'sim') return []
      const out = []
      bens(f).filter((b) => b.tipo === 'conta' && b.nao_confirmado).forEach((b) => out.push(A('ATIVO_NAO_CONFIRMADO', 'ATENCAO', `${b.descricao}: possível ativo não confirmado — diligência pendente. Nenhum saldo foi incluído.`, { sufixo: b.id })))
      bens(f).filter((b) => b.tipo === 'conta' && !b.nao_confirmado && !b.valor_estimado).forEach((b) => out.push(A('VALOR_NAO_CONFIRMADO', 'INFORMATIVO', `${b.descricao}: valor não confirmado — solicite o comprovante apropriado.`, { sufixo: b.id, revisao: false })))
      return out
    },
  },
  {
    id: 'JUR-019', titulo: 'Existem quotas societárias', base: 'CPC 620',
    avalia: (f) => (temBem(f, 'quotas') ? 'sim' : 'nao'),
    exige: [docReq('contrato_social', 'Contrato social e alterações', 'Participação societária e documentação para avaliação.')],
    alertas: (f, ctx, res) => {
      if (res !== 'sim') return []
      const out = [A('AVALIACAO_QUOTAS', 'INFORMATIVO', 'Quotas societárias: marque a avaliação. Valor nominal das quotas não se confunde com valor patrimonial.', { revisao: true })]
      docsDe(ctx, 'contrato_social').filter((d) => d.desatualizada).forEach((d) => out.push(A('CONTRATO_DESATUALIZADO', 'ATENCAO', `Contrato social possivelmente desatualizado (${d.nome}): solicite a versão consolidada.`, { sufixo: d.id })))
      return out
    },
  },
  {
    id: 'JUR-020', titulo: 'Existem bens digitais', base: 'Proteção de dados e direitos de terceiros',
    avalia: (f) => (temBem(f, 'digital') ? 'sim' : 'nao'),
    exige: [campoReq('descricao_bens_digitais', 'Descrição e prova de titularidade dos bens digitais', 'Cadastre descrição e prova de titularidade. Senhas e credenciais nunca são solicitadas.', (f) => bens(f).filter((b) => b.tipo === 'digital').every((b) => !!b.descricao))],
  },
  {
    id: 'JUR-021', titulo: 'Há bem no exterior', base: 'CPC 23, II; direito internacional',
    avalia: (f) => (bens(f).some((b) => b.exterior) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => (res === 'sim' ? [A('BEM_EXTERIOR', 'REVISAO_URGENTE', 'Bem no exterior: jurisdição e tributação exigem revisão especializada. A partilha brasileira de bem estrangeiro não é presumida.')] : []),
  },
  {
    id: 'JUR-022', titulo: 'Há dívida conhecida', base: 'CC 1.997; CPC 642 e seguintes',
    avalia: (f) => (dividas(f).length > 0 ? 'sim' : 'nao'),
    exige: [docReq('comprovante_divida', 'Comprovante da dívida', 'Credor, valor, origem e prova da dívida.')],
    alertas: (f, ctx, res) => {
      if (res !== 'sim') return []
      const out = []
      dividas(f).forEach((d) => {
        if (d.contestada) out.push(A('DIVIDA_CONTESTADA', 'REVISAO_URGENTE', `Dívida contestada (${d.credor || 'credor não informado'}): distinguir alegação de passivo comprovado; não tratar como crédito incontroverso.`, { sufixo: d.id }))
        else if (!d.comprovada) out.push(A('DIVIDA_NAO_COMPROVADA', 'ATENCAO', `Dívida sem prova (${d.credor || 'credor não informado'}): registrada apenas como alegação.`, { sufixo: d.id }))
        else if (!d.valor) out.push(A('VALOR_DIVIDA_NAO_CONFIRMADO', 'INFORMATIVO', `Dívida comprovada (${d.credor || 'credor não informado'}) com saldo atualizado desconhecido: solicite o demonstrativo. Não é deduzida automaticamente.`, { sufixo: d.id, revisao: false }))
      })
      return out
    },
  },
  {
    id: 'JUR-023', titulo: 'Há doações em vida relevantes', base: 'CC 2.002 e seguintes',
    avalia: (f) => soSim(f.sucessao?.ha_doacoes),
    exige: [docReq('instrumento_doacao', 'Instrumento de doação', 'Datas, beneficiário e eventual dispensa de colação.')],
    alertas: (f, ctx, res) => (res === 'sim' ? [A('COLACAO_POTENCIAL', 'ATENCAO', 'Doação em vida: possível colação. A análise de exceções e de dispensa cabe ao advogado; nada é imposto ou desconsiderado automaticamente.')] : []),
  },
  {
    id: 'JUR-024', titulo: 'Há renúncia alegada', base: 'CC 1.806',
    avalia: (f) => soSim(f.sucessao?.ha_renuncia_alegada),
    exige: [docReq('instrumento_renuncia', 'Instrumento de renúncia', 'A renúncia exige forma legal adequada; mensagem informal não basta.')],
    alertas: (f, ctx, res) => (res === 'sim' ? [A('RENUNCIA_ALEGADA', 'ATENCAO', 'Renúncia alegada: registrada como intenção não formalizada. O herdeiro não é excluído automaticamente.')] : []),
  },
  {
    id: 'JUR-025', titulo: 'Há cessão de direitos', base: 'CC 1.793',
    avalia: (f) => soSim(f.sucessao?.ha_cessao),
    exige: [docReq('instrumento_cessao', 'Instrumento de cessão de direitos', 'Partes e forma do instrumento para revisão jurídica.')],
    alertas: (f, ctx, res) => (res === 'sim' ? [A('CESSAO_ALEGADA', 'ATENCAO', 'Cessão de direitos hereditários alegada: exigências formais e validade analisadas por profissional. Contrato particular simples não é validado pela plataforma.')] : []),
  },
  {
    id: 'JUR-026', titulo: 'Há cessão ou renúncia não comprovada', base: 'Necessidade de verificação',
    avalia: (f, ctx) => {
      const alegada = f.sucessao?.ha_renuncia_alegada === 'sim' || f.sucessao?.ha_cessao === 'sim'
      if (!alegada) return 'nao'
      const comprovada = [...docsDe(ctx, 'instrumento_renuncia'), ...docsDe(ctx, 'instrumento_cessao')].some(docUtil)
      return comprovada ? 'nao' : 'sim'
    },
    alertas: (f, ctx, res) => (res === 'sim' ? [A('STATUS_ALEGADO', 'INFORMATIVO', 'Renúncia/cessão mantida com status "alegado": nenhum quinhão é alterado sem comprovação.', { revisao: true })] : []),
  },
  {
    id: 'JUR-027', titulo: 'Não há bens conhecidos', base: 'Prática processual; conferir caso',
    avalia: (f) => (bens(f).length === 0 ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => (res === 'sim' ? [A('INVENTARIO_NEGATIVO', 'INFORMATIVO', 'Nenhum bem conhecido: é possível registrar a declaração; a hipótese de inventário negativo fica para revisão do advogado.', { revisao: true })] : []),
  },
  {
    id: 'JUR-028', titulo: 'Há bens sonegados alegados', base: 'CC 1.992 e seguintes',
    avalia: (f) => soSim(f.sucessao?.ha_bens_sonegados),
    alertas: (f, ctx, res) => (res === 'sim' ? [A('SONEGACAO_ALEGADA', 'REVISAO_URGENTE', 'Alegação de bens sonegados: alerta reservado, para revisão humana. A plataforma não faz acusações.')] : []),
  },
  {
    id: 'JUR-029', titulo: 'Divergência entre CPF digitado e OCR', base: 'Verificação técnica',
    avalia: (f, ctx) => (ctx.docs.some((d) => d.extraido?.cpf && f.falecido?.cpf && d.extraido.cpf !== f.falecido.cpf) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => {
      if (res !== 'sim') return []
      return ctx.docs.filter((d) => d.extraido?.cpf && f.falecido?.cpf && d.extraido.cpf !== f.falecido.cpf).map((d) =>
        A('CPF_DIVERGENTE', 'REVISAO_URGENTE', 'Os dados do arquivo não coincidem com o formulário. Confira as informações antes de continuar. Nenhum valor é sobrescrito automaticamente.', {
          sufixo: d.id,
          fontes: [
            { origem: 'Formulário (declarado)', campo: 'CPF do falecido', valor: f.falecido.cpf },
            { origem: `Documento ${d.nome} (extração ${d.simulado ? 'simulada' : 'automática'})`, campo: 'CPF do falecido', valor: d.extraido.cpf, confianca: d.confianca },
          ],
        }))
    },
  },
  {
    id: 'JUR-030', titulo: 'Documento ilegível', base: 'Qualidade de arquivo',
    avalia: (f, ctx) => (ctx.docs.some((d) => d.legibilidade === 'baixa' && docUtil(d)) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => (res === 'sim' ? ctx.docs.filter((d) => d.legibilidade === 'baixa' && docUtil(d)).map((d) => A('DOC_ILEGIVEL', 'ATENCAO', `${d.nome}: baixa legibilidade. Envie novo arquivo ou registre justificativa. Dados incertos não são extraídos como confirmados.`, { sufixo: d.id })) : []),
  },
  {
    id: 'JUR-031', titulo: 'Documento de terceiro não pertinente', base: 'LGPD — minimização',
    avalia: (f, ctx) => (ctx.docs.some((d) => d.quarentena) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => (res === 'sim' ? ctx.docs.filter((d) => d.quarentena).map((d) => A('DOC_TERCEIRO', 'ATENCAO', `${d.nome}: possível documento de terceiro. Mantido em quarentena para revisão de privacidade (minimização LGPD).`, { sufixo: d.id })) : []),
  },
  {
    id: 'JUR-032', titulo: 'Arquivo com malware ou tipo não permitido', base: 'Segurança da informação',
    avalia: (f, ctx) => (ctx.docs.some((d) => d.status === 'FALHA_TECNICA') ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => (res === 'sim' ? ctx.docs.filter((d) => d.status === 'FALHA_TECNICA').map((d) => A('UPLOAD_REJEITADO', 'ATENCAO', `Upload rejeitado (${d.nome}): ${d.motivo_tecnico || 'falha técnica'}. O histórico é mantido; envie um novo arquivo.`, { sufixo: d.id, revisao: false })) : []),
  },
  {
    id: 'JUR-033', titulo: 'Documento não anexado', base: 'Não bloquear protocolo por padrão', pos: true,
    avalia: (f, ctx) => (ctx.requisitos.some((q) => q.applicable === 'aplicavel' && q.tipo === 'documento' && ['ESSENCIAL_PETICAO', 'CONDICIONAL'].includes(q.classe) && ['PENDENTE', 'FALHA_TECNICA'].includes(q.status)) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => {
      if (res !== 'sim') return []
      const pend = ctx.requisitos.filter((q) => q.applicable === 'aplicavel' && q.tipo === 'documento' && ['ESSENCIAL_PETICAO', 'CONDICIONAL'].includes(q.classe) && ['PENDENTE', 'FALHA_TECNICA'].includes(q.status))
      const out = [A('DOCS_PENDENTES', 'INFORMATIVO', `${pend.length} documento(s) pendente(s). As pendências ficam registradas com responsável e justificativa, sem bloquear o requerimento.`, { revisao: false })]
      pend.filter((q) => q.classe === 'ESSENCIAL_PETICAO').forEach((q) => out.push(A('ESSENCIAL_PENDENTE', 'ATENCAO', `${q.rotulo} ainda não anexado(a). Registre a justificativa e siga preparando o pedido; a necessidade de apresentação será analisada pelo profissional responsável. Não há classificação de inépcia.`, { sufixo: q.chave, forte: true })))
      return out
    },
  },
  {
    id: 'JUR-034', titulo: 'Prazo de 2 meses do CPC 611 possivelmente ultrapassado', base: 'CPC 611; efeitos fiscais locais',
    avalia: (f, ctx) => {
      const m = mesesDesde(f.falecido?.data_obito, ctx.hoje)
      return m !== null && m > 2 && !f.processo?.numero_processo ? 'sim' : 'nao'
    },
    alertas: (f, ctx, res) => (res === 'sim' ? [A('PRAZO_CPC_611', 'ATENCAO', `Óbito há ${mesesDesde(f.falecido.data_obito, ctx.hoje)} meses e processo ainda não distribuído: analise o prazo do CPC 611 e possíveis efeitos fiscais locais. Nenhuma multa é calculada.`)] : []),
  },
  {
    id: 'JUR-035', titulo: 'Inventariante nomeado judicialmente', base: 'CPC 617–620',
    avalia: (f) => soSim(f.fase?.inventariante_nomeado),
    exige: [tarefaReq('compromisso_inventariante', 'Termo de compromisso do inventariante', 'Habilitado porque há nomeação judicial registrada.', 'primeiras_declaracoes', { statusFixo: 'INFORMADO' })],
    exigeNao: [tarefaReq('nomeacao_inventariante', 'Nomeação do inventariante', 'Depende de decisão judicial; a plataforma não simula nomeação.', 'primeiras_declaracoes')],
    alertas: (f, ctx, res) => {
      const out = []
      if (res === 'nao') out.push(A('SEM_NOMEACAO', 'INFORMATIVO', 'Nenhuma nomeação de inventariante registrada: a plataforma não simula nomeação nem libera atos judiciais.', { revisao: false }))
      if (f.fase?.inventariante_indicado && f.fase.inventariante_indicado !== f.requerente?.nome) out.push(A('INVENTARIANTE_DISTINTO', 'INFORMATIVO', 'Requerente, pessoa indicada como inventariante e inventariante nomeado judicialmente são papéis distintos — não confundir.', { revisao: true }))
      return out
    },
  },
  {
    id: 'JUR-036', titulo: 'Primeiras declarações apresentadas', base: 'CPC 620',
    avalia: (f) => soSim(f.fase?.primeiras_declaracoes),
    exige: [tarefaReq('conferencia_primeiras_declaracoes', 'Conferência das primeiras declarações', 'Habilitada porque as primeiras declarações foram registradas.', 'primeiras_declaracoes', { statusFixo: 'INFORMADO' })],
    exigeNao: [tarefaReq('primeiras_declaracoes', 'Primeiras declarações', 'Fase posterior à nomeação/compromisso do inventariante; não é exigida para o requerimento inicial.', 'primeiras_declaracoes')],
    alertas: (f, ctx, res) => {
      const out = []
      if (res === 'sim' && f.fase?.inventariante_nomeado !== 'sim' && !f.fase?.inventariante_nomeado) out.push(A('DECLARACOES_SEM_NOMEACAO', 'ATENCAO', 'Primeiras declarações registradas sem inventariante nomeado: confira a sequência processual (CPC 617–620). A plataforma não simula nomeação.'))
      bens(f).filter((b) => b.descoberto_apos_declaracoes).forEach((b) => out.push(A('RETIFICACAO_DECLARACOES', 'ATENCAO', `${b.descricao}: bem identificado após as primeiras declarações — avalie retificação/complementação. O histórico anterior é preservado.`, { sufixo: b.id })))
      return out
    },
  },
  {
    id: 'JUR-037', titulo: 'Há impugnação às primeiras declarações', base: 'CPC 627',
    avalia: (f) => soSim(f.fase?.impugnacao),
    alertas: (f, ctx, res) => (res === 'sim' ? [A('IMPUGNACAO', 'ATENCAO', 'Impugnação registrada: controvérsia com encaminhamento humano.')] : []),
  },
  {
    id: 'JUR-038', titulo: 'Juízo determinou avaliação', base: 'CPC 630 e seguintes',
    avalia: (f) => soSim(f.fase?.avaliacao_determinada),
    exige: [tarefaReq('avaliacao_bens', 'Avaliação dos bens', 'Habilitada por determinação do juízo.', 'avaliacao')],
    alertas: (f, ctx, res) => {
      const pend = bens(f).filter((b) => b.avaliacao === 'pendente')
      return res === 'nao' && pend.length ? [A('AVALIACAO_PENDENTE', 'INFORMATIVO', `Avaliação pendente para ${pend.map((b) => b.descricao).join(', ')} — depende da fase e da finalidade; não é obrigatória universalmente. Nenhum valor de mercado é criado.`, { revisao: false })] : []
    },
  },
  {
    id: 'JUR-039', titulo: 'Há exigência fiscal específica', base: 'Legislação tributária local',
    avalia: (f) => soSim(f.fase?.exigencia_fiscal),
    exige: [docReq('certidao_fiscal', 'Documentos de exigência fiscal (regra local)', 'Documentos conforme a regra local cadastrada — não existe CND universal.', 'RECOMENDADO_LOCAL', 'tributos')],
    alertas: (f, ctx, res) => (res === 'sim' ? [A('DEBITO_FISCAL_INFORMADO', 'INFORMATIVO', 'Débito ou exigência fiscal informada: apuração na fase apropriada. A regularidade fiscal não é declarada.', { revisao: true })] : []),
  },
  {
    id: 'JUR-040', titulo: 'ITCMD pago ou dispensado por ato comprovado', base: 'Tributação estadual; conferência',
    avalia: (f) => (f.tributo?.situacao_itcmd === 'pago_ou_dispensado' ? 'sim' : 'nao'),
    exige: [docReq('comprovante_itcmd', 'Comprovante de ITCMD (pago ou dispensado)', 'Guia, pagamento ou ato de isenção, conforme a UF.', 'FASE_POSTERIOR', 'tributos')],
    exigeNao: [tarefaReq('situacao_itcmd', 'Comprovação do ITCMD', 'Pendência da fase tributária (conforme UF). Não impede o rascunho nem o requerimento inicial.', 'tributos')],
    alertas: (f, ctx, res) => (res === 'nao' && f.tributo?.situacao_itcmd === 'pendente' ? [A('ITCMD_PENDENTE', 'INFORMATIVO', 'ITCMD sem comprovação: pendência da fase tributária. A plataforma não declara quitação nem impede o rascunho.', { revisao: false })] : []),
  },
  {
    id: 'JUR-041', titulo: 'Há plano de partilha', base: 'CPC 647 e seguintes',
    avalia: (f) => soSim(f.fase?.plano_partilha),
    exige: [tarefaReq('plano_partilha', 'Plano de partilha (versão e revisores)', 'Armazenar a versão e os revisores.', 'partilha', { statusFixo: 'INFORMADO' })],
    exigeNao: [tarefaReq('plano_partilha_pendente', 'Plano de partilha', 'Fase posterior: mantido como pendência de fase.', 'partilha')],
  },
  {
    id: 'JUR-042', titulo: 'Há decisão homologatória ou sentença', base: 'CPC — partilha',
    avalia: (f) => soSim(f.fase?.decisao_homologatoria),
    exige: [tarefaReq('decisao_homologatoria', 'Metadados e arquivo da decisão', 'Registrar a decisão confirmada por operador autorizado.', 'partilha', { statusFixo: 'INFORMADO' })],
    alertas: (f, ctx, res) => {
      if (res !== 'sim') return []
      return bens(f).filter((b) => b.descoberto_apos_partilha).map((b) => A('SOBREPARTILHA_POSSIVEL', 'ATENCAO', `${b.descricao}: bem surgido após a partilha homologada — possível sobrepartilha, sujeita a revisão jurídica. O processo não é reaberto automaticamente.`, { sufixo: b.id }))
    },
  },
  {
    id: 'JUR-043', titulo: 'Há formal de partilha ou carta de adjudicação', base: 'CPC 655 e seguintes',
    avalia: (f) => soSim(f.fase?.formal_partilha),
    exige: [tarefaReq('formal_partilha', 'Emissão do formal / carta e providências registrais', 'Registrar a emissão e as providências registrais.', 'encerramento', { statusFixo: 'INFORMADO' })],
    exigeNao: [tarefaReq('acompanhamento_formal', 'Acompanhamento do formal de partilha', 'Mantido em acompanhamento até a emissão.', 'encerramento')],
    alertas: (f) => (f.fase?.exigencia_registral ? [A('POS_PARTILHA', 'INFORMATIVO', 'Exigência registral posterior à partilha: providência pós-partilha, tratada separadamente da petição inicial. O inventário não é reiniciado.', { revisao: false })] : []),
  },
  {
    id: 'JUR-044', titulo: 'Houve ordem judicial de emenda', base: 'CPC 321',
    avalia: (f) => soSim(f.fase?.ordem_emenda),
    exige: [tarefaReq('cumprir_emenda', 'Cumprir ordem de emenda', 'Tarefa vinculada à ordem judicial; o prazo é informado pelo operador, nunca estimado pelo sistema.', 'cadastro', { classe: 'CONDICIONAL' })],
    alertas: (f, ctx, res) => (res === 'sim' ? [A('EMENDA', 'ATENCAO', `Ordem de emenda registrada. Prazo informado pelo operador: ${f.fase?.prazo_emenda || 'não informado'}.`)] : []),
  },
  {
    id: 'JUR-045', titulo: 'Houve determinação de remessa ao gabinete', base: 'Fluxo interno do tribunal',
    avalia: (f) => soSim(f.fase?.remessa_gabinete),
    exige: [tarefaReq('remessa_gabinete', 'Movimentação de remessa ao gabinete', 'Registrada com comprovação; nada é transferido automaticamente.', 'cadastro', { statusFixo: 'INFORMADO' })],
  },
  {
    id: 'JUR-046', titulo: 'Houve autorização expressa de envio de alerta', base: 'LGPD — consentimento/base legal',
    avalia: (f) => soSim(f.processo?.autoriza_alerta_externo),
    alertas: (f, ctx, res) => [A('CANAL_ALERTA', 'INFORMATIVO', res === 'sim' ? 'Alertas externos autorizados: notificação mínima com link seguro.' : 'Sem autorização de envio externo: os alertas permanecem internos.', { revisao: false })],
  },
  {
    id: 'JUR-047', titulo: 'IA com baixa confiança', base: 'IA assistiva',
    avalia: (f, ctx) => (ctx.docs.some((d) => typeof d.confianca === 'number' && d.confianca < 0.7) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => (res === 'sim' ? ctx.docs.filter((d) => typeof d.confianca === 'number' && d.confianca < 0.7).map((d) => A('IA_BAIXA_CONFIANCA', 'ATENCAO', `Extração com baixa confiança (${Math.round(d.confianca * 100)}%) em ${d.nome}: revisão humana necessária. Esta é uma sugestão automatizada e depende de confirmação humana.`, { sufixo: d.id, fontes: (d.entidades || []).slice(0, 3).map((e) => ({ origem: `Documento ${d.nome}`, campo: e.campo, valor: e.valor, confianca: e.confianca })) })) : []),
  },
  {
    id: 'JUR-048', titulo: 'Dados extraídos contradizem o cadastro', base: 'Revisão humana',
    avalia: (f, ctx) => (ctx.docs.some((d) => contradiz(d, f)) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => (res === 'sim' ? ctx.docs.filter((d) => contradiz(d, f)).flatMap((d) => contradiz(d, f).map((c) => A('DADOS_CONTRADIZEM', 'REVISAO_URGENTE', 'Os dados do arquivo não coincidem com o formulário. Confira as informações antes de continuar. A informação declarada não é alterada.', {
      sufixo: `${d.id}-${c.campo}`,
      fontes: [
        { origem: 'Formulário (declarado)', campo: c.rotulo, valor: c.declarado },
        { origem: `Documento ${d.nome} (extração ${d.simulado ? 'simulada' : 'automática'})`, campo: c.rotulo, valor: c.extraido, confianca: d.confianca },
      ],
    }))) : []),
  },
  { id: 'JUR-049', titulo: 'Usuário solicita exportação', base: 'Auditoria', tipo: 'acao', onde: 'Revisão → Exportar relatório (gera relatório com pendências e avisos)' },
  { id: 'JUR-050', titulo: 'Operador marca "não se aplica"', base: 'Rastreabilidade', tipo: 'acao', onde: 'Checklist → Marcar não aplicável (exige motivo e perfil autorizado)' },
  { id: 'JUR-051', titulo: 'Regra alterada após cadastro', base: 'Versionamento', tipo: 'acao', onde: 'Regras → Publicar nova versão (recalcula o checklist preservando o histórico)' },
]

// Regras complementares (fora da matriz JUR): derivadas do caderno de casos e da seção 13.
const COMPLEMENTARES = [
  {
    id: 'CPL-002', titulo: 'Conteúdo do arquivo diverge do tipo/nome informado', base: 'Caderno de casos, 16-C',
    avalia: (f, ctx) => (ctx.docs.some(incorreto) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => (res === 'sim' ? ctx.docs.filter(incorreto).map((d) => A('DOC_INCORRETO', 'ATENCAO', `${d.nome}: o conteúdo foi classificado como "${DOC_TIPOS[d.tipo] || d.tipo}", e não como "${DOC_TIPOS[d.tipo_declarado] || d.tipo_declarado}". A classificação segue o conteúdo, não o nome do arquivo; envie o documento correto.`, { sufixo: d.id })) : []),
  },
  {
    id: 'CPL-003', titulo: 'Filiação, nome ou representação controvertidos', base: 'Caderno de casos, classes 06 e 13',
    avalia: (f) => (herdeiros(f).some((h) => h.controvertido || h.divergencia_nominal || h.conflito_representante) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => {
      if (res !== 'sim') return []
      const out = []
      herdeiros(f).forEach((h) => {
        if (h.controvertido) out.push(A('FILIACAO_CONTROVERTIDA', 'REVISAO_URGENTE', `${h.nome}: filiação/parentesco alegado ou controvertido. Registre a alegação e a documentação; a plataforma não reconhece nem exclui o herdeiro. Análise jurídica necessária.`, { sufixo: h.id }))
        if (h.divergencia_nominal) out.push(A('DIVERGENCIA_NOMINAL', 'ATENCAO', `${h.nome}: grafias divergentes do nome do falecido nos documentos. Pode ser necessária retificação ou comprovação; pessoas não são fundidas sem confirmação.`, { sufixo: h.id }))
        if (h.conflito_representante) out.push(A('CONFLITO_REPRESENTANTE', 'REVISAO_URGENTE', `Possível conflito de interesses do representante de ${h.nome}: sinalize ao advogado. Pode exigir providência judicial específica; a plataforma não escolhe curador.`, { sufixo: h.id }))
      })
      return out
    },
  },
  {
    id: 'CPL-004', titulo: 'Procuração não anexada', base: 'Caderno de casos, 12-A',
    avalia: (f, ctx) => (docsDe(ctx, 'procuracao').some(docUtil) ? 'nao' : 'sim'),
    alertas: (f, ctx, res) => (res === 'sim' ? [A('PROCURACAO_AUSENTE', 'ATENCAO', 'Instrumento de mandato não anexado: a representação regular não é declarada. Registre a justificativa e continue preparando o pedido.')] : []),
  },
  {
    id: 'CPL-005', titulo: 'Procuração exige conferência dos poderes', base: 'Caderno de casos, 12-B',
    avalia: (f, ctx) => (docsDe(ctx, 'procuracao').some((d) => d.conferir_poderes) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => (res === 'sim' ? [A('PROCURACAO_CONFERIR', 'ATENCAO', 'Procuração com poderes genéricos e/ou assinatura ilegível: conferência humana dos poderes e da autenticidade. A plataforma não certifica a validade do mandato.')] : []),
  },
  {
    id: 'CPL-006', titulo: 'Inventário já distribuído', base: 'Caderno de casos, 17-B',
    avalia: (f) => (f.processo?.ja_distribuido === 'sim' ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => (res === 'sim' ? [A('PROCESSO_JA_DISTRIBUIDO', 'REVISAO_URGENTE', 'Já existe inventário distribuído para este espólio. Confirme o estágio e direcione a atividade correta (primeiras declarações, avaliação, partilha); a plataforma não cria nova petição inicial como se o procedimento não existisse.')] : []),
  },
  {
    id: 'CPL-007', titulo: 'Documentos dos herdeiros', base: 'Especificação, seção 9 (Herdeiros)',
    avalia: (f) => (herdeiros(f).length ? 'sim' : 'nao'),
    exige: [docReq('identificacao_herdeiros', 'Identidade/CPF dos herdeiros', 'Documentos pessoais de cada herdeiro, conforme o caso e a fase.')],
    alertas: (f, ctx, res) => (res === 'sim' ? herdeiros(f).filter((h) => h.doc_incompleto).map((h) => A('DOC_HERDEIRO_INCOMPLETO', 'ATENCAO', `${h.nome}: documentação incompleta. Registre a pendência e siga com o rascunho; nenhum dado do herdeiro é inventado.`, { sufixo: h.id, revisao: true })) : []),
  },
  {
    id: 'CPL-008', titulo: 'Herdeiro residente no exterior', base: 'Caderno de casos, 03-B',
    avalia: (f) => (herdeiros(f).some((h) => h.exterior) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => (res === 'sim' ? herdeiros(f).filter((h) => h.exterior).map((h) => A('HERDEIRO_EXTERIOR', 'ATENCAO', `${h.nome}: residente no exterior. Registre a localização e verifique a regularização documental aplicável (documento estrangeiro, representação). O herdeiro não é excluído.`, { sufixo: h.id })) : []),
  },
  {
    id: 'CPL-009', titulo: 'Domicílio, local dos bens e local do óbito distintos', base: 'CPC 48; caderno de casos, 10-A',
    avalia: (f) => (competenciaDistinta(f) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => {
      if (res !== 'sim') return []
      const locais = [...new Set(bens(f).filter((b) => b.tipo === 'imovel' && b.municipio).map((b) => b.municipio))]
      return [A('COMPETENCIA_TERRITORIAL', 'INFORMATIVO', `Competência para revisão: domicílio (${f.falecido?.ultimo_domicilio || 'não informado'}), local dos bens (${locais.join(', ') || 'não informado'}) e local do óbito (${f.falecido?.local_obito || 'não informado'}) são informações distintas. O foro não é definido apenas pelo local do óbito (CPC, art. 48); a plataforma só organiza os dados.`, { revisao: true })]
    },
  },
  {
    id: 'CPL-010', titulo: 'Origem e data de aquisição do bem × regime de bens', base: 'CC — regime de bens; caderno de casos, 01-B e 05-A',
    avalia: (f) => (['casado', 'uniao_estavel'].includes(f.falecido?.estado_civil) || f.conjuge?.ha_conjuge === 'sim') && bens(f).some((b) => ROTULO_AQUISICAO[b.aquisicao]) ? 'sim' : 'nao',
    alertas: (f, ctx, res) => (res === 'sim' ? bens(f).filter((b) => ROTULO_AQUISICAO[b.aquisicao]).map((b) => A('ORIGEM_BEM', 'ATENCAO', `${b.descricao}: ${ROTULO_AQUISICAO[b.aquisicao]}. Solicite título e datas; diferencie possível bem particular de bem comum e meação de sucessão. Nenhum percentual (como 50%) é aplicado.`, { sufixo: b.id })) : []),
  },
  {
    id: 'CPL-011', titulo: 'Nenhum herdeiro conhecido cadastrado', base: 'Caderno de casos, 18-B',
    avalia: (f) => (herdeiros(f).length === 0 && f.conjuge?.ha_conjuge !== 'sim' ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => {
      if (res !== 'sim') return []
      if (f.sucessao?.sem_parentes_conhecidos === 'sim') return [A('SEM_PARENTES_CONHECIDOS', 'REVISAO_URGENTE', 'Falecido sem parentes conhecidos: não conclua ausência de herdeiros. Podem ser necessários procedimento e diligências próprios; nenhum bem é atribuído a credor ou ao Estado pela plataforma.')]
      return [A('SEM_HERDEIROS_CADASTRADOS', 'INFORMATIVO', 'Nenhum herdeiro cadastrado até o momento. Isso reflete apenas o que foi informado, não a inexistência de herdeiros.', { revisao: false })]
    },
  },
  {
    id: 'SEG-001', titulo: 'Instrução embutida em texto livre (prompt injection)', base: 'Especificação, seção 13; caso 16-A',
    avalia: (f) => (PADRAO_INJECAO.test(textoLivre(f)) ? 'sim' : 'nao'),
    alertas: (f, ctx, res) => (res === 'sim' ? [A('INSTRUCAO_EMBUTIDA', 'ATENCAO', 'O texto livre contém uma instrução dirigida ao sistema. Ele é tratado como dado não confiável: nenhuma regra é alterada e as pendências continuam baseadas nas evidências.')] : []),
  },
  {
    id: 'CPL-001', titulo: 'Possível comoriência', base: 'Caderno de casos, classe 18-A',
    avalia: (f) => soSim(f.sucessao?.comoriencia),
    alertas: (f, ctx, res) => (res === 'sim' ? [A('COMORIENCIA', 'REVISAO_URGENTE', 'Falecimento simultâneo sem prova de quem morreu primeiro: hipótese de comoriência a analisar. A transmissão entre os cônjuges não é presumida; solicite a documentação.')] : []),
  },
]

// Versão 2 (simulada): exemplo de atualização normativa local, para demonstrar o T17.
const LOCAL_V2 = [
  {
    id: 'LOC-001', titulo: 'Certidão de regularidade fiscal do imóvel (regra local simulada)', base: 'Regra local simulada — versão 2',
    avalia: (f) => (temBem(f, 'imovel') ? 'sim' : 'nao'),
    exige: [docReq('certidao_fiscal_imovel', 'Certidão de regularidade fiscal do imóvel', 'Incluída pela regra local simulada da versão 2 do catálogo.', 'RECOMENDADO_LOCAL')],
  },
]

const ROTULO_AQUISICAO = {
  anterior_casamento: 'adquirido antes do casamento',
  constancia: 'adquirido na constância do casamento',
  desconhecida: 'origem e data de aquisição desconhecidas',
}
const incorreto = (d) => d.tipo_declarado && d.tipo !== d.tipo_declarado && d.status !== 'FALHA_TECNICA'
const cidade = (s = '') => norm(String(s).split('/')[0])
function competenciaDistinta(f) {
  const dom = cidade(f.falecido?.ultimo_domicilio)
  if (!dom) return false
  const obito = cidade(f.falecido?.local_obito)
  return (obito && obito !== dom) || bens(f).some((b) => b.tipo === 'imovel' && b.municipio && cidade(b.municipio) !== dom)
}

const PADRAO_INJECAO = /(ignore|ignora|desconsidere)\s+(todas?\s+)?(as\s+)?(regras|instru[cç][õo]es)|declare\s+todos\s+os\s+documentos|ignore\s+previous/i
const textoLivre = (f) => [f.sucessao?.observacoes_livres, ...herdeiros(f).map((h) => h.obs), ...bens(f).map((b) => b.obs)].filter(Boolean).join(' \n ')

function contradiz(d, f) {
  const out = []
  if (d.extraido?.nome && f.falecido?.nome && norm(d.extraido.nome) !== norm(f.falecido.nome)) out.push({ campo: 'nome', rotulo: 'Nome do falecido', declarado: f.falecido.nome, extraido: d.extraido.nome })
  if (d.extraido?.data_obito && f.falecido?.data_obito && d.extraido.data_obito !== f.falecido.data_obito) out.push({ campo: 'data_obito', rotulo: 'Data do óbito', declarado: f.falecido.data_obito, extraido: d.extraido.data_obito })
  return out.length ? out : null
}

export function regrasAtivas(versao = 1) {
  return [...MATRIZ, ...COMPLEMENTARES, ...(versao >= 2 ? LOCAL_V2 : [])]
}

const PRIORIDADE = { aplicavel: 3, indeterminado: 2, nao_aplicavel: 1 }
const ORDEM_SEVERIDADE = { REVISAO_URGENTE: 0, ATENCAO: 1, INFORMATIVO: 2 }
const ORDEM_CLASSE = { ESSENCIAL_PETICAO: 0, CONDICIONAL: 1, RECOMENDADO_LOCAL: 2, FASE_POSTERIOR: 3 }

function statusDoRequisito(q, f, docs, justificativas) {
  if (q.statusFixo) return { status: q.statusFixo }
  if (q.tipo === 'documento') {
    const ds = docs.filter((d) => d.tipo === q.doc)
    if (!ds.length) return { status: 'PENDENTE', detalhe: justificativas[q.id] ? 'Documento ainda não anexado; justificativa registrada para avaliação do profissional responsável.' : 'Documento ainda não anexado.' }
    const uteis = ds.filter(docUtil)
    if (!uteis.length) return { status: 'FALHA_TECNICA', detalhe: 'Último envio rejeitado por motivo técnico; envie novo arquivo.' }
    const d = uteis[uteis.length - 1]
    if (d.legibilidade === 'baixa') return { status: 'PENDENTE', detalhe: 'Arquivo com baixa legibilidade: envie novo arquivo.' }
    return { status: d.status, detalhe: d.desatualizada ? 'Documento possivelmente desatualizado.' : undefined }
  }
  if (q.cumprida?.(f)) return { status: 'INFORMADO' }
  if (justificativas[q.id]) return { status: 'JUSTIFICADO' }
  return { status: q.tipo === 'tarefa' ? 'PENDENTE' : 'NAO_INFORMADO' }
}

export function avaliar(entrada = {}) {
  const f = entrada.formulario || {}
  const docs = arr(entrada.documentos)
  const justificativas = entrada.justificativas || {}
  const naoAplicavel = entrada.nao_aplicavel || {}
  const versao = entrada.rule_version || 1
  const hoje = entrada.hoje ? new Date(entrada.hoje) : new Date()

  const ctx = { docs, hoje, requisitos: [] }
  const reqs = new Map()
  const alertas = []
  const trilha = []

  const addReq = (it, applicable, regra, motivo) => {
    const id = `REQ-${it.chave}`
    const atual = reqs.get(id)
    if (atual) {
      atual.rule_ids.push(regra.id)
      if (PRIORIDADE[applicable] > PRIORIDADE[atual.applicable]) { atual.applicable = applicable; atual.reason = motivo }
      return
    }
    reqs.set(id, { ...it, id, rule_ids: [regra.id], applicable, reason: motivo })
  }

  const rodar = (r) => {
    if (r.tipo === 'acao') { trilha.push({ id: r.id, titulo: r.titulo, base: r.base, resultado: 'acao', onde: r.onde }); return }
    const res = r.avalia(f, ctx)
    trilha.push({ id: r.id, titulo: r.titulo, base: r.base, resultado: res })
    const aplic = res === 'sim' ? 'aplicavel' : res === 'indeterminado' ? 'indeterminado' : 'nao_aplicavel'
    const motivo = res === 'sim' ? `Regra ${r.id}: ${r.titulo}.` : res === 'nao' ? `Regra ${r.id}: ${r.titulo} — resposta "não".` : `Regra ${r.id}: resposta indeterminada ("não sei").`
    arr(r.exige).forEach((it) => addReq(it, aplic, r, motivo))
    if (res === 'nao') arr(r.exigeNao).forEach((it) => addReq(it, 'aplicavel', r, `Regra ${r.id}: ${r.titulo} — resposta "não".`))
    if (r.alertas) r.alertas(f, ctx, res).forEach((a) => alertas.push({ id: `ALT-${r.id}-${a.codigo}${a.sufixo ? '-' + a.sufixo : ''}`, rule_id: r.id, ...a }))
  }

  const ativas = regrasAtivas(versao)
  ativas.filter((r) => !r.pos).forEach(rodar)

  // Status de cada exigência
  const requisitos = []
  for (const q of reqs.values()) {
    const na = naoAplicavel[q.id]
    const base = {
      id: q.id, chave: q.chave, rule_ids: q.rule_ids, rotulo: q.rotulo, porque: q.porque, classe: q.classe,
      fase: q.fase, tipo: q.tipo, doc: q.doc, applicable: q.applicable, reason: q.reason,
    }
    if (na?.motivo) {
      requisitos.push({ ...base, applicable: 'nao_aplicavel', status: 'NAO_APLICAVEL', reason: `Marcado como não aplicável por ${na.autor}: ${na.motivo}`, decisao_manual: true })
      continue
    }
    if (q.applicable === 'nao_aplicavel') { requisitos.push({ ...base, status: 'NAO_APLICAVEL' }); continue }
    const { status, detalhe } = statusDoRequisito(q, f, docs, justificativas)
    requisitos.push({ ...base, status, detalhe, justificada: !!justificativas[q.id] })
  }
  ctx.requisitos = requisitos

  // Regras que dependem das exigências já avaliadas (JUR-033)
  ativas.filter((r) => r.pos).forEach(rodar)

  requisitos.sort((a, b) => (ORDEM_CLASSE[a.classe] ?? 9) - (ORDEM_CLASSE[b.classe] ?? 9) || a.rotulo.localeCompare(b.rotulo))
  alertas.sort((a, b) => ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade])

  const base = requisitos.filter((q) => q.applicable === 'aplicavel' && ['ESSENCIAL_PETICAO', 'CONDICIONAL'].includes(q.classe))
  const atendidos = base.filter((q) => ATENDIDOS.has(q.status)).length
  const porSeveridade = { REVISAO_URGENTE: 0, ATENCAO: 0, INFORMATIVO: 0 }
  alertas.forEach((a) => { porSeveridade[a.severidade] += 1 })

  return {
    evaluation_version: `${versaoRotulo(versao)}#${trilha.length}`,
    rule_version: versaoRotulo(versao),
    gerado_em: hoje.toISOString(),
    requirements: requisitos,
    alerts: alertas,
    regras: trilha,
    resumo: {
      exigencias_base: base.length,
      atendidas: atendidos,
      pendentes: base.length - atendidos,
      justificadas: base.filter((q) => q.justificada && !ATENDIDOS.has(q.status)).length,
      percentual: base.length ? Math.round((atendidos / base.length) * 100) : 0,
      alertas: porSeveridade,
      regras_avaliadas: trilha.filter((r) => r.resultado !== 'acao').length,
    },
  }
}

// Pendências derivadas da avaliação (seção 7: ABERTA → ... → RESOLVIDA/DISPENSADA_COM_MOTIVO).
export function derivarPendencias(avaliacao) {
  if (!avaliacao) return []
  const lista = []
  avaliacao.requirements
    .filter((q) => q.applicable === 'aplicavel' && ['ESSENCIAL_PETICAO', 'CONDICIONAL'].includes(q.classe) && !ATENDIDOS.has(q.status) && !['ANEXADO', 'EM_ANALISE'].includes(q.status))
    .forEach((q) => lista.push({ id: q.id, origem: 'exigencia', titulo: q.rotulo, detalhe: q.detalhe || q.porque, classe: q.classe, severidade: q.classe === 'ESSENCIAL_PETICAO' ? 'ATENCAO' : 'INFORMATIVO', status_item: q.status, justificada: q.justificada, rule_ids: q.rule_ids }))
  avaliacao.alerts
    .filter((a) => a.revisao)
    .forEach((a) => lista.push({ id: a.id, origem: 'alerta', titulo: a.mensagem, detalhe: a.fontes ? 'Há fontes em conflito — veja Análise IA.' : '', severidade: a.severidade, rule_ids: [a.rule_id], fontes: a.fontes }))
  return lista
}
