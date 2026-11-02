export async function onRequestGet({request, env}){
  try{
    const url = new URL(request.url);
    const orderId = url.searchParams.get("order_id");
    if(!orderId) return Response.json({error:"order_id obrigatório"}, {status:400});
    
    const auth = request.headers.get("Authorization")||"";
    const token = auth.replace("Bearer ","").trim();
    if(!token) return Response.json({error:"Sem token"}, {status:401});
    
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sessão expirada"}, {status:401});
    
    const order = await env.DB.prepare("SELECT * FROM credit_orders WHERE id=? AND user_id=?").bind(orderId, sess.user_id).first();
    if(!order) return Response.json({error:"Pedido não encontrado"}, {status:404});
    
    // Se já pago no banco
    if(order.status === "pago"){
      const port = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
      return Response.json({ok:true, status:"pago", amount_zp: order.amount_zp, cash_zp: port?.cash_zp});
    }
    
    // Verifica no Mercado Pago se tem token
    const mpToken = env.MP_ACCESS_TOKEN;
    if(mpToken && order.mp_payment_id){
      try{
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${order.mp_payment_id}`, {
          headers: { "Authorization": `Bearer ${mpToken}` }
        });
        const mpData = await mpRes.json();
        if(mpData.status === "approved"){
          // Credita
          await env.DB.prepare("UPDATE portfolios SET cash_zp = cash_zp + ? WHERE user_id=?").bind(order.amount_zp, order.user_id).run();
          await env.DB.prepare("UPDATE credit_orders SET status='pago' WHERE id=?").bind(orderId).run();
          const port = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
          return Response.json({ok:true, status:"pago", amount_zp: order.amount_zp, cash_zp: port?.cash_zp});
        }
        return Response.json({ok:true, status: mpData.status, amount_zp: order.amount_zp});
      }catch(e){}
    }
    
    // Modo teste: aprovar manual (para testar sem MP)
    if(url.searchParams.get("aprovar_teste")==="1"){
      await env.DB.prepare("UPDATE portfolios SET cash_zp = cash_zp + ? WHERE user_id=?").bind(order.amount_zp, order.user_id).run();
      await env.DB.prepare("UPDATE credit_orders SET status='pago' WHERE id=?").bind(orderId).run();
      const port = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
      return Response.json({ok:true, status:"pago_teste", amount_zp: order.amount_zp, cash_zp: port?.cash_zp});
    }
    
    return Response.json({ok:true, status: order.status, amount_zp: order.amount_zp, amount_brl: order.amount_brl, pix_code: order.pix_code, pix_qr: order.pix_qr});
    
  }catch(e){
    return Response.json({error:e.message}, {status:500});
  }
}
