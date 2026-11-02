export async function onRequestGet({request, env}){
  const auth = request.headers.get("Authorization")||"";
  const token = auth.replace("Bearer ","").trim();
  if(!token) return Response.json({error:"Sem token"}, {status:401});
  try{
    try{ await env.DB.prepare("ALTER TABLE portfolios ADD COLUMN cash_zp INTEGER DEFAULT 5000").run(); }catch{}
    try{ await env.DB.prepare("ALTER TABLE portfolios ADD COLUMN total_value INTEGER DEFAULT 5000").run(); }catch{}
    
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sessão expirada - faça login de novo"}, {status:401});
    
    let port = await env.DB.prepare("SELECT cash_zp, total_value FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
    if(!port){
      try{
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO portfolios (id, user_id, cash_zp, total_value) VALUES (?,?,?,?)").bind(id, sess.user_id, 5000, 5000).run();
      }catch{
        await env.DB.prepare("INSERT OR REPLACE INTO portfolios (user_id, cash_zp, total_value) VALUES (?,?,?)").bind(sess.user_id, 5000, 5000).run();
      }
      port = {cash_zp:5000, total_value:5000};
    }
    
    let user = await env.DB.prepare("SELECT id, email, username FROM users WHERE id=?").bind(sess.user_id).first();
    if(!user) user = {id:sess.user_id, email:"", username:""};
    
    return Response.json({ok:true, user, email:user.email, username:user.username, portfolio:port, cash_zp:port.cash_zp, total_value:port.total_value});
  }catch(e){
    return Response.json({error:e.message}, {status:500});
  }
}
