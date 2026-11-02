export async function onRequestPost({ request, env }) {
  try {
    const { id, action } = await request.json();
    if(!id || !action) return Response.json({error:'Faltando dados'}, {status:400});
    const w = await env.DB.prepare("SELECT * FROM withdrawals WHERE id=?").bind(id).first();
    if(!w) return Response.json({error:'Saque não encontrado'}, {status:404});
    if(action==='rejected'){
      const portfolio = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(w.user_id).first();
      await env.DB.prepare("UPDATE portfolios SET cash_zp=?, total_value=? WHERE user_id=?").bind((portfolio?.cash_zp||0)+w.amount_zp, (portfolio?.cash_zp||0)+w.amount_zp, w.user_id).run();
    }
    await env.DB.prepare("UPDATE withdrawals SET status=? WHERE id=?").bind(action, id).run();
    return Response.json({ok:true});
  } catch(e){ return Response.json({error:e.message}, {status:500}); }
}
