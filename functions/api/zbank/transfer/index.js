export async function onRequestPost({request, env}){
  try{
    const auth = request.headers.get("Authorization")||"";
    const token = auth.replace("Bearer ","").trim();
    if(!token) return Response.json({ok:false, error:"Sem token - faça login no AgroPay"}, {status:401});
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS zbank_accounts (user_id TEXT PRIMARY KEY, savings_zp REAL DEFAULT 0, total_earned REAL DEFAULT 0, created_at TEXT)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS zbank_transactions (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, amount_zp REAL, from_source TEXT, to_dest TEXT, created_at TEXT)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS portfolios (user_id TEXT PRIMARY KEY, cash_zp REAL DEFAULT 5000, total_value REAL DEFAULT 5000)").run();
    }catch{}
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({ok:false, error:"Sessão expirada - logue de novo em MINHA CONTA"}, {status:401});
    
    let body={};
    try{ body=await request.json(); }catch{ return Response.json({ok:false, error:"JSON inválido"}, {status:400}); }
    const {amount_zp, direction, amount} = body;
    const raw = amount_zp || amount;
    const val = parseFloat(raw);
    if(!val || val<=0) return Response.json({ok:false, error:"Digite um valor válido ex: 100"}, {status:400});
    
    let acc = await env.DB.prepare("SELECT savings_zp FROM zbank_accounts WHERE user_id=?").bind(sess.user_id).first();
    if(!acc){
      await env.DB.prepare("INSERT OR IGNORE INTO zbank_accounts (user_id, savings_zp, total_earned, created_at) VALUES (?,?,0, datetime('now'))").bind(sess.user_id, 0).run();
      acc={savings_zp:0};
    }
    let port = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
    if(!port){
      await env.DB.prepare("INSERT OR IGNORE INTO portfolios (user_id, cash_zp, total_value) VALUES (?,?,?)").bind(sess.user_id, 5000, 5000).run();
      port={cash_zp:5000};
    }
    const cashAgro = parseFloat(port?.cash_zp||0);
    const savingsZbank = parseFloat(acc?.savings_zp||0);
    
    if(direction==="to_zbank" || direction==="guardar"){
      if(cashAgro < val) return Response.json({ok:false, error:"Saldo AgroPay insuficiente. Você tem ZP$ "+cashAgro.toFixed(2)}, {status:400});
      const newCash = Math.round((cashAgro - val)*100)/100;
      const newSavings = Math.round((savingsZbank + val)*100)/100;
      await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(newCash, sess.user_id).run();
      await env.DB.prepare("UPDATE zbank_accounts SET savings_zp=? WHERE user_id=?").bind(newSavings, sess.user_id).run();
      await env.DB.prepare("INSERT INTO zbank_transactions (id, user_id, type, amount_zp, from_source, to_dest, created_at) VALUES (?,?,?,?,?,?, datetime('now'))").bind(crypto.randomUUID(), sess.user_id, 'GUARDAR_ZBANK', val, 'AGROPAY', 'ZBANK').run();
      return Response.json({ok:true, cash_agropay: newCash, savings_zbank: newSavings, message: "Guardado ZP$ "+val+" no ZBank! Amarelo grande agora: ZP$ "+newSavings.toFixed(2)});
    }else{
      // to_agropay - Botão amarelo USAR SALDO ZBANK -> AGROPAY
      if(savingsZbank < val) return Response.json({ok:false, error:"Saldo ZBank insuficiente. No amarelo você tem ZP$ "+savingsZbank.toFixed(2)+". Primeiro GUARDE no ZBank!"}, {status:400});
      const newSavings = Math.round((savingsZbank - val)*100)/100;
      const newCash = Math.round((cashAgro + val)*100)/100;
      await env.DB.prepare("UPDATE zbank_accounts SET savings_zp=? WHERE user_id=?").bind(newSavings, sess.user_id).run();
      await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(newCash, sess.user_id).run();
      await env.DB.prepare("INSERT INTO zbank_transactions (id, user_id, type, amount_zp, from_source, to_dest, created_at) VALUES (?,?,?,?,?,?, datetime('now'))").bind(crypto.randomUUID(), sess.user_id, 'USAR_SALDO_ZBANK', val, 'ZBANK', 'AGROPAY').run();
      return Response.json({ok:true, cash_agropay: newCash, savings_zbank: newSavings, message: "Puxado ZP$ "+val+" do ZBank para AgroPay! Agora pode operar café sem Pix!"});
    }
  }catch(e){ 
    return Response.json({ok:false, error:"Erro ZBank transfer: "+e.message}, {status:500}); 
  }
}

export async function onRequestGet({request, env}){
  return Response.json({ok:true, info:"Use POST com {amount_zp, direction: 'to_zbank' ou 'to_agropay'}"});
}
