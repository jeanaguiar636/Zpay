
// POST /api/affiliate/create-link - Gera link de afiliado
export async function onRequestPost({request, env}){
  try{
    const auth = request.headers.get("Authorization")||"";
    const token = auth.replace("Bearer ","").trim();
    if(!token) return Response.json({error:"Faça login"}, {status:401});
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sem login"}, {status:401});

    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS affiliates (id TEXT PRIMARY KEY, user_id TEXT UNIQUE, code TEXT UNIQUE, total_earned REAL DEFAULT 0, total_referrals INTEGER DEFAULT 0, created_at TEXT)").run(); }catch{}

    let aff = await env.DB.prepare("SELECT * FROM affiliates WHERE user_id=?").bind(sess.user_id).first();
    if(!aff){
      const user = await env.DB.prepare("SELECT username FROM users WHERE id=?").bind(sess.user_id).first();
      const base = (user?.username||"user").toLowerCase().replace(/[^a-z0-9]/g,"").substring(0,12);
      const code = base + Math.floor(1000 + Math.random()*9000);
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO affiliates (id, user_id, code, total_earned, total_referrals, created_at) VALUES (?,?,?,?,0,datetime('now'))").bind(id, sess.user_id, code, 0).run();
      aff = {code, total_earned:0, total_referrals:0};
    }

    const link = `https://agropay.pages.dev/planos.html?ref=${aff.code}`;
    return Response.json({
      ok:true,
      code: aff.code,
      link,
      message: "Compartilhe seu link! Cada pessoa que assinar Premium R$39/mês, você ganha R$20 todo mês!",
      split: { you_get: 20, platform_gets: 19, total: 39 }
    });
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
export async function onRequestGet({request, env}){
  try{
    const auth = request.headers.get("Authorization")||"";
    const token = auth.replace("Bearer ","").trim();
    if(!token) return Response.json({error:"Faça login"}, {status:401});
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sem login"}, {status:401});
    const aff = await env.DB.prepare("SELECT * FROM affiliates WHERE user_id=?").bind(sess.user_id).first();
    if(!aff) return Response.json({ok:true, has_link:false});
    const comms = await env.DB.prepare("SELECT * FROM affiliate_commissions WHERE affiliate_user_id=? ORDER BY created_at DESC LIMIT 20").all();
    return Response.json({
      ok:true,
      code: aff.code,
      link: `https://agropay.pages.dev/planos.html?ref=${aff.code}`,
      total_earned: aff.total_earned,
      total_referrals: aff.total_referrals,
      commissions: comms.results||[],
      monthly_projection: (aff.total_referrals||0)*20
    });
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
