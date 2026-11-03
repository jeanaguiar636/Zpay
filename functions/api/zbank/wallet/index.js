export async function onRequestGet({request, env}){
  try{
    const auth = request.headers.get("Authorization")||"";
    const token = auth.replace("Bearer ","").trim();
    if(!token) return Response.json({error:"Sem token"}, {status:401});
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS zbank_accounts (user_id TEXT PRIMARY KEY, savings_zp REAL DEFAULT 0, total_earned REAL DEFAULT 0, created_at TEXT)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS zbank_transactions (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, amount_zp REAL, from_source TEXT, to_dest TEXT, created_at TEXT)").run();
    }catch{}
    const sess = await env.DB.prepare("SELECT user_id FROM sessions WHERE id=?").bind(token).first();
    if(!sess) return Response.json({error:"Sessão expirada"}, {status:401});
    let acc = await env.DB.prepare("SELECT * FROM zbank_accounts WHERE user_id=?").bind(sess.user_id).first();
    if(!acc){
      await env.DB.prepare("INSERT INTO zbank_accounts (user_id, savings_zp, total_earned, created_at) VALUES (?,?,0, datetime('now'))").bind(sess.user_id, 0).run();
      acc={user_id:sess.user_id, savings_zp:0, total_earned:0};
    }
    let port = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(sess.user_id).first();
    const cashAgro = port?.cash_zp||0;
    
    // Calcula disponível para Pix (70% do cash) e retido ZBank (30% se sacar tudo)
    const disponivelPix70 = Math.round(cashAgro * 0.7 * 100)/100;
    const retidoZbank30 = Math.round(cashAgro * 0.3 * 100)/100;
    
    return Response.json({
      ok:true,
      savings_zp: acc.savings_zp||0,
      total_earned: acc.total_earned||0,
      cash_agropay_zp: cashAgro,
      disponivel_pix_70: disponivelPix70,
      retido_zbank_30: retidoZbank30,
      savings_brl: Math.round((acc.savings_zp||0)*0.01*100)/100,
      total_brl: Math.round(((acc.savings_zp||0)+cashAgro)*0.01*100)/100
    });
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
