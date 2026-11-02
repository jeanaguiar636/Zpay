export async function onRequestPost({request, env}){
  const auth = request.headers.get("Authorization")||"";
  const token = auth.replace("Bearer ","").trim();
  if(!token) return Response.json({error:"Sem token"}, {status:401});
  try{
    try{ await env.DB.prepare("ALTER TABLE portfolios ADD COLUMN cash_zp INTEGER DEFAULT 5000").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS trades (id TEXT PRIMARY KEY, user_id TEXT, commodity TEXT, type TEXT, qty INTEGER, price_zp REAL, fee_zp REAL, created_at TEXT)").run(); }catch{}
    
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sem login - faça login de novo"}, {status:401});
    
    const body = await request.json();
    const commodity = body.commodity || "CAFÉ";
    const type = body.type || "BUY";
    const qty = body.qty || 1;
    const price = body.price || 121.97;
    const fee = 0.48;
    
    let port = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
    if(!port){
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO portfolios (id, user_id, cash_zp, total_value) VALUES (?,?,?,?)").bind(id, sess.user_id, 5000, 5000).run();
      port = {cash_zp:5000};
    }
    
    const cash = port.cash_zp || 5000;
    let newCash;
    if(type==="BUY"){
      newCash = cash - (price*qty) - fee;
      if(newCash < 0) return Response.json({error:"Saldo insuficiente"}, {status:400});
    } else {
      newCash = cash + (price*qty) - fee;
    }
    
    await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(Math.round(newCash*100)/100, sess.user_id).run();
    
    const tradeId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO trades (id, user_id, commodity, type, qty, price_zp, fee_zp, created_at) VALUES (?,?,?,?,?,?,?, datetime('now'))").bind(tradeId, sess.user_id, commodity, type, qty, price, fee).run();
    
    return Response.json({ok:true, cash_zp: newCash, trade_id: tradeId, commodity, type, price});
  }catch(e){
    return Response.json({error:e.message}, {status:500});
  }
}
export async function onRequestGet({request, env}){
  return Response.json({ok:true, msg:"Use POST"});
}
