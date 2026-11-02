export async function onRequestGet({env}){
  try{
    const r=await env.DB.prepare("SELECT t.*, u.email, u.username FROM trades t LEFT JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC LIMIT 200").all();
    return Response.json(r.results||[]);
  }catch(e){ return Response.json([]); }
}
