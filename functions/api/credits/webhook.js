
// webhook.js UNIFICADO - Cola em Zpay / functions / api / credits / webhook.js
// Cuida de 2 coisas:
// 1) Compra de crédito antiga (ZP$)
// 2) Assinatura Premium R$39 + Afiliado R$20 / Plataforma R$19

export async function onRequestPost({request, env}){
  try{
    const body = await request.json().catch(()=>({}));
    const paymentId = body.data?.id || body.id || body.data?.id;
    if(!paymentId) return Response.json({ok:true});

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: "Bearer " + env.MP_ACCESS_TOKEN }
    });
    const pay = await mpRes.json();
    if(pay.status !== 'approved') return Response.json({ok:true, status: pay.status});

    // Tenta ler external_reference - pode ser JSON ou order_id simples
    let ext = {};
    let orderId = null;
    try{
      ext = JSON.parse(pay.external_reference||"{}");
      if(ext.type === "premium_subscription"){
        // ===== PREMIUM R$39 =====
        const user_id = ext.user_id;
        const affiliate_code = ext.affiliate_code;
        const affiliate_user_id = ext.affiliate_user_id;
        if(!user_id) return Response.json({ok:true});

        try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, user_id TEXT, plan TEXT, amount_brl REAL, status TEXT, mp_preference_id TEXT, mp_payment_id TEXT, affiliate_code TEXT, affiliate_user_id TEXT, created_at TEXT, expires_at TEXT)").run(); }catch{}
        try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS affiliate_commissions (id TEXT PRIMARY KEY, affiliate_user_id TEXT, affiliate_code TEXT, referred_user_id TEXT, subscription_id TEXT, amount_brl REAL, platform_profit_brl REAL, status TEXT, created_at TEXT)").run(); }catch{}
        try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS users_premium (user_id TEXT PRIMARY KEY, is_premium INTEGER DEFAULT 0, expires_at TEXT, plan TEXT)").run(); }catch{}

        const expires = new Date(Date.now() + 30*24*60*60*1000).toISOString();
        await env.DB.prepare("INSERT OR REPLACE INTO users_premium (user_id, is_premium, expires_at, plan) VALUES (?,?,?,?)").bind(user_id, 1, expires, 'premium_39').run();
        await env.DB.prepare("UPDATE subscriptions SET status='ativo', mp_payment_id=? WHERE user_id=? AND status='pendente'").bind(String(paymentId), user_id).run();
        const sub = await env.DB.prepare("SELECT id FROM subscriptions WHERE user_id=? ORDER BY created_at DESC LIMIT 1").bind(user_id).first();

        if(affiliate_user_id && affiliate_user_id !== user_id){
          const commId = crypto.randomUUID();
          await env.DB.prepare("INSERT INTO affiliate_commissions (id, affiliate_user_id, affiliate_code, referred_user_id, subscription_id, amount_brl, platform_profit_brl, status, created_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'))").bind(commId, affiliate_user_id, affiliate_code||"", user_id, sub?.id||"", 20.00, 19.00, 'aprovado').run();
          await env.DB.prepare("UPDATE affiliates SET total_earned = total_earned + 20 WHERE user_id=?").bind(affiliate_user_id).run();
          await env.DB.prepare("UPDATE affiliates SET total_referrals = total_referrals + 1 WHERE user_id=?").bind(affiliate_user_id).run();
        }
        return Response.json({ok:true, premium_liberado:true});
      }
      orderId = ext.order_id || ext.orderId || pay.external_reference;
    }catch{
      orderId = pay.external_reference;
    }

    // ===== COMPRA DE CRÉDITO ANTIGA (ZP$) =====
    // Seu webhook antigo: procura order em credit_orders / orders
    try{
      const order = await env.DB.prepare("SELECT * FROM credit_orders WHERE id=? OR mp_payment_id=?").bind(orderId, String(paymentId)).first()
        || await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(orderId).first().catch(()=>null);
      if(order){
        const user_id = order.user_id;
        const amount_zp = order.amount_zp || order.zp_amount || 0;
        if(user_id && amount_zp){
          let port = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(user_id).first();
          const novo = (port?.cash_zp||0) + amount_zp;
          await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(novo, user_id).run();
          await env.DB.prepare("UPDATE credit_orders SET status='pago' WHERE id=?").bind(order.id).run().catch(()=>{});
        }
        return Response.json({ok:true, credito_liberado:true, amount_zp: amount_zp});
      }
    }catch(e){ console.log("credito order erro", e.message); }

    // Se não achou order, tenta usar metadata do pagamento
    // Fallback: se external_reference for user_id direto, credita valor do pagamento
    // (mantém compatibilidade com seu webhook antigo)
    return Response.json({ok:true, message:"Pagamento aprovado mas order não encontrada - verifique admin", payment_id: paymentId, external_reference: pay.external_reference});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
