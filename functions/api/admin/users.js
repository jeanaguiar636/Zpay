export async function onRequestGet({request, env}){
  try{
    const users = await env.DB.prepare("SELECT u.id, u.email, u.username, p.cash_zp FROM users u LEFT JOIN portfolios p ON u.id=p.user_id ORDER BY p.cash_zp DESC").all();
    return Response.json({ok:true, users: users.results||[]});
  }catch(e){ 
    return Response.json({error:e.message}, {status:500}); 
  }
}
export async function onRequestPost({request, env}){
  try{
    const {user_id, cash_zp, action} = await request.json();
    if(action==="block"){
      await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user_id).run();
      return Response.json({ok:true});
    }
    if(user_id && cash_zp!=null){
      await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(cash_zp, user_id).run();
      return Response.json({ok:true});
    }
    return Response.json({error:"Inválido"}, {status:400});
  }catch(e){ 
    return Response.json({error:e.message}, {status:500}); 
  }
}
