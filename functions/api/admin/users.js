export async function onRequestGet({request, env}){
  try{
    // Tenta com cash_zp, se falhar tenta sem
    let users;
    try{
      users = await env.DB.prepare("SELECT u.id, u.email, u.username, p.cash_zp FROM users u LEFT JOIN portfolios p ON u.id=p.user_id ORDER BY p.cash_zp DESC LIMIT 100").all();
    }catch{
      users = await env.DB.prepare("SELECT id, email, username FROM users ORDER BY email DESC LIMIT 100").all();
    }
    return Response.json({ok:true, users: users.results||[]});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
export async function onRequestPost({request, env}){
  try{
    const {user_id, cash_zp, amount, action, reason} = await request.json();
    
    if(action==="block"){
      await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user_id).run();
      return Response.json({ok:true});
    }
    
    // DOAÇÃO - Adiciona créditos ao usuário
    if(action==="donate"){
      const addAmount = parseFloat(amount||cash_zp);
      if(!user_id || !addAmount) return Response.json({error:"user_id e amount obrigatórios"}, {status:400});
      
      // Cria tabela de doações se não existe
      try{
        await env.DB.prepare("CREATE TABLE IF NOT EXISTS donations (id TEXT PRIMARY KEY, user_id TEXT, amount_zp REAL, reason TEXT, created_at TEXT)").run();
      }catch{}
      
      // Pega saldo atual
      let port;
      try{
        port = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(user_id).first();
      }catch{}
      
      const currentCash = port?.cash_zp || 0;
      const newCash = currentCash + addAmount;
      
      try{
        await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(newCash, user_id).run();
      }catch{
        // Se não tem portfolio, cria
        try{
          const id = crypto.randomUUID();
          await env.DB.prepare("INSERT INTO portfolios (id, user_id, cash_zp, total_value) VALUES (?,?,?,?)").bind(id, user_id, newCash, newCash).run();
        }catch{
          await env.DB.prepare("INSERT OR REPLACE INTO portfolios (user_id, cash_zp, total_value) VALUES (?,?,?)").bind(user_id, newCash, newCash).run();
        }
      }
      
      // Registra doação
      try{
        await env.DB.prepare("INSERT INTO donations (id, user_id, amount_zp, reason, created_at) VALUES (?,?,?,?, datetime('now'))").bind(crypto.randomUUID(), user_id, addAmount, reason||'Doação admin',).run();
      }catch{}
      
      return Response.json({ok:true, new_cash: newCash, donated: addAmount});
    }
    
    // EDITAR SALDO DIRETO (antigo)
    if(user_id && cash_zp!=null){
      await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(cash_zp, user_id).run();
      return Response.json({ok:true});
    }
    
    return Response.json({error:"Inválido"}, {status:400});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
