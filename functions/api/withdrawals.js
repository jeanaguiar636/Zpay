export async function onRequestPost({ request, env }) {
  const { user_id, amount_zp, pix_key } = await request.json();
  if(!amount_zp || !pix_key) return Response.json({error:'Faltando dados'}, {status:400});
  const portfolio = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(user_id).first();
  if(!portfolio || portfolio.cash_zp < amount_zp) return Response.json({error:'Saldo insuficiente'}, {status:400});
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO withdrawals (id, user_id, amount_zp, amount_brl, pix_key, status, created_at) VALUES (?,?,?,?,?, 'pending', datetime('now'))").bind(id, user_id, amount_zp, amount_zp, pix_key).run();
  await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(portfolio.cash_zp - amount_zp, user_id).run();
  return Response.json({ok:true});
}
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const user_id = url.searchParams.get('user_id');
  if(user_id){
    const res = await env.DB.prepare("SELECT * FROM withdrawals WHERE user_id=? ORDER BY created_at DESC").bind(user_id).all();
    return Response.json(res.results||[]);
  }
  const res = await env.DB.prepare("SELECT w.*, u.email FROM withdrawals w JOIN users u ON u.id=w.user_id WHERE w.status='pending' ORDER BY w.created_at DESC").all();
  return Response.json(res.results||[]);
}
