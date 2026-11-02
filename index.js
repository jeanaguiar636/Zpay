export async function onRequestGet({request, env}){
  try{
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS withdrawals (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, pix_type TEXT, pix_key TEXT, amount_zp REAL, amount_brl REAL, status TEXT, created_at TEXT)").run(); }catch{}
    const rows = await env.DB.prepare("SELECT w.*, u.email FROM withdrawals w LEFT JOIN users u ON w.user_id=u.id ORDER BY w.created_at DESC").all();
    return Response.json({ok:true, withdrawals: rows.results||[]});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
