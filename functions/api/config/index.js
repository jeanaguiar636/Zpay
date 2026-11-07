
// API Config - Bônus Iniciante
// GET /api/admin/config -> retorna bônus atual
// POST /api/admin/config {bonus: 5000} -> salva bônus
export async function onRequestGet({env}){
  try{
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT)").run(); }catch{}
    let bonus = 500;
    try{
      const row = await env.DB.prepare("SELECT value FROM config WHERE key='bonus_iniciante'").first();
      if(row) bonus = parseInt(row.value);
      else {
        const row2 = await env.DB.prepare("SELECT value FROM config WHERE key='welcome_bonus'").first();
        if(row2) bonus = parseInt(row2.value);
      }
    }catch{}
    return Response.json({ok:true, bonus, bonus_iniciante: bonus, welcome_bonus: bonus});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}

export async function onRequestPost({request, env}){
  try{
    const body = await request.json().catch(()=>({}));
    const bonus = parseInt(body.bonus ?? body.bonus_iniciante ?? body.welcome_bonus ?? body.value ?? 0);
    if(!bonus || bonus < 0) return Response.json({error:"Bônus inválido! Digita um número tipo 500, 1000, 5000"}, {status:400});
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)").run(); }catch{}
    await env.DB.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('bonus_iniciante', ?)").bind(String(bonus)).run();
    await env.DB.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('welcome_bonus', ?)").bind(String(bonus)).run();
    // Também salva na app_config se existir
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT)").run();
      await env.DB.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('bonus_iniciante', ?)").bind(String(bonus)).run();
    }catch{}
    return Response.json({ok:true, bonus, message:`✅ Bônus iniciante salvo! Agora quem cadastrar ganha ZP$ ${bonus}`});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
