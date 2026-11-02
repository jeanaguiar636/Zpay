export async function onRequestPost({ request, env }) {
  try {
    const { username, email, password } = await request.json();
    if (!username || !email || !password) return Response.json({error:'Faltando dados'}, {status:400});
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if (existing) return Response.json({error:'Email já cadastrado'}, {status:400});
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO users (id, username, email, password_hash, balance, created_at) VALUES (?,?,?,?,?, datetime('now'))").bind(id, username, email, btoa(password), 5000).run();
    try { await env.DB.prepare("INSERT INTO portfolios (id, user_id, cash_zp, total_value) VALUES (?,?,?,?)").bind(crypto.randomUUID(), id, 5000, 5000).run(); } catch {}
    const token = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO sessions (id, user_id, created_at) VALUES (?,?, datetime('now'))").bind(token, id).run();
    return Response.json({ok:true, token, user:{id, username, email}});
  } catch(e){ return Response.json({error:e.message}, {status:500}); }
}
