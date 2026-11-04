export async function onRequestGet({request, env}){
  try{
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)").run(); }catch{}
    const rows = await env.DB.prepare("SELECT * FROM config").all();
    return Response.json({ok:true, config: rows.results||[]});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
export async function onRequestPost({request, env}){
  try{
    const {key, value} = await request.json();
    if(!key) return Response.json({error:"key obrigatório"}, {status:400});
    try{ await env.DB.prepare("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)").run(); }catch{}
    await env.DB.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?,?)").bind(key, value).run();
    return Response.json({ok:true, key, value});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
