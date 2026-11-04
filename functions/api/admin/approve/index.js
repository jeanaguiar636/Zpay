
export async function onRequestPost({request, env}){
  try{
    // Tenta pegar id de vários lugares
    let body = {};
    try{
      const ct = request.headers.get('content-type')||'';
      if(ct.includes('json')){
        body = await request.json();
      } else {
        try{ body = await request.json(); }catch{
          const txt = await request.text();
          try{ body = JSON.parse(txt); }catch{ body = {}; }
        }
      }
    }catch(e){}

    // Pega id da URL também ?id=xxx
    let idFromUrl = null;
    try{
      const url = new URL(request.url);
      idFromUrl = url.searchParams.get('id');
    }catch{}

    const id = body.id || body.withdrawal_id || idFromUrl;
    const status = body.status || 'pago';

    if(!id){
      return Response.json({error:"Faltando dados - ID não recebido. Body: "+JSON.stringify(body)+" URL id: "+idFromUrl}, {status:400});
    }

    // Atualiza saque
    await env.DB.prepare("UPDATE withdrawals SET status=? WHERE id=?").bind(status, id).run();

    // Se marcar como pago, opcionalmente registra no caixa
    try{
      const w = await env.DB.prepare("SELECT * FROM withdrawals WHERE id=?").bind(id).first();
      if(w && status==='pago'){
        // Opcional: desconta do caixa
        try{
          await env.DB.prepare("CREATE TABLE IF NOT EXISTS caixa_mercadopago (id TEXT PRIMARY KEY, balance_brl REAL DEFAULT 0, total_withdrawals_brl REAL DEFAULT 0, updated_at TEXT)").run();
          let caixa = await env.DB.prepare("SELECT * FROM caixa_mercadopago ORDER BY updated_at DESC LIMIT 1").first();
          if(caixa){
            const novoSaldo = (caixa.balance_brl||0) - (w.amount_brl||0);
            const totalSaq = (caixa.total_withdrawals_brl||0) + (w.amount_brl||0);
            await env.DB.prepare("UPDATE caixa_mercadopago SET balance_brl=?, total_withdrawals_brl=?, updated_at=datetime('now') WHERE id=?").bind(novoSaldo, totalSaq, caixa.id).run();
          }
        }catch(e){ console.log('Erro caixa', e); }
      }
    }catch(e){}

    return Response.json({ok:true, id, status});
  }catch(e){
    return Response.json({error:"Erro aprovar: "+e.message}, {status:500});
  }
}

export async function onRequestGet({request, env}){
  // Também aceita GET para aprovar rapidamente via link
  try{
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const status = url.searchParams.get('status')||'pago';
    if(!id) return Response.json({error:"ID obrigatório na URL ?id=xxx"}, {status:400});
    await env.DB.prepare("UPDATE withdrawals SET status=? WHERE id=?").bind(status, id).run();
    return Response.json({ok:true, id, status, via:'GET'});
  }catch(e){ return Response.json({error:e.message}, {status:500}); }
}
