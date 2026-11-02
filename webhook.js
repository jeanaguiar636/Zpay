export async function onRequestPost({request, env}){
  try{
    const body = await request.json();
    
    // Mercado Pago envia {type: "payment", data: {id: ...}}
    const paymentId = body.data?.id || body.id;
    if(!paymentId){
      return Response.json({ok:true, msg:"Sem payment id"});
    }
    
    const mpToken = env.MP_ACCESS_TOKEN;
    if(!mpToken) return Response.json({ok:true, msg:"Sem token"});
    
    // Busca pagamento no MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${mpToken}` }
    });
    const mpData = await mpRes.json();
    
    if(mpData.status !== "approved"){
      return Response.json({ok:true, status: mpData.status});
    }
    
    const orderId = mpData.external_reference;
    if(!orderId) return Response.json({ok:true, msg:"Sem external_reference"});
    
    // Busca pedido
    const order = await env.DB.prepare("SELECT * FROM credit_orders WHERE id=?").bind(orderId).first();
    if(!order) return Response.json({ok:false, error:"Pedido não encontrado"});
    if(order.status === "pago") return Response.json({ok:true, msg:"Já pago"});
    
    // Credita ZP$
    await env.DB.prepare("UPDATE portfolios SET cash_zp = cash_zp + ? WHERE user_id=?").bind(order.amount_zp, order.user_id).run();
    await env.DB.prepare("UPDATE credit_orders SET status='pago', mp_payment_id=? WHERE id=?").bind(paymentId.toString(), orderId).run();
    
    // Registra transação
    try{
      await env.DB.prepare("INSERT INTO transactions (id, user_id, type, amount_zp, amount_brl, created_at) VALUES (?,?,?,?,?, datetime('now'))").bind(crypto.randomUUID(), order.user_id, "compra_pix", order.amount_zp, order.amount_brl).run();
    }catch(e){}
    
    return Response.json({ok:true, credited: order.amount_zp});
    
  }catch(e){
    return Response.json({error: e.message}, {status:500});
  }
}
export async function onRequestGet(){
  return Response.json({ok:true, msg:"Webhook Mercado Pago - POST aqui"});
}
