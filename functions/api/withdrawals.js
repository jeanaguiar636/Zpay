export async function onRequestPost({request, env}){
  try{
    const token=(request.headers.get("Authorization")||"").replace("Bearer ","");
    const sess=await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:'Sem login'}, {status:401});
    const {name, pix_type, pix_key, amount_zp} = await request.json();
    const user=await env.DB.prepare("SELECT email FROM users WHERE id=?").bind(sess.user_id).first();
    const id=crypto.randomUUID();
    const amount_brl = (amount_zp*0.01).toFixed(2);
    try{await env.DB.prepare("CREATE TABLE IF NOT EXISTS withdrawals (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, email TEXT, pix_type TEXT, pix_key TEXT, amount_zp REAL, amount_brl REAL, status TEXT, created_at TEXT)").run();}catch{}
    await env.DB.prepare("INSERT INTO withdrawals (id, user_id, name, email, pix_type, pix_key, amount_zp, amount_brl, status, created_at) VALUES (?,?,?,?,?,?,?,?, 'pending', datetime('now'))").bind(id, sess.user_id, name, user?.email||'', pix_type, pix_key, amount_zp, amount_brl).run();
    return Response.json({ok:true, id, amount_brl});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
