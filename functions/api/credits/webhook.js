
// POST /api/subscription/webhook - SÓ PAGA AFILIADO SE ELE FOR PREMIUM
export async function onRequestPost({request, env}){
  try{
    const body = await request.json().catch(()=>({}));
    const paymentId = body.data?.id || body.id;
    if(!paymentId) return Response.json({ok:true});
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: "Bearer " + env.MP_ACCESS_TOKEN } });
    const pay = await mpRes.json();
    if(pay.status !== 'approved') return Response.json({ok:true, status: pay.status});
    let ext = {};
    try{ ext = JSON.parse(pay.external_reference||"{}"); }catch{}
    const user_id = ext.user_id;
    const affiliate_code = ext.affiliate_code;
    const affiliate_user_id = ext.affiliate_user_id;
    if(!user_id) return Response.json({ok:true});
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, user_id TEXT, plan TEXT, amount_brl REAL, status TEXT, mp_preference_id TEXT, mp_preapproval_id TEXT, mp_payment_id TEXT, affiliate_code TEXT, affiliate_user_id TEXT, created_at TEXT, expires_at TEXT)").run(); }catch{}
    const cols = ["mp_preapproval_id TEXT","mp_preference_id TEXT","mp_payment_id TEXT","affiliate_code TEXT","affiliate_user_id TEXT","amount_brl REAL","expires_at TEXT"];
    for(const c of cols){ try{ await env.DB.prepare(`ALTER TABLE subscriptions ADD COLUMN ${c}`).run(); }catch{} }
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS affiliate_commissions (id TEXT PRIMARY KEY, affiliate_user_id TEXT, affiliate_code TEXT, referred_user_id TEXT, subscription_id TEXT, amount_brl REAL, platform_profit_brl REAL, status TEXT, created_at TEXT)").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS users_premium (user_id TEXT PRIMARY KEY, is_premium INTEGER DEFAULT 0, expires_at TEXT, plan TEXT)").run(); }catch{}
    const expires = new Date(Date.now() + 30*24*60*60*1000).toISOString();
    await env.DB.prepare("INSERT OR REPLACE INTO users_premium (user_id, is_premium, expires_at, plan) VALUES (?,?,?,?)").bind(user_id, 1, expires, 'premium_39').run();
    try{ await env.DB.prepare("UPDATE subscriptions SET status='ativo', mp_payment_id=? WHERE user_id=? AND status='pendente_assinatura'").bind(String(paymentId), user_id).run(); }catch{ await env.DB.prepare("UPDATE subscriptions SET status='ativo' WHERE user_id=?").bind(user_id).run(); }
    const sub = await env.DB.prepare("SELECT id FROM subscriptions WHERE user_id=? ORDER BY created_at DESC LIMIT 1").bind(user_id).first();

    // ===== TRAVA: SÓ PAGA AFILIADO SE ELE FOR PREMIUM =====
    let affiliateIsPremium = false;
    if(affiliate_user_id && affiliate_user_id !== user_id){
      try{
        const prem = await env.DB.prepare("SELECT is_premium, expires_at FROM users_premium WHERE user_id=?").bind(affiliate_user_id).first();
        if(prem && prem.is_premium === 1 && (!prem.expires_at || new Date(prem.expires_at) > new Date())) affiliateIsPremium = true;
      }catch{}
      if(affiliateIsPremium){
        const commId = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO affiliate_commissions (id, affiliate_user_id, affiliate_code, referred_user_id, subscription_id, amount_brl, platform_profit_brl, status, created_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'))").bind(commId, affiliate_user_id, affiliate_code||"", user_id, sub?.id||"", 20.00, 19.00, 'aprovado').run();
        await env.DB.prepare("UPDATE affiliates SET total_earned = total_earned + 20 WHERE user_id=?").bind(affiliate_user_id).run();
        await env.DB.prepare("UPDATE affiliates SET total_referrals = total_referrals + 1 WHERE user_id=?").bind(affiliate_user_id).run();
      } else {
        // Afiliado NÃO é Premium -> NÃO ganha. Plataforma fica com R$39 todo
        console.log("Afiliado não é Premium, sem comissão para", affiliate_user_id);
      }
    }
    return Response.json({ok:true, premium_liberado:true, affiliate_paid: affiliateIsPremium});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
