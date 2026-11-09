// AUTENTICAÇÃO SIMULADA. Identifica o usuário pelo cabeçalho x-user-id e NÃO verifica credenciais.
// Serve para demonstrar autorização por perfil e por caso (especificação, seções 4 e 11; teste T16).
// Em produção seria substituída por autenticação real (sessão/JWT), mantendo a mesma checagem por caso e perfil.

import { HttpError } from './http'
import { PERFIS, perfilPode } from '../estados'

export const USUARIOS = {
  'u-ana': { id: 'u-ana', nome: 'Ana Beatriz Ramos', perfil: 'advogado', escritorio: 'A' },
  'u-carla': { id: 'u-carla', nome: 'Carla Mendes', perfil: 'assistente', escritorio: 'A' },
  'u-admin': { id: 'u-admin', nome: 'Administrador do sistema', perfil: 'administrador', escritorio: 'A' },
  'u-rafael': { id: 'u-rafael', nome: 'Rafael Teixeira', perfil: 'advogado', escritorio: 'B' },
}

export function usuarioDe(req) {
  const u = USUARIOS[req.headers.get('x-user-id')]
  if (!u) throw new HttpError(401, 'nao_autenticado', 'Identifique-se para continuar.')
  return u
}

export function exigir(user, acao, mensagem) {
  if (!perfilPode(user.perfil, acao)) {
    throw new HttpError(403, 'sem_permissao', mensagem || `O perfil ${PERFIS[user.perfil]?.rotulo || user.perfil} não pode executar esta ação.`, { acao })
  }
}

/** Autorização por caso (dono, mesmo escritório ou compartilhado): o administrador não acessa dados do caso (especificação, seção 4). */
export const podeVerCaso = (caso, user) => user.perfil !== 'administrador' && (caso.owner === user.id || caso.escritorio === user.escritorio || (caso.compartilhado_com || []).includes(user.id))
