
// POST /api/subscription/create - Cria cobrança R$39 Premium com afiliado
// Usa mesmo MP_ACCESS_TOKEN já configurado no agropay
export async function onRequestPost({request, env}){
  try{
    const auth = request.headers.get("Authorization")||"";
    const token = auth.replace("Bearer ","").trim();
    if(!token) return Response.json({error:"Faça login primeiro"}, {status:401});
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sem login"}, {status:401});

    const body = await request.json().catch(()=>({}));
    const affiliate_code = body.affiliate_code || body.ref || null;
    const plan = body.plan || 'premium_39';

    // Cria tabelas se não existir
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, user_id TEXT, plan TEXT, amount_brl REAL, status TEXT, mp_preference_id TEXT, mp_payment_id TEXT, affiliate_code TEXT, affiliate_user_id TEXT, created_at TEXT, expires_at TEXT, next_payment TEXT)").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS affiliates (id TEXT PRIMARY KEY, user_id TEXT UNIQUE, code TEXT UNIQUE, total_earned REAL DEFAULT 0, total_referrals INTEGER DEFAULT 0, created_at TEXT)").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS affiliate_commissions (id TEXT PRIMARY KEY, affiliate_user_id TEXT, affiliate_code TEXT, referred_user_id TEXT, subscription_id TEXT, amount_brl REAL, platform_profit_brl REAL, status TEXT, created_at TEXT, paid_at TEXT)").run(); }catch{}

    // Se tem afiliado, busca dono do código
    let affiliate_user_id = null;
    if(affiliate_code){
      const aff = await env.DB.prepare("SELECT user_id FROM affiliates WHERE code=?").bind(affiliate_code).first();
      if(aff) affiliate_user_id = aff.user_id;
    }

    const user = await env.DB.prepare("SELECT email, username FROM users WHERE id=?").bind(sess.user_id).first();

    // Cria Preference no Mercado Pago - R$39 - Assinatura Premium Simulação
    // Mesmo MP_ACCESS_TOKEN do agropay
    const mpToken = env.MP_ACCESS_TOKEN;
    if(!mpToken) return Response.json({error:"MP_ACCESS_TOKEN não configurado"}, {status:500});

    const preference = {
      items: [{
        title: "AgroPay Premium - Licença Mensal de Treinamento e Simulação",
        description: "Acesso Premium à plataforma de treinamento e simulação de trading AgroPay - JOGO EDUCACIONAL, sem investimento real",
        quantity: 1,
        unit_price: 39.00,
        currency_id: "BRL",
        category_id: "services"
      }],
      payer: { email: user?.email || "cliente@agropay.com" },
      external_reference: JSON.stringify({ user_id: sess.user_id, plan, affiliate_code: affiliate_code||"", affiliate_user_id: affiliate_user_id||"", type: "premium_subscription" }),
      back_urls: {
        success: "https://agropay.pages.dev/planos.html?status=sucesso",
        failure: "https://agropay.pages.dev/planos.html?status=falha",
        pending: "https://agropay.pages.dev/planos.html?status=pendente"
      },
      auto_return: "approved",
      notification_url: "https://agropay.pages.dev/api/subscription/webhook",
      statement_descriptor: "AGROPAY PREMIUM"
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + mpToken },
      body: JSON.stringify(preference)
    });
    const mpData = await mpRes.json();
    if(!mpRes.ok) return Response.json({error: "MP erro: " + JSON.stringify(mpData)}, {status:500});

    const subId = crypto.randomUUID();
    const expires = new Date(Date.now() + 30*24*60*60*1000).toISOString();
    await env.DB.prepare("INSERT INTO subscriptions (id, user_id, plan, amount_brl, status, mp_preference_id, affiliate_code, affiliate_user_id, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'),?)")
      .bind(subId, sess.user_id, plan, 39.00, 'pendente', mpData.id, affiliate_code||"", affiliate_user_id||"", expires).run();

    return Response.json({
      ok: true,
      subscription_id: subId,
      checkout_url: mpData.init_point,
      sandbox_url: mpData.sandbox_init_point,
      preference_id: mpData.id,
      plan: "premium_39",
      price: 39.00,
      affiliate_split: { affiliate_gets: 20.00, platform_gets: 19.00 },
      message: "Licença Premium R$39/mês - Treinamento e Simulação"
    });
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
