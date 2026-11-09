'use client'

import { useState } from 'react'
import Selo from '@/components/Selo'
import { api } from '@/lib/cliente'
import { PENDENCIA_ORDEM, perfilPode } from '@/lib/estados'

const FINAIS = ['RESOLVIDA', 'DISPENSADA_COM_MOTIVO']

/** Controle de tratamento de uma pendência (ABERTA → ... → RESOLVIDA / DISPENSADA_COM_MOTIVO). */
export default function Tratamento({ caso, alerta, pend, user, recarregar }) {
  const [aberto, setAberto] = useState(false)
  const [estado, setEstado] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const atual = pend?.tratamento.estado || 'ABERTA'
  const proximos = PENDENCIA_ORDEM.filter((e, i) => i > PENDENCIA_ORDEM.indexOf(atual) || (e.startsWith('RESOL') || e.startsWith('DISP')))
    .filter((e) => e !== atual && (e !== 'DISPENSADA_COM_MOTIVO' || perfilPode(user.perfil, 'dispensar_pendencia')))
  if (!pend) return null
  const enviar = async () => {
    setErro('')
    try { await api(`/cases/${caso.id}`, { method: 'PATCH', body: { version: caso.version, op: 'pendencia', pendencia: alerta.id, estado, motivo } }); setAberto(false); setMotivo(''); recarregar() }
    catch (e) { setErro(e.message); if (e.status === 409) recarregar() }
  }
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <Selo estado={atual} />
        {pend.tratamento.reason && <span className="text-xs text-slate">{pend.tratamento.reason}</span>}
        {!FINAIS.includes(atual) && perfilPode(user.perfil, 'editar') && <button onClick={() => { setAberto(!aberto); setEstado(proximos[0]) }} className="rounded-sm border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5">Tratar alerta</button>}
      </div>
      {aberto && (
        <div className="mt-2 space-y-2 rounded-sm border border-ink/15 bg-white/70 p-3">
          <label htmlFor={`e-${alerta.id}`} className="block text-sm font-medium text-ink">Novo estado</label>
          <select id={`e-${alerta.id}`} value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-sm border border-ink/15 bg-white px-2 py-1.5 text-sm">
            {proximos.map((e) => <option key={e} value={e}>{e.replaceAll('_', ' ').toLowerCase()}</option>)}
          </select>
          <label htmlFor={`m-${alerta.id}`} className="block text-sm font-medium text-ink">Motivo {estado === 'RESOLVIDA' || estado === 'DISPENSADA_COM_MOTIVO' ? '(obrigatório)' : '(opcional)'}</label>
          <textarea id={`m-${alerta.id}`} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded-sm border border-ink/15 bg-white px-3 py-2 text-sm" />
          {erro && <p role="alert" className="text-xs text-selo-danger">{erro}</p>}
          <div className="flex gap-2">
            <button onClick={enviar} className="rounded-sm bg-ink px-3 py-1.5 text-sm text-parchment">Registrar</button>
            <button onClick={() => setAberto(false)} className="rounded-sm border border-ink/20 px-3 py-1.5 text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

