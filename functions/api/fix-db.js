
// GET /api/fix-db - VISITA ESSA URL UMA VEZ E O ERRO SOME!
// https://agropay.pages.dev/api/fix-db
export async function onRequestGet({env}){
  const resultados = [];
  const colunas = [
    "mp_preapproval_id TEXT",
    "mp_preference_id TEXT",
    "mp_payment_id TEXT",
    "affiliate_code TEXT",
    "affiliate_user_id TEXT",
    "amount_brl REAL",
    "expires_at TEXT",
    "status TEXT",
    "plan TEXT",
    "created_at TEXT",
    "user_id TEXT"
  ];
  // Garante que tabela existe
  try{
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, user_id TEXT, plan TEXT, amount_brl REAL, status TEXT, mp_preference_id TEXT, mp_preapproval_id TEXT, mp_payment_id TEXT, affiliate_code TEXT, affiliate_user_id TEXT, created_at TEXT, expires_at TEXT)").run();
    resultados.push("Tabela subscriptions OK");
  }catch(e){ resultados.push("Erro criar tabela: "+e.message); }

  for(const col of colunas){
    try{
      await env.DB.prepare(`ALTER TABLE subscriptions ADD COLUMN ${col}`).run();
      resultados.push("✅ Adicionou coluna: "+col);
    }catch(e){
      resultados.push("Já existe (ok): "+col);
    }
  }

  // Verifica colunas agora
  let colsAtuais = [];
  try{
    const pragma = await env.DB.prepare("PRAGMA table_info(subscriptions)").all();
    colsAtuais = (pragma.results||[]).map(r=>r.name);
  }catch(e){ colsAtuais = ["erro: "+e.message]; }

  return Response.json({
    ok: true,
    message: "Banco consertado! Agora pode assinar Premium sem erro!",
    resultados,
    colunas_agora: colsAtuais,
    proximo_passo: "Volta pra planos.html e clica ASSINAR PREMIUM de novo"
  });
}
