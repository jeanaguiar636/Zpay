export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { payment_id, status } = body;
    if(status==='approved' && payment_id){
      const pay = await env.DB.prepare("SELECT * FROM pix_payments WHERE id=?").bind(payment_id).first();
      if(pay){
        await env.DB.prepare("UPDATE pix_payments SET status='approved' WHERE id=?").bind(payment_id).run();
        const portfolio = await env.DB.prepare("SELECT cash_zp FROM portfolios WHERE user_id=?").bind(pay.user_id).first();
        if(portfolio){
          await env.DB.prepare("UPDATE portfolios SET cash_zp=? WHERE user_id=?").bind(portfolio.cash_zp + pay.amount_zp, pay.user_id).run();
        }
      }
    }
    return Response.json({ok:true});
  } catch(e){ return Response.json({error:e.message}, {status:500}); }
}
