export async function onRequestGet({ env }) {
  const entrou = await env.DB.prepare("SELECT IFNULL(SUM(amount_brl),0) as total, COUNT(*) as qtd FROM pix_payments WHERE status='approved'").first();
  const saiu = await env.DB.prepare("SELECT IFNULL(SUM(amount_brl),0) as total, COUNT(*) as qtd FROM withdrawals WHERE status='approved'").first();
  const taxas = await env.DB.prepare("SELECT IFNULL(SUM(fee),0) as total, COUNT(*) as qtd FROM trades").first();
  const pendentes = await env.DB.prepare("SELECT COUNT(*) as total FROM withdrawals WHERE status='pending'").first();
  const users = await env.DB.prepare("SELECT COUNT(*) as total FROM users").first();
  return Response.json({entrou, saiu, taxas, pendentes, users, lucro: (entrou?.total||0) - (saiu?.total||0) + (taxas?.total||0)});
}
