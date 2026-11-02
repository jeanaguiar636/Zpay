export async function onRequestPost({request, env}){
  try{
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, username TEXT, password_hash TEXT)").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS portfolios (id TEXT PRIMARY KEY, user_id TEXT UNIQUE, cash_zp INTEGER DEFAULT 5000, total_value INTEGER DEFAULT 5000)").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT, created_at TEXT)").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE users ADD COLUMN username TEXT").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE portfolios ADD COLUMN cash_zp INTEGER DEFAULT 5000").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE sessions ADD COLUMN created_at TEXT").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE sessions ADD COLUMN user_id TEXT").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)").run(); }catch{}
    
    const {email, password} = await request.json();
    if(!email || !password) return Response.json({error:"Email e senha obrigatórios"}, {status:400});
    
    const user = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
    if(!user) return Response.json({error:"Usuário não existe - cadastre"}, {status:404});
    
    // Verifica senha simples (hash simples pra demo - em prod use bcrypt)
    if(user.password_hash !== btoa(password) && user.password_hash !== password){
      // tenta com btoa
      if(user.password_hash !== btoa(password)) return Response.json({error:"Senha errada"}, {status:401});
    }
    
    const cfg = await env.DB.prepare("SELECT value FROM config WHERE key='bonus_iniciante'").bind().first();
    // session
    const token = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO sessions (id, user_id, created_at) VALUES (?,?, datetime('now'))").bind(token, user.id).run();
    
    let port = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(user.id).first();
    if(!port){
      const bonus = parseInt(cfg?.value||"5000");
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO portfolios (id, user_id, cash_zp, total_value) VALUES (?,?,?,?)").bind(id, user.id, bonus, bonus).run();
      port = {cash_zp:bonus};
    }
    
    return Response.json({ok:true, token, user:{id:user.id, email:user.email, username:user.username}, cash_zp:port.cash_zp});
  }catch(e){
    return Response.json({error:e.message}, {status:500});
  }
}
