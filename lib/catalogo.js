// Catálogo de tipos usados nos formulários e nos documentos.

export const DOC_TIPOS = {
  certidao_obito: 'Certidão de óbito',
  identificacao_requerente: 'Identificação do requerente (RG/CPF)',
  procuracao: 'Procuração / representação',
  certidao_casamento: 'Certidão de casamento',
  prova_uniao_estavel: 'Prova de união estável',
  pacto_antenupcial: 'Pacto antenupcial',
  certidoes_vinculo: 'Certidões de vínculo familiar',
  identificacao_herdeiros: 'Identidade/CPF dos herdeiros',
  certidao_nascimento: 'Certidão de nascimento',
  identificacao_representante: 'Identificação do representante/assistente',
  testamento: 'Testamento (cópia/atos)',
  consulta_testamento: 'Consulta/certidão de testamento',
  matricula_imovel: 'Matrícula do imóvel',
  titulo_aquisitivo: 'Título aquisitivo do imóvel',
  onus_dados_fiscais: 'Ônus e dados fiscais do imóvel',
  certidao_fiscal_imovel: 'Certidão de regularidade fiscal do imóvel',
  crlv_veiculo: 'CRLV / registro do veículo',
  extrato_bancario: 'Extratos e saldos bancários',
  contrato_social: 'Contrato social e alterações',
  comprovante_divida: 'Comprovante da dívida',
  instrumento_doacao: 'Instrumento de doação',
  instrumento_renuncia: 'Instrumento de renúncia',
  instrumento_cessao: 'Instrumento de cessão de direitos',
  certidao_fiscal: 'Documentos de exigência fiscal (regra local)',
  comprovante_itcmd: 'Comprovante de ITCMD (pago ou dispensado)',
  compromisso_inventariante: 'Termo de compromisso do inventariante',
  foto_imovel: 'Fotografia de imóvel',
  outro: 'Outro documento',
}

export const PARENTESCOS = [
  { valor: 'filho', rotulo: 'Filho(a)' },
  { valor: 'neto', rotulo: 'Neto(a)' },
  { valor: 'ascendente', rotulo: 'Ascendente (pai/mãe/avô)' },
  { valor: 'colateral', rotulo: 'Colateral (irmão/sobrinho)' },
  { valor: 'conjuge', rotulo: 'Cônjuge/companheiro(a)' },
  { valor: 'legatario', rotulo: 'Legatário' },
  { valor: 'outro', rotulo: 'Outro interessado' },
]

export const SITUACOES_VIDA = [
  { valor: 'vivo', rotulo: 'Vivo' },
  { valor: 'pre_morto', rotulo: 'Pré-morto (faleceu antes do autor da herança)' },
  { valor: 'pos_morto', rotulo: 'Pós-morto (faleceu depois, antes da abertura)' },
  { valor: 'desconhecido', rotulo: 'Desconhecido' },
]

export const CAPACIDADES = [
  { valor: 'maior', rotulo: 'Maior (capaz, conforme declarado)' },
  { valor: 'menor', rotulo: 'Menor de idade' },
  { valor: 'incapacidade_alegada', rotulo: 'Incapacidade alegada' },
  { valor: 'desconhecido', rotulo: 'Desconhecido' },
]

export const TIPOS_BEM = [
  { valor: 'imovel', rotulo: 'Imóvel' },
  { valor: 'veiculo', rotulo: 'Veículo' },
  { valor: 'conta', rotulo: 'Conta / investimento' },
  { valor: 'quotas', rotulo: 'Quotas societárias' },
  { valor: 'digital', rotulo: 'Bem digital' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const ESTADOS_CIVIS = [
  { valor: '', rotulo: 'Não informado' },
  { valor: 'solteiro', rotulo: 'Solteiro(a)' },
  { valor: 'casado', rotulo: 'Casado(a)' },
  { valor: 'divorciado', rotulo: 'Divorciado(a)' },
  { valor: 'viuvo', rotulo: 'Viúvo(a)' },
  { valor: 'uniao_estavel', rotulo: 'União estável' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const REGIMES = [
  { valor: '', rotulo: 'Não informado' },
  { valor: 'comunhao_parcial', rotulo: 'Comunhão parcial' },
  { valor: 'comunhao_universal', rotulo: 'Comunhão universal' },
  { valor: 'separacao', rotulo: 'Separação de bens' },
  { valor: 'participacao_final', rotulo: 'Participação final nos aquestos' },
  { valor: 'desconhecido', rotulo: 'Desconhecido' },
]

export const QUALIDADES = [
  { valor: 'conjuge', rotulo: 'Cônjuge/companheiro(a)' },
  { valor: 'herdeiro', rotulo: 'Herdeiro(a)' },
  { valor: 'credor', rotulo: 'Credor' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const rotuloDe = (lista, valor) => lista.find((i) => i.valor === valor)?.rotulo || valor || '—'

export const CLASSES_CASO = {
  1: 'Cônjuge sobrevivente e patrimônio simples',
  2: 'Documentos faltantes e qualidade dos anexos',
  3: 'Herdeiros maiores e concordância',
  4: 'Bens e documentação patrimonial',
  5: 'Regime de bens e datas de aquisição',
  6: 'Herdeiros menores e representação',
  7: 'Falecimento de herdeiro e representação sucessória',
  8: 'Testamento e consulta a registros',
  9: 'Dívidas, credores e passivo',
  10: 'Tributos e competência territorial',
  11: 'Bens omitidos, desconhecidos e descobertos depois',
  12: 'Procuração e legitimidade de atuação',
  13: 'Filiação, parentesco e controvérsias',
  14: 'Bens no exterior e direitos complexos',
  15: 'Renúncia, cessão e doações anteriores',
  16: 'Dados contraditórios e ataques à IA',
  17: 'Cronologia, prazo e estágio do procedimento',
  18: 'Sucessões simultâneas e casos-limite',
}

export const nivelDaClasse = (n) => (n <= 4 ? 'Básico' : n <= 12 ? 'Intermediário' : 'Avançado')
