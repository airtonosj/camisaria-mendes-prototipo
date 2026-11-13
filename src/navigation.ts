export function buildRoute(route?: string, campaign?: string, order?: string, resume?: string, coupon?: string) {
  const url = new URL("./", window.location.href);
  url.search = "";
  url.hash = "";
  if (route) url.searchParams.set("rota", route);
  if (campaign) url.searchParams.set("campanha", campaign);
  if (order) url.searchParams.set("pedido", order);
  if (resume) url.searchParams.set("retomar", resume);
  if (coupon) url.searchParams.set("cupom", coupon);
  return url.toString();
}
