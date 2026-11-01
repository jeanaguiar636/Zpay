export async function onRequestGet({ request, env }) {
  const token = request.headers.get('Authorization')?.replace('Bearer ','');
  const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
  if(!sess) return Response.json({error:'Não logado'}, {status:401});
  const user = await env.DB.prepare("SELECT id, username, email FROM users WHERE id=?").bind(sess.user_id).first();
  const portfolio = await env.DB.prepare("SELECT * FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
  const trades = await env.DB.prepare("SELECT * FROM trades WHERE user_id=? ORDER BY created_at DESC LIMIT 50").bind(sess.user_id).all();
  return Response.json({user, portfolio, trades: trades.results || []});
}
