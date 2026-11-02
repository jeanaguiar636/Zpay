export async function onRequestPost({request, env}){
  const auth = request.headers.get("Authorization")||"";
  const token = auth.replace("Bearer ","").trim();
  if(!token) return Response.json({error:"Sem token"}, {status:401});
  try{
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS withdrawals (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, pix_type TEXT, pix_key TEXT, amount_zp REAL, amount_brl REAL, status TEXT, created_at TEXT)").run(); }catch{}
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sessão expirada"}, {status:401});
    const {name, pix_type, pix_key, amount_zp} = await request.json();
    if(!name||!pix_key||!amount_zp) return Response.json({error:"Preencha nome, chave e valor"}, {status:400});
    const id = crypto.randomUUID();
    const amount_brl = amount_zp * 0.01;
    await env.DB.prepare("INSERT INTO withdrawals (id, user_id, name, pix_type, pix_key, amount_zp, amount_brl, status, created_at) VALUES (?,?,?,?,?,?,?,?, datetime('now'))").bind(id, sess.user_id, name, pix_type, pix_key, amount_zp, amount_brl, "pendente").run();
    return Response.json({ok:true, id, amount_zp, amount_brl});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
