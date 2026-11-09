'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/cliente'

/**
 * Edita listas do formulário (herdeiros, bens, dívidas) em rascunho local e salva tudo de uma vez
 * com a versão do caso (conflito → 409, recarrega). Campos desconhecidos de cada item são preservados.
 */
export default function useLista(caso, recarregar, chaves, prefixo) {
  const origem = useMemo(() => Object.fromEntries(chaves.map((k) => [k, (caso.formulario[k] || []).map((x, i) => ({ ...x, id: x.id || `${prefixo[k]}${i + 1}` }))])), [caso, chaves, prefixo])
  const [listas, setListas] = useState(origem)
  const [msg, setMsg] = useState(null)
  const [salvando, setSalvando] = useState(false)
  useEffect(() => { setListas(origem) }, [origem])

  const alterado = JSON.stringify(listas) !== JSON.stringify(origem)
  const mudar = (k, id, campo, v) => setListas((l) => ({ ...l, [k]: l[k].map((x) => (x.id === id ? { ...x, [campo]: v } : x)) }))
  const adicionar = (k, novo) => setListas((l) => ({ ...l, [k]: [...l[k], { id: `${prefixo[k]}${Date.now().toString(36)}`, ...novo }] }))
  const remover = (k, id) => setListas((l) => ({ ...l, [k]: l[k].filter((x) => x.id !== id) }))

  const salvar = async () => {
    setSalvando(true); setMsg(null)
    try {
      await api(`/cases/${caso.id}`, { method: 'PATCH', body: { version: caso.version, op: 'formulario', dados: listas } })
      setMsg({ tipo: 'ok', texto: 'Alterações salvas e avaliação atualizada.' })
      await recarregar()
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e.status === 409 ? 'O caso foi alterado em outra aba ou por outra pessoa. Recarreguei a versão atual; refaça sua edição.' : e.message })
      if (e.status === 409) recarregar()
    }
    setSalvando(false)
  }
  return { listas, alterado, mudar, adicionar, remover, salvar, salvando, msg }
}
