export async function onRequestPost({request, env}){
  const auth = request.headers.get("Authorization")||"";
  const token = auth.replace("Bearer ","").trim();
  if(!token) return Response.json({error:"Sem token - faça login primeiro"}, {status:401});
  try{
    // Cria tabela com schema novo se não existe
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS withdrawals (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, pix_type TEXT, pix_key TEXT, amount_zp REAL, amount_brl REAL, status TEXT, created_at TEXT)").run();
    }catch(e){}
    
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sessão expirada - faça login de novo"}, {status:401});
    
    const body = await request.json();
    const {name, pix_type, pix_key, amount_zp, amount} = body;
    const valor = amount_zp || amount;
    if(!name||!pix_key||!valor) return Response.json({error:"Preencha nome, chave e valor"}, {status:400});
    
    const id = crypto.randomUUID();
    const amount_brl = parseFloat(valor) * 0.01;
    
    // Tenta inserir com id, se falhar tenta sem id
    try{
      await env.DB.prepare("INSERT INTO withdrawals (id, user_id, name, pix_type, pix_key, amount_zp, amount_brl, status, created_at) VALUES (?,?,?,?,?,?,?,?, datetime('now'))").bind(id, sess.user_id, name, pix_type||'CPF', pix_key, parseFloat(valor), amount_brl, "pendente").run();
    }catch(err){
      // Tabela antiga sem id ou com colunas diferentes - tenta sem id
      try{
        await env.DB.prepare("INSERT INTO withdrawals (user_id, name, pix_type, pix_key, amount_zp, amount_brl, status, created_at) VALUES (?,?,?,?,?,?,?, datetime('now'))").bind(sess.user_id, name, pix_type||'CPF', pix_key, parseFloat(valor), amount_brl, "pendente").run();
      }catch(err2){
        // Última tentativa - schema mais simples
        await env.DB.prepare("INSERT INTO withdrawals (user_id, name, pix_key, amount_zp, status) VALUES (?,?,?, ?, 'pendente')").bind(sess.user_id, name, pix_key, parseFloat(valor)).run();
      }
    }
    
    return Response.json({ok:true, id, amount_zp:valor, amount_brl});
  }catch(e){
    return Response.json({error:"Erro saque: "+e.message+" - "+e.stack}, {status:500});
  }
}
export async function onRequestGet({request, env}){
  return Response.json({ok:true, msg:"Use POST para pedir saque"});
}
