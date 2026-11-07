
// POST /api/admin/premium - Liberar Premium GRÁTIS pelo Admin
// GET /api/admin/premium - Listar quem é Premium
export async function onRequestGet({request, env}){
  try{
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS users_premium (user_id TEXT PRIMARY KEY, is_premium INTEGER DEFAULT 0, expires_at TEXT, plan TEXT, liberado_por_admin INTEGER DEFAULT 0, motivo TEXT)").run(); }catch{}
    const rows = await env.DB.prepare(`
      SELECT u.id as user_id, u.username, u.email, p.is_premium, p.expires_at, p.plan, p.liberado_por_admin
      FROM users u LEFT JOIN users_premium p ON u.id = p.user_id
      WHERE p.is_premium = 1
      ORDER BY p.expires_at DESC LIMIT 100
    `).all();
    return Response.json({ok:true, premium_users: rows.results||[]});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}

export async function onRequestPost({request, env}){
  try{
    const body = await request.json().catch(()=>({}));
    const { user_id, email, username, action, dias, motivo } = body;
    // Admin pode mandar email ou user_id ou username
    let targetId = user_id;
    if(!targetId && email){
      const u = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
      if(u) targetId = u.id;
    }
    if(!targetId && username){
      const u = await env.DB.prepare("SELECT id FROM users WHERE username=?").bind(username).first();
      if(u) targetId = u.id;
    }
    if(!targetId) return Response.json({error:"Usuário não encontrado! Manda email ou ID certo"}, {status:404});

    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS users_premium (user_id TEXT PRIMARY KEY, is_premium INTEGER DEFAULT 0, expires_at TEXT, plan TEXT, liberado_por_admin INTEGER DEFAULT 0, motivo TEXT)").run(); }catch{}
    for(const c of ["liberado_por_admin INTEGER DEFAULT 0","motivo TEXT","plan TEXT","expires_at TEXT"]){
      try{ await env.DB.prepare(`ALTER TABLE users_premium ADD COLUMN ${c}`).run(); }catch{}
    }

    if(action === 'revoke' || action === 'remover'){
      await env.DB.prepare("UPDATE users_premium SET is_premium=0, liberado_por_admin=0 WHERE user_id=?").bind(targetId).run();
      return Response.json({ok:true, message:"Premium removido! Usuário voltou pra Grátis"});
    }

    // Liberar Premium GRÁTIS
    const diasNum = parseInt(dias||30);
    const expires = new Date(Date.now() + diasNum*24*60*60*1000).toISOString();
    await env.DB.prepare("INSERT OR REPLACE INTO users_premium (user_id, is_premium, expires_at, plan, liberado_por_admin, motivo) VALUES (?,?,?,? ,1,?)")
      .bind(targetId, 1, expires, 'premium_39_liberado_admin', motivo||"Liberado grátis pelo admin").run();

    const u = await env.DB.prepare("SELECT username, email FROM users WHERE id=?").bind(targetId).first();
    return Response.json({ok:true, message:`✅ Premium liberado GRÁTIS para ${u?.username||u?.email||targetId} por ${diasNum} dias!`, user: u, expires_at: expires, dias: diasNum});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
