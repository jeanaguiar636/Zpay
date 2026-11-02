export async function onRequestPost({request, env}){
  try{
    const token=(request.headers.get("Authorization")||"").replace("Bearer ","");
    const sess=await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:'Sem login'}, {status:401});
    const {commodity, type, qty, price} = await request.json();
    const fee = price*qty*0.005; // 0.5% visível
    const profit = 0; // calcula depois
    const id=crypto.randomUUID();
    try{await env.DB.prepare("CREATE TABLE IF NOT EXISTS trades (id TEXT PRIMARY KEY, user_id TEXT, commodity TEXT, type TEXT, qty INTEGER, price_zp REAL, fee_zp REAL, profit_zp REAL, platform_fee_zp REAL, created_at TEXT)").run();}catch{}
    await env.DB.prepare("INSERT INTO trades (id, user_id, commodity, type, qty, price_zp, fee_zp, profit_zp, platform_fee_zp, created_at) VALUES (?,?,?,?,?,?,?,?,?, datetime('now'))").bind(id, sess.user_id, commodity, type, qty||1, price, fee, 0, fee*0.1).run();
    // Atualiza portfolio
    const port=await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
    const cash = port?.cash_zp||5000;
    const newCash = type==='BUY' ? cash - price*qty - fee : cash + price*qty - fee;
    await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(newCash, sess.user_id).run().catch(async()=>{
      await env.DB.prepare("INSERT INTO portfolios (id, user_id, cash_zp, total_value) VALUES (?,?,?,?)").bind(crypto.randomUUID(), sess.user_id, newCash, newCash).run();
    });
    return Response.json({ok:true, cash_zp:newCash, trade_id:id});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
