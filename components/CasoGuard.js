'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import Card from '@/components/Card'
import { api, usuarioAtual, casoAtualId } from '@/lib/cliente'

/** Carrega o caso aberto e entrega { caso, user, recarregar } ao filho. Trata ausência de caso, acesso negado e erro. */
export default function CasoGuard({ children }) {
  const [user, setUser] = useState(null)
  const [id, setId] = useState(undefined)
  const [caso, setCaso] = useState(null)
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    const c = casoAtualId()
    if (!c) return null
    try { const d = await api(`/cases/${c}`); setCaso(d); setErro(''); return d } catch (e) { setErro(e.message); return null }
  }, [])

  useEffect(() => { setUser(usuarioAtual()); setId(casoAtualId()) }, [])
  useEffect(() => { if (id) recarregar() }, [id, recarregar])

  if (!user || id === undefined) return <p className="text-sm text-slate">Carregando…</p>
  if (user.perfil === 'administrador') return <Card><p className="text-sm text-ink">O perfil administrador não acessa dados de casos.</p></Card>
  if (!id) return <Card><p className="text-sm text-ink">Nenhum caso aberto. <Link href="/central" className="underline">Abra ou crie um caso na Central</Link>.</p></Card>
  if (erro && !caso) return <p role="alert" className="text-sm text-selo-danger">{erro}</p>
  if (!caso) return <p className="text-sm text-slate">Carregando caso…</p>
  return children({ caso, user, recarregar, setCaso })
}
