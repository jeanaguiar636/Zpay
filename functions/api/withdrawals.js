export async function onRequestPost({request, env}){
  try{
    const auth = request.headers.get("Authorization")||"";
    const token = auth.replace("Bearer ","").trim();
    if(!token) return Response.json({error:"Sem token"}, {status:401});
    
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sem login"}, {status:401});
    
    // Cria tabelas necessárias
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS withdrawals (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, pix_type TEXT, pix_key TEXT, amount_zp REAL, amount_brl REAL, amount_pix_zp REAL, amount_zbank_zp REAL, original_amount_zp REAL, status TEXT, created_at TEXT)").run();
    }catch{}
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS zbank_accounts (user_id TEXT PRIMARY KEY, savings_zp REAL DEFAULT 0, total_earned REAL DEFAULT 0, created_at TEXT)").run();
    }catch{}
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS zbank_transactions (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, amount_zp REAL, from_source TEXT, to_dest TEXT, created_at TEXT)").run();
    }catch{}
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS caixa_mercadopago (id TEXT PRIMARY KEY, balance_brl REAL DEFAULT 0, total_deposits_brl REAL DEFAULT 0, total_withdrawals_brl REAL DEFAULT 0, updated_at TEXT)").run();
    }catch{}
    
    // Garante colunas novas existem (migração segura)
    try{ await env.DB.prepare("ALTER TABLE withdrawals ADD COLUMN amount_pix_zp REAL").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE withdrawals ADD COLUMN amount_zbank_zp REAL").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE withdrawals ADD COLUMN original_amount_zp REAL").run(); }catch{}
    
    const body = await request.json();
    const {name, pix_type, pix_key, amount_zp} = body;
    const originalAmount = parseFloat(amount_zp);
    if(!originalAmount || originalAmount<=0) return Response.json({error:"Valor inválido"}, {status:400});
    
    // Verifica saldo
    let port = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
    const cash = port?.cash_zp||0;
    if(cash < originalAmount) return Response.json({error:"Saldo insuficiente. Você tem ZP$ "+cash}, {status:400});
    
    // REGRA 70/30
    const amountPixZp = Math.round(originalAmount * 0.7 * 100)/100;
    const amountZbankZp = Math.round(originalAmount * 0.3 * 100)/100;
    const amountBrlPix = Math.round(amountPixZp * 0.01 * 100)/100; // 1 ZP$ = R$0,01
    
    // SEGURANÇA: Verifica caixa real Mercado Pago (70% precisa ter lastro)
    try{
      let caixa = await env.DB.prepare("SELECT * FROM caixa_mercadopago ORDER BY updated_at DESC LIMIT 1").first();
      if(caixa){
        const disponivelReal = (caixa.balance_brl||0);
        if(disponivelReal < amountBrlPix){
          // Não bloqueia, mas alerta - casa precisa ter caixa
          console.log("ALERTA CAIXA: Saque Pix R$"+amountBrlPix+" maior que caixa R$"+disponivelReal);
        }
      }
    }catch{}
    
    // Deduz saldo total do usuário
    const newCash = cash - originalAmount;
    await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(newCash, sess.user_id).run();
    
    // 30% vai para ZP Bank (poupança)
    let zbank = await env.DB.prepare("SELECT savings_zp FROM zbank_accounts WHERE user_id=?").bind(sess.user_id).first();
    if(!zbank){
      await env.DB.prepare("INSERT INTO zbank_accounts (user_id, savings_zp, total_earned, created_at) VALUES (?,?,0, datetime('now'))").bind(sess.user_id, amountZbankZp).run();
    }else{
      const novoSaldoZbank = (zbank.savings_zp||0) + amountZbankZp;
      await env.DB.prepare("UPDATE zbank_accounts SET savings_zp=?, total_earned=total_earned+? WHERE user_id=?").bind(novoSaldoZbank, amountZbankZp, sess.user_id).run();
    }
    
    // Registra transação ZBank
    await env.DB.prepare("INSERT INTO zbank_transactions (id, user_id, type, amount_zp, from_source, to_dest, created_at) VALUES (?,?,?,?,?,?, datetime('now'))").bind(crypto.randomUUID(), sess.user_id, 'DEPOSITO_SAQUE_30', amountZbankZp, 'AGROPAY_SAQUE', 'ZBANK_POUPANCA').run();
    
    // 70% vai para fila de saque Pix
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO withdrawals (id, user_id, name, pix_type, pix_key, amount_zp, amount_brl, amount_pix_zp, amount_zbank_zp, original_amount_zp, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, datetime('now'))").bind(id, sess.user_id, name, pix_type, pix_key, amountPixZp, amountBrlPix, amountPixZp, amountZbankZp, originalAmount, 'pendente').run();
    
    return Response.json({
      ok:true, 
      id,
      original_amount_zp: originalAmount,
      amount_pix_zp: amountPixZp,
      amount_pix_brl: amountBrlPix,
      amount_zbank_zp: amountZbankZp,
      message: `Saque dividido: 70% Pix (ZP$ ${amountPixZp} = R$ ${amountBrlPix}) + 30% ZP Bank (ZP$ ${amountZbankZp})`
    });
  }catch(e){
    return Response.json({error:e.message}, {status:500});
  }
}

export async function onRequestGet({request, env}){
  try{
    const auth = request.headers.get("Authorization")||"";
    const token = auth.replace("Bearer ","").trim();
    if(!token) return Response.json({error:"Sem token"}, {status:401});
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sem login"}, {status:401});
    const rows = await env.DB.prepare("SELECT * FROM withdrawals WHERE user_id=? ORDER BY created_at DESC LIMIT 20").all();
    return Response.json({ok:true, withdrawals: rows.results||[]});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
