// Vocabulário de estados da especificação (seções 3 e 7).
// "Aceito" significa apenas aceitação organizacional — nunca validade jurídica.

export const ESTADOS = {
  // Documento
  NAO_APLICAVEL: { rotulo: 'Não aplicável', tom: 'neutro' },
  PENDENTE: { rotulo: 'Pendente', tom: 'alerta' },
  ANEXADO: { rotulo: 'Anexado', tom: 'bronze' },
  EM_ANALISE: { rotulo: 'Em análise', tom: 'bronze' },
  CLASSIFICADO: { rotulo: 'Classificado', tom: 'bronze' },
  DIVERGENTE: { rotulo: 'Divergente', tom: 'perigo' },
  REVISADO: { rotulo: 'Revisado', tom: 'sucesso' },
  ACEITO_PARA_ORGANIZACAO: { rotulo: 'Aceito p/ organização', tom: 'sucesso' },
  FALHA_TECNICA: { rotulo: 'Falha técnica', tom: 'perigo' },

  // Campo
  NAO_INFORMADO: { rotulo: 'Não informado', tom: 'alerta' },
  INFORMADO: { rotulo: 'Informado', tom: 'bronze' },
  JUSTIFICADO: { rotulo: 'Justificado', tom: 'bronze' },
  CONFIRMADO_PELO_USUARIO: { rotulo: 'Confirmado', tom: 'sucesso' },

  // Pendência
  ABERTA: { rotulo: 'Aberta', tom: 'alerta' },
  ATRIBUIDA: { rotulo: 'Atribuída', tom: 'bronze' },
  EM_TRATAMENTO: { rotulo: 'Em tratamento', tom: 'bronze' },
  RESOLVIDA: { rotulo: 'Resolvida', tom: 'sucesso' },
  DISPENSADA_COM_MOTIVO: { rotulo: 'Dispensada c/ motivo', tom: 'neutro' },

  // Processo
  RASCUNHO: { rotulo: 'Rascunho', tom: 'neutro' },
  PRONTO_PARA_REVISAO: { rotulo: 'Pronto p/ revisão', tom: 'bronze' },
  PROTOCOLO_EXTERNO_REGISTRADO: { rotulo: 'Protocolo registrado', tom: 'bronze' },
  ACOMPANHAMENTO: { rotulo: 'Acompanhamento', tom: 'bronze' },
  ENCERRADO: { rotulo: 'Encerrado', tom: 'sucesso' },

  // Severidade de alerta
  INFORMATIVO: { rotulo: 'Informativo', tom: 'neutro' },
  ATENCAO: { rotulo: 'Atenção', tom: 'alerta' },
  REVISAO_URGENTE: { rotulo: 'Revisão urgente', tom: 'perigo' },

  // Classe de exigência
  ESSENCIAL_PETICAO: { rotulo: 'Essencial à petição', tom: 'perigo' },
  CONDICIONAL: { rotulo: 'Condicional', tom: 'bronze' },
  FASE_POSTERIOR: { rotulo: 'Fase posterior', tom: 'neutro' },
  RECOMENDADO_LOCAL: { rotulo: 'Conferir regra local', tom: 'alerta' },

  // Rótulos técnicos
  SIMULADO: { rotulo: 'Simulado', tom: 'simulado' },
  BAIXA_LEGIBILIDADE: { rotulo: 'Baixa legibilidade', tom: 'alerta' },
  QUARENTENA: { rotulo: 'Quarentena', tom: 'alerta' },
}

// Documento/campo considerado atendido para fins de progresso do checklist.
// JUSTIFICADO fica de fora de propósito: justificar uma ausência permite seguir com o rascunho,
// mas não torna o documento presente (a suficiência é avaliada pelo profissional).
export const ATENDIDOS = new Set([
  'CLASSIFICADO',
  'REVISADO',
  'ACEITO_PARA_ORGANIZACAO',
  'INFORMADO',
  'CONFIRMADO_PELO_USUARIO',
])

export const EM_ANDAMENTO = new Set(['ANEXADO', 'EM_ANALISE'])

export const FASES = {
  cadastro: 'Cadastro / petição inicial',
  primeiras_declaracoes: 'Primeiras declarações',
  avaliacao: 'Avaliação',
  tributos: 'Tributos (ITCMD)',
  partilha: 'Partilha',
  encerramento: 'Encerramento',
}

export const PROCESSO_ORDEM = [
  'RASCUNHO',
  'PRONTO_PARA_REVISAO',
  'REVISADO',
  'PROTOCOLO_EXTERNO_REGISTRADO',
  'ACOMPANHAMENTO',
  'ENCERRADO',
]

export const PENDENCIA_ORDEM = [
  'ABERTA',
  'ATRIBUIDA',
  'EM_TRATAMENTO',
  'RESOLVIDA',
  'DISPENSADA_COM_MOTIVO',
]

export const MENSAGENS = {
  A: 'Documento ainda não anexado. Você pode registrar a justificativa e continuar preparando o pedido; a necessidade de apresentação será analisada pelo profissional responsável.',
  B: 'Os dados do arquivo não coincidem com o formulário. Confira as informações antes de continuar.',
  C: 'Situação sucessória que exige análise jurídica especializada. A plataforma não determina automaticamente os direitos dos interessados.',
  D: 'Este resultado é uma sugestão automatizada e depende de confirmação humana.',
}

// Perfis e permissões (seção 4 da especificação).
export const PERFIS = {
  advogado: { rotulo: 'Advogado(a)', acoes: ['editar', 'anexar', 'justificar', 'revisar', 'exportar', 'registrar_protocolo', 'nao_aplicavel', 'fase', 'aceitar_documento', 'dispensar_pendencia'] },
  assistente: { rotulo: 'Assistente jurídico', acoes: ['editar', 'anexar', 'justificar'] },
  administrador: { rotulo: 'Administrador', acoes: ['regras'] },
}

export function perfilPode(perfil, acao) {
  return !!PERFIS[perfil]?.acoes.includes(acao)
}
