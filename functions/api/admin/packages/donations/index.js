export async function onRequestGet({request, env}){
  try{
    try{
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS credit_packages (id TEXT PRIMARY KEY, amount_zp REAL, amount_brl REAL, label TEXT, active INTEGER, created_at TEXT)").run();
    }catch{}
    
    const rows = await env.DB.prepare("SELECT * FROM credit_packages WHERE active=1 ORDER BY amount_brl ASC").all();
    let packages = rows.results||[];
    
    // Se não tem pacotes no banco, retorna padrão
    if(packages.length===0){
      packages = [
        {id:'1', amount_zp:200, amount_brl:2, label:"200 ZP$ - Teste"},
        {id:'2', amount_zp:500, amount_brl:5, label:"500 ZP$ - Iniciante"},
        {id:'3', amount_zp:1000, amount_brl:10, label:"1.000 ZP$"},
        {id:'4', amount_zp:5000, amount_brl:45, label:"5.000 ZP$ - Mais vendido"},
        {id:'5', amount_zp:10000, amount_brl:80, label:"10.000 ZP$"},
        {id:'6', amount_zp:5000, amount_brl:50, label:"5.000 ZP$"},
        {id:'7', amount_zp:10000, amount_brl:100, label:"10.000 ZP$ - Premium"}
      ];
    }
    
    return Response.json({ok:true, packages});
  }catch(e){
    return Response.json({error:e.message}, {status:500});
  }
}
