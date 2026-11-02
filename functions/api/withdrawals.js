export async function onRequestPost({ request, env }) {
  try {
    const { user_id, amount_zp, pix_key } = await request.json();
    if(!amount_zp || !pix_key) return Response.json({error:'Faltando dados'}, {status:400});
    const portfolio = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(user_id).first();
    if(!portfolio || portfolio.cash_zp < amount_zp) return Response.json({error:'Saldo insuficiente'}, {status:400});
    const id = crypto.randomUUID();
    const amount_brl = amount_zp;
    await env.DB.prepare("INSERT INTO withdrawals (id, user_id, amount_zp, amount_brl, pix_key, status, created_at) VALUES (?,?,?,?,?, 'pending', datetime('now'))").bind(id, user_id, amount_zp, amount_brl, pix_key).run();
    await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(portfolio.cash_zp - amount_zp, user_id).run();
    return Response.json({ok:true, id});
  } catch(e){ return Response.json({error:e.message}, {status:500}); }
}
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const user_id = url.searchParams.get('user_id');
    if(user_id){
      const res = await env.DB.prepare("SELECT * FROM withdrawals WHERE user_id=? ORDER BY created_at DESC").bind(user_id).all();
      return Response.json(res.results||[]);
    }
    const res = await env.DB.prepare("SELECT w.*, u.email, u.username FROM withdrawals w JOIN users u ON u.id=w.user_id WHERE w.status='pending' ORDER BY w.created_at DESC").all();
    return Response.json(res.results||[]);
  } catch(e){ return Response.json([]); }
}
