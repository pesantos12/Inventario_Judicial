// Validação técnica de upload (JUR-032; teste T10). Verifica tamanho, extensão e assinatura (bytes iniciais).
// NÃO inclui varredura de malware: isso é funcionalidade planejada (antivírus/sandbox), não simulada aqui.

import crypto from 'node:crypto'

export const MAX_BYTES = 10 * 1024 * 1024

const TIPOS = {
  pdf: { mime: ['application/pdf'], assinatura: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  png: { mime: ['image/png'], assinatura: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  jpg: { mime: ['image/jpeg'], assinatura: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
}
TIPOS.jpeg = TIPOS.jpg

export const nomeSeguro = (nome = 'arquivo') => String(nome).split(/[\\/]/).pop().replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '_').slice(0, 120) || 'arquivo'

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

/** Retorna { ok: true } ou { ok: false, codigo, motivo }. */
export function validarArquivo({ nome, mime, buffer }) {
  if (!buffer || buffer.length === 0) return { ok: false, codigo: 'vazio', motivo: 'Arquivo vazio.' }
  if (buffer.length > MAX_BYTES) return { ok: false, codigo: 'tamanho', motivo: `Arquivo acima do limite de ${MAX_BYTES / 1024 / 1024} MB.` }
  const ext = (nome.split('.').pop() || '').toLowerCase()
  const tipo = TIPOS[ext]
  if (!tipo) return { ok: false, codigo: 'tipo_nao_permitido', motivo: `Tipo de arquivo não permitido (.${ext || '?'}). Envie PDF, PNG ou JPG.` }
  if (mime && !tipo.mime.includes(mime) && mime !== 'application/octet-stream') return { ok: false, codigo: 'mime_incompativel', motivo: `O tipo informado (${mime}) não corresponde à extensão .${ext}.` }
  if (!tipo.assinatura(buffer)) return { ok: false, codigo: 'arquivo_corrompido', motivo: 'O conteúdo não corresponde ao formato declarado (arquivo corrompido ou renomeado).' }
  return { ok: true }
}
