export async function onRequestPost({ request, env }) {
  try {
    const { user_id, asset, side, quantity, price, fee } = await request.json();
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO trades (id, user_id, asset, side, quantity, price, fee, created_at) VALUES (?,?,?,?,?,?,?, datetime('now'))").bind(id, user_id, asset, side, quantity, price, fee||0).run();
    const portfolio = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(user_id).first();
    if(portfolio){
      let newCash = portfolio.cash_zp;
      if(side==='buy') newCash -= (quantity*price + (fee||0));
      else newCash += (quantity*price - (fee||0));
      await env.DB.prepare("UPDATE portfolios SET cash_zp=?, total_value=? WHERE user_id=?").bind(newCash, newCash, user_id).run();
      await env.DB.prepare("INSERT INTO transactions (id, user_id, type, amount_zp, created_at) VALUES (?,?,?,?, datetime('now'))").bind(crypto.randomUUID(), user_id, side, quantity*price).run();
    }
    return Response.json({ok:true, id});
  } catch(e){ return Response.json({error:e.message}, {status:500}); }
}
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const user_id = url.searchParams.get('user_id');
    const res = await env.DB.prepare("SELECT * FROM trades WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(user_id).all();
    return Response.json(res.results||[]);
  } catch(e){ return Response.json([]); }
}
