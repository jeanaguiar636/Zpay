export async function onRequestGet({ request, env }) {
  const token = request.headers.get('Authorization')?.replace('Bearer ','');
  const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
  if(!sess) return Response.json({error:'Não logado'}, {status:401});
  const portfolio = await env.DB.prepare("SELECT * FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
  return Response.json(portfolio);
}
export async function onRequestPost({ request, env }) {
  const { user_id, cash_zp } = await request.json();
  await env.DB.prepare("UPDATE portfolios SET cash_zp=?, total_value=? WHERE user_id=?").bind(cash_zp, cash_zp, user_id).run();
  return Response.json({ok:true});
}
