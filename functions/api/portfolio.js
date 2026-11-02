export async function onRequestGet({ request, env }) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ','');
    if(!token) return Response.json({error:'Sem token'}, {status:401});
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:'Não logado'}, {status:401});
    const portfolio = await env.DB.prepare("SELECT * FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
    return Response.json(portfolio || {cash_zp:5000, total_value:5000});
  } catch(e){ return Response.json({error:e.message}, {status:500}); }
}
export async function onRequestPost({ request, env }) {
  try {
    const { user_id, cash_zp } = await request.json();
    await env.DB.prepare("UPDATE portfolios SET cash_zp=?, total_value=? WHERE user_id=?").bind(cash_zp, cash_zp, user_id).run();
    return Response.json({ok:true});
  } catch(e){ return Response.json({error:e.message}, {status:500}); }
}
