
// POST /api/subscription/create - ASSINATURA RECORRENTE DE VERDADE (Preapproval)
// Cobra R$39 todo mês automaticamente no cartão, sem precisar pagar de novo!
export async function onRequestPost({request, env}){
  try{
    const auth = request.headers.get("Authorization")||"";
    const token = auth.replace("Bearer ","").trim();
    if(!token) return Response.json({error:"Faça login primeiro"}, {status:401});
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sem login"}, {status:401});

    const body = await request.json().catch(()=>({}));
    const affiliate_code = body.affiliate_code || body.ref || null;

    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, user_id TEXT, plan TEXT, amount_brl REAL, status TEXT, mp_preference_id TEXT, mp_preapproval_id TEXT, mp_payment_id TEXT, affiliate_code TEXT, affiliate_user_id TEXT, created_at TEXT, expires_at TEXT)").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS affiliates (id TEXT PRIMARY KEY, user_id TEXT UNIQUE, code TEXT UNIQUE, total_earned REAL DEFAULT 0, total_referrals INTEGER DEFAULT 0, created_at TEXT)").run(); }catch{}

    let affiliate_user_id = null;
    if(affiliate_code){
      const aff = await env.DB.prepare("SELECT user_id FROM affiliates WHERE code=?").bind(affiliate_code).first();
      if(aff) affiliate_user_id = aff.user_id;
    }

    const user = await env.DB.prepare("SELECT email, username FROM users WHERE id=?").bind(sess.user_id).first();
    const mpToken = env.MP_ACCESS_TOKEN;
    if(!mpToken) return Response.json({error:"MP_ACCESS_TOKEN não configurado"}, {status:500});

    // ===== ASSINATURA RECORRENTE - Preapproval =====
    // MP cobra R$39 todo mês automaticamente!
    const preapproval = {
      reason: "AgroPay Premium - Licença Mensal de Treinamento e Simulação",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 39.00,
        currency_id: "BRL"
      },
      payer_email: user?.email || "cliente@agropay.com",
      back_url: "https://agropay.pages.dev/planos.html?status=assinado",
      external_reference: JSON.stringify({ user_id: sess.user_id, plan: "premium_39", affiliate_code: affiliate_code||"", affiliate_user_id: affiliate_user_id||"", type: "premium_subscription" }),
      status: "pending"
    };

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + mpToken },
      body: JSON.stringify(preapproval)
    });
    const mpData = await mpRes.json();
    if(!mpRes.ok) return Response.json({error: "MP erro: " + JSON.stringify(mpData)}, {status:500});

    const subId = crypto.randomUUID();
    const expires = new Date(Date.now() + 30*24*60*60*1000).toISOString();
    await env.DB.prepare("INSERT INTO subscriptions (id, user_id, plan, amount_brl, status, mp_preapproval_id, affiliate_code, affiliate_user_id, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'),?)")
      .bind(subId, sess.user_id, 'premium_39', 39.00, 'pendente_assinatura', mpData.id, affiliate_code||"", affiliate_user_id||"", expires).run();

    return Response.json({
      ok: true,
      subscription_id: subId,
      checkout_url: mpData.init_point, // Link pra assinar - MP cobra todo mês!
      preapproval_id: mpData.id,
      type: "ASSINATURA_RECORRENTE",
      plan: "premium_39",
      price: 39.00,
      frequency: "Todo mês - cobrança automática no cartão",
      affiliate_split: { affiliate_gets: 20.00, platform_gets: 19.00 },
      message: "Assinatura R$39/mês - MP cobra automaticamente todo mês!"
    });
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
