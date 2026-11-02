export async function onRequestGet({env}){
  try{
    const r=await env.DB.prepare("SELECT * FROM withdrawals ORDER BY created_at DESC").all();
    return Response.json(r.results||[]);
  }catch(e){ return Response.json([]); }
}
