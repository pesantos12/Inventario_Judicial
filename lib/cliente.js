'use client'
// Utilitários do navegador: usuário simulado, caso atual e chamadas à API simulada.

export const USUARIOS = [
  { id: 'u-ana', nome: 'Ana Beatriz Ramos', perfil: 'advogado', rotulo: 'Advogada' },
  { id: 'u-carla', nome: 'Carla Mendes', perfil: 'assistente', rotulo: 'Assistente jurídica' },
  { id: 'u-admin', nome: 'Administrador', perfil: 'administrador', rotulo: 'Administrador' },
  { id: 'u-rafael', nome: 'Rafael Teixeira', perfil: 'advogado', rotulo: 'Advogado (outro escritório)' },
]

const guarda = {
  ler(k, padrao) { try { return window.localStorage.getItem(k) || padrao } catch { return padrao } },
  gravar(k, v) { try { v == null ? window.localStorage.removeItem(k) : window.localStorage.setItem(k, v) } catch {} },
}

export const usuarioAtual = () => USUARIOS.find((u) => u.id === guarda.ler('inv:user', 'u-ana')) || USUARIOS[0]
export const trocarUsuario = (id) => { guarda.gravar('inv:user', id); guarda.gravar('inv:caso', null); window.location.href = '/central' }
export const casoAtualId = () => guarda.ler('inv:caso', null)
export const definirCaso = (id) => guarda.gravar('inv:caso', id)

/** Chamada à API. Lança Error com .status e .dados quando a resposta não é 2xx. */
export async function api(caminho, { method = 'GET', body, form } = {}) {
  const headers = { 'x-user-id': usuarioAtual().id }
  const init = { method, headers }
  if (form) init.body = form
  else if (body !== undefined) { init.body = JSON.stringify(body); headers['content-type'] = 'application/json' }
  const r = await fetch(`/api${caminho}`, init)
  const dados = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(dados.mensagem || `Erro ${r.status}`), { status: r.status, dados })
  return dados
}
