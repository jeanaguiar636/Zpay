export async function onRequestGet({request, env}){
  try{
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS credit_packages (id TEXT PRIMARY KEY, amount_zp REAL, amount_brl REAL, label TEXT, active INTEGER, created_at TEXT)").run();
    }catch{}
    try{ await env.DB.prepare("ALTER TABLE credit_packages ADD COLUMN amount_brl REAL").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE credit_packages ADD COLUMN amount_zp REAL").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE credit_packages ADD COLUMN label TEXT").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE credit_packages ADD COLUMN active INTEGER DEFAULT 1").run(); }catch{}
    
    // Se ainda falha, dropa e recria
    try{
      await env.DB.prepare("SELECT amount_brl FROM credit_packages LIMIT 1").first();
    }catch{
      await env.DB.prepare("DROP TABLE IF EXISTS credit_packages").run();
      await env.DB.prepare("CREATE TABLE credit_packages (id TEXT PRIMARY KEY, amount_zp REAL, amount_brl REAL, label TEXT, active INTEGER, created_at TEXT)").run();
      // Insere padrão
      const pacotes = [
        {zp:200, brl:2, label:"200 ZP$ - Teste"},
        {zp:500, brl:5, label:"500 ZP$ - Iniciante"},
        {zp:1000, brl:10, label:"1.000 ZP$"},
        {zp:5000, brl:45, label:"5.000 ZP$ - Mais vendido"},
        {zp:10000, brl:80, label:"10.000 ZP$"},
        {zp:5000, brl:50, label:"5.000 ZP$"},
        {zp:10000, brl:100, label:"10.000 ZP$ - Premium"}
      ];
      for(const p of pacotes){
        await env.DB.prepare("INSERT INTO credit_packages (id, amount_zp, amount_brl, label, active, created_at) VALUES (?,?,?,?,1, datetime('now'))").bind(crypto.randomUUID(), p.zp, p.brl, p.label).run();
      }
    }
    
    const rows = await env.DB.prepare("SELECT * FROM credit_packages WHERE active=1 ORDER BY amount_brl ASC").all();
    let packages = rows.results||[];
    
    // Se não tem pacotes no banco, retorna padrão
    if(packages.length===0){
      packages = [
        {id:'1', amount_zp:200, amount_brl:2, label:"200 ZP$ - Teste"},
        {id:'2', amount_zp:500, amount_brl:5, label:"500 ZP$ - Iniciante"},
        {id:'3', amount_zp:1000, amount_brl:10, label:"1.000 ZP$"},
        {id:'4', amount_zp:5000, amount_brl:45, label:"5.000 ZP$ - Mais vendido"},
        {id:'5', amount_zp:10000, amount_brl:80, label:"10.000 ZP$"},
        {id:'6', amount_zp:5000, amount_brl:50, label:"5.000 ZP$"},
        {id:'7', amount_zp:10000, amount_brl:100, label:"10.000 ZP$ - Premium"}
      ];
    }
    
    return Response.json({ok:true, packages});
  }catch(e){
    return Response.json({error:e.message}, {status:500});
  }
}
