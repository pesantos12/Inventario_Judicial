// Utilitários HTTP das rotas. Usa apenas Request/Response padrão (sem depender de next/server),
// o que permite chamar os handlers diretamente nos testes.

export class HttpError extends Error {
  constructor(status, codigo, mensagem, extra = {}) {
    super(mensagem)
    this.status = status
    this.codigo = codigo
    this.extra = extra
  }
}

export const json = (dados, status = 200) => Response.json(dados, { status })

/** Envolve um handler: erros conhecidos viram JSON com o status certo; o resto vira 500 sem vazar detalhes. */
export const rota = (fn) => async (req, ctx = { params: {} }) => {
  try {
    return await fn(req, ctx)
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ erro: e.codigo, mensagem: e.message, ...e.extra }, { status: e.status })
    console.error('[api] erro inesperado:', e)
    return Response.json({ erro: 'interno', mensagem: 'Erro interno do servidor.' }, { status: 500 })
  }
}

export async function corpoJson(req) {
  try {
    const t = await req.text()
    if (t.length > 400_000) throw new HttpError(422, 'corpo_grande', 'O corpo da requisição excede o limite permitido.')
    return t ? JSON.parse(t) : {}
  } catch (e) {
    if (e instanceof HttpError) throw e
    throw new HttpError(422, 'json_invalido', 'O corpo da requisição não é um JSON válido.')
  }
}
