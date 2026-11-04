
export async function onRequestGet({request, env}){
  try{
    let brutoBrl = 0; let brutoZp = 0; let qtdPix = 0;
    try{
      const co = await env.DB.prepare("SELECT COUNT(*) as qtd, SUM(amount_brl) as total_brl, SUM(amount_zp) as total_zp FROM credit_orders WHERE status='paid' OR status='pago' OR status='approved'").first();
      brutoBrl += co?.total_brl || 0;
      brutoZp += co?.total_zp || 0;
      qtdPix += co?.qtd || 0;
    }catch(e){}
    try{
      const co2 = await env.DB.prepare("SELECT SUM(amount_zp) as total FROM donations").first();
      brutoZp += co2?.total || 0;
    }catch(e){}

    let carteiraZp = 0; let totalUsers = 0;
    try{
      const pu = await env.DB.prepare("SELECT COUNT(*) as c FROM users").first();
      totalUsers = pu?.c || 0;
    }catch{}
    try{
      const p = await env.DB.prepare("SELECT SUM(cash_zp) as sum FROM portfolios").first();
      carteiraZp += p?.sum || 0;
    }catch{}
    try{
      const z = await env.DB.prepare("SELECT SUM(savings_zp) as sum FROM zbank_accounts").first();
      carteiraZp += z?.sum || 0;
    }catch{}

    let saquesBrl = 0; let saquesZp = 0; let qtdPend = 0;
    try{
      const s = await env.DB.prepare("SELECT COUNT(*) as qtd, SUM(amount_brl) as brl, SUM(amount_zp) as zp FROM withdrawals WHERE status!='rejected' AND status!='rejeitado'").first();
      saquesBrl = s?.brl || 0;
      saquesZp = s?.zp || 0;
    }catch{}
    try{
      const sp = await env.DB.prepare("SELECT COUNT(*) as c FROM withdrawals WHERE status='pendente' OR status='pending'").first();
      qtdPend = sp?.c || 0;
    }catch{}

    let totalTrades = 0;
    try{
      const t = await env.DB.prepare("SELECT COUNT(*) as c FROM trades").first();
      totalTrades = t?.c || 0;
    }catch{}

    const taxa = 0.01;
    const brutoBrlFinal = brutoBrl || (brutoZp * taxa);
    const carteiraBrl = carteiraZp * taxa;
    const lucroZp = brutoZp - carteiraZp - saquesZp;
    const lucroBrl = brutoBrlFinal - carteiraBrl - saquesBrl;

    return Response.json({
      ok: true,
      investimento_bruto: { zp: brutoZp, brl: brutoBrlFinal, qtd_pix: qtdPix },
      carteira_usuarios: { zp: carteiraZp, brl: carteiraBrl, total_users: totalUsers },
      lucro_plataforma: { zp: lucroZp, brl: lucroBrl },
      saques: { qtd_pendentes: qtdPend, total_brl: saquesBrl, total_zp: saquesZp },
      trades: { total: totalTrades },
      stats: { users: totalUsers, trades: totalTrades, pending_withdrawals: qtdPend }
    });
  }catch(e){
    return Response.json({error:e.message}, {status:500});
  }
}
