export async function onRequestPost({request, env}){
  try{
    const auth = request.headers.get("Authorization")||"";
    const token = auth.replace("Bearer ","").trim();
    if(!token) return Response.json({error:"Faça login primeiro"}, {status:401});
    
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sessão expirada"}, {status:401});
    
    const {amount_zp} = await request.json();
    const zp = parseFloat(amount_zp);
    if(!zp || zp < 100) return Response.json({error:"Mínimo 100 ZP$"}, {status:400});
    
    const brl = zp * 0.01; // 1 ZP$ = R$0,01
    
    // Cria tabela de compras se não existe
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS credit_orders (id TEXT PRIMARY KEY, user_id TEXT, amount_zp REAL, amount_brl REAL, mp_payment_id TEXT, status TEXT, pix_qr TEXT, pix_code TEXT, created_at TEXT)").run();
    }catch(e){}
    
    // Pega email do usuário
    let userEmail = "cliente@zpay.com.br";
    try{
      const u = await env.DB.prepare("SELECT email FROM users WHERE id=?").bind(sess.user_id).first();
      if(u && u.email) userEmail = u.email;
    }catch(e){}
    
    const orderId = crypto.randomUUID();
    
    // Se não tem token do Mercado Pago, gera Pix fake para teste (você coloca token depois)
    const mpToken = env.MP_ACCESS_TOKEN;
    
    if(!mpToken){
      // MODO TESTE - sem token, cria pedido pendente
      await env.DB.prepare("INSERT INTO credit_orders (id, user_id, amount_zp, amount_brl, status, created_at) VALUES (?,?,?,?,?, datetime('now'))").bind(orderId, sess.user_id, zp, brl, "pendente").run();
      return Response.json({
        ok:true,
        mode:"teste",
        order_id: orderId,
        amount_zp: zp,
        amount_brl: brl,
        pix_code: "MODO TESTE - Configure MP_ACCESS_TOKEN no Cloudflare para Pix real",
        message: "Pedido criado em modo teste. Configure MP_ACCESS_TOKEN em Cloudflare > Settings > Variables para Pix automático real!"
      });
    }
    
    // MODO REAL - Mercado Pago Pix
    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": orderId
      },
      body: JSON.stringify({
        transaction_amount: brl,
        description: `Compra ${zp} ZP$ - ZPay Agro`,
        payment_method_id: "pix",
        payer: { email: userEmail },
        external_reference: orderId
      })
    });
    
    const mpData = await mpRes.json();
    
    if(!mpRes.ok){
      return Response.json({error:"Erro Mercado Pago: "+(mpData.message||JSON.stringify(mpData))}, {status:400});
    }
    
    const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code || "";
    const qrBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || "";
    const paymentId = mpData.id?.toString() || "";
    
    await env.DB.prepare("INSERT INTO credit_orders (id, user_id, amount_zp, amount_brl, mp_payment_id, status, pix_qr, pix_code, created_at) VALUES (?,?,?,?,?,?,?,?, datetime('now'))").bind(orderId, sess.user_id, zp, brl, paymentId, "pendente", qrBase64, qrCode).run();
    
    return Response.json({
      ok:true,
      mode:"real",
      order_id: orderId,
      mp_payment_id: paymentId,
      amount_zp: zp,
      amount_brl: brl,
      pix_code: qrCode,
      pix_qr_base64: qrBase64,
      status: mpData.status
    });
    
  }catch(e){
    return Response.json({error:"Erro create-pix: "+e.message}, {status:500});
  }
}
