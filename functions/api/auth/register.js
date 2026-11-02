export async function onRequestPost({request, env}){
  try{
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, username TEXT, password_hash TEXT)").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS portfolios (user_id TEXT PRIMARY KEY, cash_zp INTEGER DEFAULT 5000, total_value INTEGER DEFAULT 5000)").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT, created_at TEXT)").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE users ADD COLUMN username TEXT").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE portfolios ADD COLUMN cash_zp INTEGER DEFAULT 5000").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)").run(); }catch{}
    
    const {email, password, username} = await request.json();
    if(!email || !password) return Response.json({error:"Email e senha obrigatórios"}, {status:400});
    
    const exists = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if(exists) return Response.json({error:"Email já existe - clique em ENTRAR verde"}, {status:400});
    
    const cfg = await env.DB.prepare("SELECT value FROM config WHERE key='bonus_iniciante'").bind().first();
    const bonus = parseInt(cfg?.value||"5000");
    
    const userId = crypto.randomUUID();
    const passHash = btoa(password);
    await env.DB.prepare("INSERT INTO users (id, email, username, password_hash) VALUES (?,?,?,?)").bind(userId, email, username||email.split('@')[0], passHash).run();
    
    try{
      const portId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO portfolios (id, user_id, cash_zp, total_value) VALUES (?,?,?,?)").bind(portId, userId, bonus, bonus).run();
    }catch{
      await env.DB.prepare("INSERT INTO portfolios (user_id, cash_zp, total_value) VALUES (?,?,?)").bind(userId, bonus, bonus).run();
    }
    
    const token = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO sessions (id, user_id, created_at) VALUES (?,?, datetime('now'))").bind(token, userId).run();
    
    return Response.json({ok:true, token, bonus, user:{id:userId, email, username:username||email.split('@')[0]}, cash_zp:bonus});
  }catch(e){
    return Response.json({error:"Erro cadastro: "+e.message}, {status:500});
  }
}
