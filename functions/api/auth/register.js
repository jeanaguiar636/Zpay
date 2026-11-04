
export async function onRequestPost({request, env}){
  try{
    // Cria tabelas se não existem
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, username TEXT, password_hash TEXT)").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS portfolios (user_id TEXT PRIMARY KEY, cash_zp INTEGER DEFAULT 5000, total_value INTEGER DEFAULT 5000)").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT, created_at TEXT)").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE users ADD COLUMN username TEXT").run(); }catch{}
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)").run(); }catch{}

    // TENTA LER DE TODOS OS JEITOS POSSÍVEIS
    let body = {};
    const contentType = request.headers.get('content-type')||'';
    try{
      if(contentType.includes('application/json')){
        body = await request.json();
      } else if(contentType.includes('form')){
        const fd = await request.formData();
        fd.forEach((v,k)=> body[k]=v);
      } else {
        // tenta JSON mesmo sem content-type
        try{ body = await request.json(); }catch{
          try{
            const txt = await request.text();
            body = JSON.parse(txt);
          }catch{}
        }
      }
    }catch(e){}

    // ACEITA VÁRIOS NOMES DE CAMPO
    const email = (body.email || body.Email || body.EMAIL || body.username || body.user || body.mail || body.e_mail || '').toString().trim().toLowerCase();
    const password = (body.password || body.Password || body.senha || body.pass || '').toString().trim();
    const username = (body.username || body.user || (email?email.split('@')[0]:'') || '').toString().trim();

    console.log('REGISTER tentativa:', email, 'body keys:', Object.keys(body));

    if(!email || !password){
      return Response.json({error:"Email e senha obrigatórios - recebi: email='"+email+"' senha tem? "+(password?'sim':'não')+" - campos: "+Object.keys(body).join(',')}, {status:400});
    }

    if(!email.includes('@')){
      return Response.json({error:"Email inválido, precisa ter @ - você mandou: "+email}, {status:400});
    }

    const exists = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if(exists) return Response.json({error:"Email já existe - clique em ENTRAR verde"}, {status:400});

    const cfg = await env.DB.prepare("SELECT value FROM config WHERE key='bonus_iniciante'").first();
    const bonus = parseInt(cfg?.value||"5000");

    const userId = crypto.randomUUID();
    const passHash = btoa(password);
    await env.DB.prepare("INSERT INTO users (id, email, username, password_hash) VALUES (?,?,?,?)").bind(userId, email, username||email.split('@')[0], passHash).run();

    try{
      const portId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO portfolios (id, user_id, cash_zp, total_value) VALUES (?,?,?,?)").bind(portId, userId, bonus, bonus).run();
    }catch{
      try{
        await env.DB.prepare("INSERT INTO portfolios (user_id, cash_zp, total_value) VALUES (?,?,?)").bind(userId, bonus, bonus).run();
      }catch(e){
        await env.DB.prepare("INSERT OR REPLACE INTO portfolios (user_id, cash_zp, total_value) VALUES (?,?,?)").bind(userId, bonus, bonus).run();
      }
    }

    const token = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO sessions (id, user_id, created_at) VALUES (?,?, datetime('now'))").bind(token, userId).run();

    return Response.json({ok:true, token, bonus, user:{id:userId, email, username:username||email.split('@')[0]}, cash_zp:bonus});
  }catch(e){
    return Response.json({error:"Erro cadastro: "+e.message+" stack:"+e.stack}, {status:500});
  }
}
