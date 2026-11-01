export async function onRequestPost({ request, env }) {
  const { username, email, password } = await request.json();
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
  if (existing) return Response.json({error:'Email já cadastrado'}, {status:400});
  const id = crypto.randomUUID();
  const hash = btoa(password);
  await env.DB.prepare("INSERT INTO users (id, username, email, password_hash, balance, created_at) VALUES (?,?,?,?,?, datetime('now'))").bind(id, username, email, hash, 5000).first();
  await env.DB.prepare("INSERT INTO portfolios (id, user_id, cash_zp, total_value) VALUES (?,?,?,?)").bind(crypto.randomUUID(), id, 5000, 5000).first();
  return Response.json({ok:true});
}
