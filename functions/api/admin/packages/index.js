export async function onRequestGet({request, env}){
  try{
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS credit_packages (id TEXT PRIMARY KEY, amount_zp REAL, amount_brl REAL, label TEXT, active INTEGER, created_at TEXT)").run();
    }catch{}
    
    // FIX: Adiciona colunas se não existem (resolve erro no such column)
    try{ await env.DB.prepare("ALTER TABLE credit_packages ADD COLUMN amount_brl REAL").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE credit_packages ADD COLUMN amount_zp REAL").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE credit_packages ADD COLUMN label TEXT").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE credit_packages ADD COLUMN active INTEGER DEFAULT 1").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE credit_packages ADD COLUMN created_at TEXT").run(); }catch{}
    
    // Se deu erro de coluna, apaga e recria do zero
    try{
      await env.DB.prepare("SELECT amount_brl FROM credit_packages LIMIT 1").first();
    }catch{
      // Coluna não existe, dropa tudo e recria
      await env.DB.prepare("DROP TABLE IF EXISTS credit_packages").run();
      await env.DB.prepare("CREATE TABLE credit_packages (id TEXT PRIMARY KEY, amount_zp REAL, amount_brl REAL, label TEXT, active INTEGER, created_at TEXT)").run();
    }
    
    // Cria pacotes padrão se não existem
    try{
      const count = await env.DB.prepare("SELECT COUNT(*) as c FROM credit_packages").first();
      if(!count || count.c==0){
        const pacotes = [
          {zp:200, brl:2, label:"200 ZP$ - Teste"},
          {zp:500, brl:5, label:"500 ZP$ - Iniciante"},
          {zp:1000, brl:10, label:"1.000 ZP$"},
          {zp:2000, brl:20, label:"2.000 ZP$"},
          {zp:5000, brl:45, label:"5.000 ZP$ - Mais vendido"},
          {zp:5000, brl:50, label:"5.000 ZP$"},
          {zp:10000, brl:80, label:"10.000 ZP$"},
          {zp:10000, brl:100, label:"10.000 ZP$ - Premium"}
        ];
        for(const p of pacotes){
          await env.DB.prepare("INSERT INTO credit_packages (id, amount_zp, amount_brl, label, active, created_at) VALUES (?,?,?,?,1, datetime('now'))").bind(crypto.randomUUID(), p.zp, p.brl, p.label).run();
        }
      }
    }catch(e){}
    
    const rows = await env.DB.prepare("SELECT * FROM credit_packages ORDER BY amount_brl ASC").all();
    return Response.json({ok:true, packages: rows.results||[]});
  }catch(e){
    return Response.json({error:e.message}, {status:500});
  }
}

export async function onRequestPost({request, env}){
  try{
    // Garante tabela existe com colunas novas
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS credit_packages (id TEXT PRIMARY KEY, amount_zp REAL, amount_brl REAL, label TEXT, active INTEGER, created_at TEXT)").run();
    }catch{}
    try{ await env.DB.prepare("ALTER TABLE credit_packages ADD COLUMN amount_brl REAL").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE credit_packages ADD COLUMN amount_zp REAL").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE credit_packages ADD COLUMN label TEXT").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE credit_packages ADD COLUMN active INTEGER DEFAULT 1").run(); }catch{}
    
    const {id, amount_zp, amount_brl, label, active, action} = await request.json();
    
    if(action==="delete" && id){
      await env.DB.prepare("DELETE FROM credit_packages WHERE id=?").bind(id).run();
      return Response.json({ok:true});
    }
    
    if(action==="toggle" && id){
      await env.DB.prepare("UPDATE credit_packages SET active=? WHERE id=?").bind(active?1:0, id).run();
      return Response.json({ok:true});
    }
    
    if(id){
      // Update
      await env.DB.prepare("UPDATE credit_packages SET amount_zp=?, amount_brl=?, label=?, active=? WHERE id=?").bind(amount_zp, amount_brl, label, active?1:0, id).run();
      return Response.json({ok:true});
    } else {
      // Create
      await env.DB.prepare("INSERT INTO credit_packages (id, amount_zp, amount_brl, label, active, created_at) VALUES (?,?,?,?,1, datetime('now'))").bind(crypto.randomUUID(), amount_zp, amount_brl, label).run();
      return Response.json({ok:true});
    }
  }catch(e){
    return Response.json({error:e.message}, {status:500});
  }
}
