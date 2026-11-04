
export async function onRequestPost({request, env}){
  try{
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, username TEXT, password_hash TEXT)").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS portfolios (user_id TEXT PRIMARY KEY, cash_zp INTEGER DEFAULT 5000, total_value INTEGER DEFAULT 5000)").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT, created_at TEXT)").run(); }catch{}

    let body = {};
    const ct = request.headers.get('content-type')||'';
    try{
      if(ct.includes('json')){
        body = await request.json();
      } else if(ct.includes('form')){
        const fd = await request.formData();
        fd.forEach((v,k)=> body[k]=v);
      } else {
        try{ body = await request.json(); }catch{
          try{ const t = await request.text(); body = JSON.parse(t); }catch{}
        }
      }
    }catch{}

    const email = (body.email || body.Email || body.username || body.user || body.mail || '').toString().trim().toLowerCase();
    const password = (body.password || body.senha || body.pass || '').toString().trim();

    if(!email || !password) return Response.json({error:"Email e senha obrigatórios - login recebeu email='"+email+"'"}, {status:400});

    const user = await env.DB.prepare("SELECT * FROM users WHERE email=? OR username=?").bind(email, email).first();
    if(!user) return Response.json({error:"Usuário não existe - clique em CADASTRAR amarelo"}, {status:404});

    const tryHashes = [btoa(password), password];
    let ok = false;
    for(const h of tryHashes){ if(user.password_hash === h){ ok = true; break; } }
    try{ if(atob(user.password_hash) === password) ok = true; }catch{}
    if(!ok) return Response.json({error:"Senha errada"}, {status:401});

    const token = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO sessions (id, user_id, created_at) VALUES (?,?, datetime('now'))").bind(token, user.id).run();

    let port = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(user.id).first();
    if(!port){
      const cfg = await env.DB.prepare("SELECT value FROM config WHERE key='bonus_iniciante'").first();
      const bonus = parseInt(cfg?.value||"5000");
      try{
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO portfolios (id, user_id, cash_zp, total_value) VALUES (?,?,?,?)").bind(id, user.id, bonus, bonus).run();
      }catch{
        await env.DB.prepare("INSERT OR REPLACE INTO portfolios (user_id, cash_zp, total_value) VALUES (?,?,?)").bind(user.id, bonus, bonus).run();
      }
      port = {cash_zp:bonus};
    }

    return Response.json({ok:true, token, user:{id:user.id, email:user.email, username:user.username}, cash_zp:port.cash_zp});
  }catch(e){
    return Response.json({error:"Erro login: "+e.message}, {status:500});
  }
}
