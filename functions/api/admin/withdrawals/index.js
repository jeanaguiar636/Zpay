export async function onRequestGet({request, env}){
  try{
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS withdrawals (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, pix_type TEXT, pix_key TEXT, amount_zp REAL, amount_brl REAL, status TEXT, created_at TEXT)").run(); }catch{}
    // Primeiro tenta sem JOIN pra garantir que mostra mesmo se user não existe
    let rows;
    try{
      rows = await env.DB.prepare("SELECT * FROM withdrawals ORDER BY created_at DESC LIMIT 100").all();
    }catch(e){
      rows = {results:[]};
    }
    // Tenta com email
    try{
      const rowsWithEmail = await env.DB.prepare("SELECT w.*, u.email FROM withdrawals w LEFT JOIN users u ON w.user_id=u.id ORDER BY w.created_at DESC LIMIT 100").all();
      if(rowsWithEmail.results && rowsWithEmail.results.length>0){
        rows = rowsWithEmail;
      }
    }catch{}
    return Response.json({ok:true, withdrawals: rows.results||[], count: rows.results?.length||0});
  }catch(e){
    return Response.json({error:e.message, stack:e.stack}, {status:500});
  }
}
