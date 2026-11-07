
// POST /api/affiliate/create-link - SÓ QUEM É ASSINANTE PREMIUM GANHA COMO AFILIADO
// Grátis pode treinar, mas NÃO ganha. Premium paga R$39 e ganha R$20 por indicado.
export async function onRequestPost({request, env}){
  try{
    const auth = request.headers.get("Authorization")||"";
    const token = auth.replace("Bearer ","").trim();
    if(!token) return Response.json({error:"Faça login"}, {status:401});
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sem login"}, {status:401});

    // ===== TRAVA: SÓ PREMIUM GERA LINK =====
    let isPremium = false;
    try{
      const prem = await env.DB.prepare("SELECT is_premium, expires_at FROM users_premium WHERE user_id=?").bind(sess.user_id).first();
      if(prem && prem.is_premium === 1){
        if(!prem.expires_at || new Date(prem.expires_at) > new Date()) isPremium = true;
      }
    }catch{}
    if(!isPremium){
      try{
        const sub = await env.DB.prepare("SELECT status, expires_at FROM subscriptions WHERE user_id=? AND status IN ('ativo','pendente_assinatura') ORDER BY created_at DESC LIMIT 1").bind(sess.user_id).first();
        if(sub && sub.status === 'ativo') isPremium = true;
      }catch{}
    }
    if(!isPremium){
      return Response.json({
        error: "SÓ ASSINANTE PREMIUM GANHA COMO AFILIADO! Faça upgrade R$39/mês para gerar seu link e ganhar R$20 por cada indicado!",
        need_upgrade: true,
        upgrade_url: "https://agropay.pages.dev/planos.html",
        is_premium: false
      }, {status:403});
    }

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
      is_premium: true,
      message: "Você é Premium! Compartilhe seu link! Cada pessoa que assinar Premium R$39/mês, você ganha R$20 todo mês!",
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

    // Verifica se é Premium pra mostrar saldo
    let isPremium = false;
    try{
      const prem = await env.DB.prepare("SELECT is_premium, expires_at FROM users_premium WHERE user_id=?").bind(sess.user_id).first();
      if(prem && prem.is_premium === 1 && (!prem.expires_at || new Date(prem.expires_at) > new Date())) isPremium = true;
    }catch{}
    if(!isPremium){
      return Response.json({ok:true, is_premium:false, need_upgrade:true, total_earned:0, total_referrals:0, message:"Só assinante Premium ganha como afiliado. Faça upgrade!"});
    }

    const aff = await env.DB.prepare("SELECT * FROM affiliates WHERE user_id=?").bind(sess.user_id).first();
    if(!aff) return Response.json({ok:true, is_premium:true, has_link:false});
    const comms = await env.DB.prepare("SELECT * FROM affiliate_commissions WHERE affiliate_user_id=? ORDER BY created_at DESC LIMIT 20").all().catch(()=>({results:[]}));
    return Response.json({
      ok:true,
      is_premium:true,
      code: aff.code,
      link: `https://agropay.pages.dev/planos.html?ref=${aff.code}`,
      total_earned: aff.total_earned,
      total_referrals: aff.total_referrals,
      commissions: comms.results||[],
      monthly_projection: (aff.total_referrals||0)*20
    });
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
