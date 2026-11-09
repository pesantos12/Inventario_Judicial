// Persistência simulada: um arquivo JSON local (data/db.json) + uploads em data/uploads.
// Em produção isto seria um banco de dados; aqui basta para demonstrar persistência (especificação, seção 1).
// Um único processo Node atende o protótipo, então a leitura-modificação-gravação síncrona é segura.

import fs from 'node:fs'
import path from 'node:path'

const dir = () => process.env.INVENTARIO_DATA_DIR || path.join(process.cwd(), 'data')
const arquivo = () => path.join(dir(), 'db.json')
export const dirUploads = () => path.join(dir(), 'uploads')

const vazio = () => ({
  seq: 0,
  casos: {},
  avaliacoes: [],
  seguranca: [],
  settings: { ia_disponivel: true, regras_publicada: 1, historico: [] },
})

export function ler() {
  try {
    return { ...vazio(), ...JSON.parse(fs.readFileSync(arquivo(), 'utf8')) }
  } catch {
    return vazio()
  }
}

export function gravar(db) {
  fs.mkdirSync(dir(), { recursive: true })
  const tmp = `${arquivo()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
  fs.renameSync(tmp, arquivo())
}

/** Lê, aplica fn e grava. Se fn lançar erro, nada é gravado. */
export function transacao(fn) {
  const db = ler()
  try {
    const resultado = fn(db)
    gravar(db)
    return resultado
  } catch (e) {
    // Erros marcados com persistir (ex.: tentativa de acesso negado) gravam o registro de segurança mesmo assim.
    if (e && e.persistir) gravar(db)
    throw e
  }
}
