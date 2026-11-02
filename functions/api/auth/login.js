export async function onRequestPost({ request, env }) {
  try {
    const { email, password } = await request.json();
    const hash = btoa(password);
    const user = await env.DB.prepare("SELECT id, username, email FROM users WHERE email=? AND password_hash=?").bind(email, hash).first();
    if (!user) return Response.json({error:'Email ou senha inválidos'}, {status:401});
    const token = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO sessions (id, user_id, created_at) VALUES (?,?, datetime('now'))").bind(token, user.id).run();
    const portfolio = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(user.id).first();
    return Response.json({token, user:{...user, balance: portfolio?.cash_zp || 5000}});
  } catch(e){ return Response.json({error:e.message}, {status:500}); }
}
