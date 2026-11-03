export async function onRequestPost({request, env}){
  try{
    const auth = request.headers.get("Authorization")||"";
    const token = auth.replace("Bearer ","").trim();
    if(!token) return Response.json({error:"Sem token"}, {status:401});
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS zbank_accounts (user_id TEXT PRIMARY KEY, savings_zp REAL DEFAULT 0, total_earned REAL DEFAULT 0, created_at TEXT)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS zbank_transactions (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, amount_zp REAL, from_source TEXT, to_dest TEXT, created_at TEXT)").run();
    }catch{}
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sessão expirada"}, {status:401});
    
    const {amount_zp, direction} = await request.json();
    const amount = parseFloat(amount_zp);
    if(!amount || amount<=0) return Response.json({error:"Valor inválido"}, {status:400});
    
    let acc = await env.DB.prepare("SELECT savings_zp FROM zbank_accounts WHERE user_id=?").bind(sess.user_id).first();
    if(!acc){
      await env.DB.prepare("INSERT INTO zbank_accounts (user_id, savings_zp, total_earned, created_at) VALUES (?,?,0, datetime('now'))").bind(sess.user_id, 0).run();
      acc={savings_zp:0};
    }
    let port = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
    const cashAgro = port?.cash_zp||0;
    const savingsZbank = acc.savings_zp||0;
    
    if(direction==="to_zbank"){
      // AgroPay -> ZBank
      if(cashAgro < amount) return Response.json({error:"Saldo AgroPay insuficiente"}, {status:400});
      const newCash = cashAgro - amount;
      const newSavings = savingsZbank + amount;
      await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(newCash, sess.user_id).run();
      await env.DB.prepare("UPDATE zbank_accounts SET savings_zp=? WHERE user_id=?").bind(newSavings, sess.user_id).run();
      await env.DB.prepare("INSERT INTO zbank_transactions (id, user_id, type, amount_zp, from_source, to_dest, created_at) VALUES (?,?,?,?,?,?, datetime('now'))").bind(crypto.randomUUID(), sess.user_id, 'TRANSFERENCIA', amount, 'AGROPAY', 'ZBANK').run();
      return Response.json({ok:true, cash_agropay: newCash, savings_zbank: newSavings, message: `Transferido ZP$ ${amount} para ZP Bank`});
    }else if(direction==="to_agropay" || direction==="usar_saldo_zbank"){
      // ZBank -> AgroPay (Botão Usar Saldo ZBank)
      if(savingsZbank < amount) return Response.json({error:"Saldo ZP Bank insuficiente. Você tem ZP$ "+savingsZbank}, {status:400});
      const newSavings = savingsZbank - amount;
      const newCash = cashAgro + amount;
      await env.DB.prepare("UPDATE zbank_accounts SET savings_zp=? WHERE user_id=?").bind(newSavings, sess.user_id).run();
      await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(newCash, sess.user_id).run();
      await env.DB.prepare("INSERT INTO zbank_transactions (id, user_id, type, amount_zp, from_source, to_dest, created_at) VALUES (?,?,?,?,?,?, datetime('now'))").bind(crypto.randomUUID(), sess.user_id, 'USAR_SALDO_ZBANK', amount, 'ZBANK', 'AGROPAY').run();
      return Response.json({ok:true, cash_agropay: newCash, savings_zbank: newSavings, message: `ZBank ZP$ ${amount} puxado para AgroPay! Pode operar agora sem Pix!`});
    }else{
      return Response.json({error:"direction deve ser to_zbank ou to_agropay"}, {status:400});
    }
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
