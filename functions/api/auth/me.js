export async function onRequestGet({ request, env }) {
  try {
    const token = (request.headers.get("Authorization")||"").replace("Bearer ","");
    if (!token) return Response.json({error:'No token'}, {status:401});
    
    try { await env.DB.prepare("ALTER TABLE portfolios ADD COLUMN cash_zp INTEGER DEFAULT 5000").run(); } catch {}
    try { await env.DB.prepare("ALTER TABLE portfolios ADD COLUMN total_value INTEGER DEFAULT 5000").run(); } catch {}
    try { await env.DB.prepare("ALTER TABLE portfolios ADD COLUMN user_id TEXT").run(); } catch {}
    
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if (!sess) return Response.json({error:'Sessão inválida'}, {status:401});
    
    let user = await env.DB.prepare("SELECT id, username, email FROM users WHERE id=?").bind(sess.user_id).first();
    let portfolio = await env.DB.prepare("SELECT cash_zp, total_value FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
    
    if (!portfolio) {
      await env.DB.prepare("INSERT INTO portfolios (id, user_id, cash_zp, total_value) VALUES (?,?,?,?)").bind(crypto.randomUUID(), sess.user_id, 5000, 5000).run().catch(()=>{});
      portfolio = await env.DB.prepare("SELECT cash_zp, total_value FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
    }
    
    return Response.json({ok:true, user, portfolio, cash_zp: portfolio?.cash_zp||5000});
  } catch(e){ return Response.json({error:e.message}, {status:500}); }
}
