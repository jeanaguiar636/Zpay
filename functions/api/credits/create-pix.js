export async function onRequestPost({ request, env }) {
  try {
    const { user_id, package_id } = await request.json();
    const pkg = await env.DB.prepare("SELECT * FROM credit_packages WHERE id=?").bind(package_id).first();
    if(!pkg) return Response.json({error:'Pacote não encontrado'}, {status:404});
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO pix_payments (id, user_id, package_id, amount_zp, amount_brl, status, created_at) VALUES (?,?,?,?,?, 'pending', datetime('now'))").bind(id, user_id, pkg.amount_zp, pkg.price_brl, pkg.price_brl).run();
    return Response.json({ok:true, payment_id:id, qr_code:'00020101021226880014br.gov.bcb.pix...', copy_paste:'000201...', amount_brl:pkg.price_brl, amount_zp:pkg.amount_zp});
  } catch(e){ return Response.json({error:e.message}, {status:500}); }
}
