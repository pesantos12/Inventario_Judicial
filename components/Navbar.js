'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { USUARIOS, usuarioAtual, trocarUsuario, casoAtualId } from '@/lib/cliente'

const ITENS = [
  { rotulo: 'Central', href: '/central' },
  { rotulo: 'Documentação', href: '/documentos' },
  { rotulo: 'Herdeiros', href: '/herdeiros' },
  { rotulo: 'Patrimônio', href: '/patrimonio' },
  { rotulo: 'Árvore Genealógica', href: '/arvore-genealogica' },
  { rotulo: 'Análise IA', href: '/analise-ia' },
  { rotulo: 'Pendências', href: '/pendencias' },
  { rotulo: 'Revisão', href: '/revisao' },
  { rotulo: 'Histórico', href: '/historico' },
  { rotulo: 'Casos de teste', href: '/casos-teste' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [casoId, setCasoId] = useState(null)

  useEffect(() => {
    setUser(usuarioAtual())
    setCasoId(casoAtualId())
  }, [])

  const iniciais = user ? user.nome.split(' ').map((p) => p[0]).slice(0, 2).join('') : ''

  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-parchment/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/central" className="shrink-0">
          <p className="font-display text-lg font-semibold leading-none text-ink">Inventário</p>
          <p className="font-mono text-[10px] tracking-wide text-slate">{casoId ? `Caso ${casoId}` : 'Nenhum caso aberto'}</p>
        </Link>

        <nav className="hidden flex-1 flex-wrap items-center gap-x-0.5 gap-y-1 md:flex">
          {ITENS.map((item) => {
            const ativo = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className={`rounded-sm px-2.5 py-1.5 text-[13px] transition-colors ${ativo ? 'bg-ink text-parchment' : 'text-ink/70 hover:bg-ink/5 hover:text-ink'}`}>
                {item.rotulo}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <label className="sr-only" htmlFor="usuario">Usuário simulado</label>
            <select
              id="usuario"
              value={user?.id || ''}
              onChange={(e) => trocarUsuario(e.target.value)}
              className="rounded-sm border border-ink/15 bg-white/70 px-2 py-1 text-sm text-ink"
            >
              {USUARIOS.map((u) => (<option key={u.id} value={u.id}>{u.nome}</option>))}
            </select>
            <p className="mt-0.5 text-xs text-slate">{user?.rotulo} · login simulado</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-bronze/50 bg-bronze/10 font-display text-sm text-bronze-dark">{iniciais}</div>
        </div>
      </div>
    </header>
  )
}
