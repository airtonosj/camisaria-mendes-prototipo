import { useCallback, useEffect, useState } from "react";
import { localWhatsapp } from "../../phone";
import { fetchAdminCampaigns, fetchCampaignOrders, staffToken } from "../../api";
import { shirtModels } from "../../data";
import type { SizeCode } from "../../data";
import { formatDeadline, errorMessage } from "./model";
import type { PanelMode, PanelCampaign, PanelOrder, PanelData } from "./model";
import { demoCampaigns, demoOrders } from "./demo";

  const offlineMode: PanelMode = import.meta.env.DEV ? "demo" : "error";
  const offlineCampaigns = import.meta.env.DEV ? demoCampaigns : [];
  const offlineOrders = import.meta.env.DEV ? demoOrders : {};

export function usePanelData(): PanelData {
  const hasSession = Boolean(staffToken());
  const [mode, setMode] = useState<PanelMode>(hasSession ? "live" : offlineMode);
  const [campaigns, setCampaigns] = useState<PanelCampaign[]>(hasSession ? [] : offlineCampaigns);
  const [orders, setOrders] = useState<Record<string, PanelOrder[]>>(hasSession ? {} : offlineOrders);
  const [loading, setLoading] = useState(hasSession);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!hasSession) return;
    let active = true;
    // Não voltar a `loading` aqui é deliberado: um recarregamento após confirmar
    // pagamento ou mudar de fase atualiza os dados no lugar, sem desmontar a seção
    // e perder a campanha selecionada, os filtros e a mensagem de retorno.
    fetchAdminCampaigns()
      .then((list) => {
        if (!active) return;
        setCampaigns(
          list.map((campaign) => ({
            code: campaign.code,
            title: campaign.title,
            subtitle: campaign.subtitle,
            phase: campaign.phase,
            deadlineLabel: formatDeadline(campaign.deadlineAt),
            representative: campaign.representative.name,
            artFront: campaign.artFrontUrl ?? shirtModels[0].image,
            orderCount: campaign.orderCount,
            paidTotalCents: campaign.paidTotalCents,
            basePrices: campaign.basePrices,
            canDelete: campaign.canDelete,
            activeCoupon: campaign.activeCoupon,
            couponHistory: campaign.couponHistory,
            receiver: campaign.receiver,
          })),
        );
        setMode("live");
        setError("");
      })
      .catch((loadError) => {
        if (!active) return;
        // Sessão perdida ou servidor fora. Em desenvolvimento o painel segue navegável
        // com a demonstração; publicado, ele para e diz o que aconteceu.
        setMode(offlineMode);
        setCampaigns(offlineCampaigns);
        setOrders(offlineOrders);
        setError(errorMessage(loadError, "Não foi possível carregar as campanhas."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [hasSession, reloadCount]);

  const loadOrders = useCallback((code: string) => {
    if (mode !== "live") return;
    fetchCampaignOrders(code)
      .then((list) => {
        setOrders((current) => ({
          ...current,
          [code]: list.map((order) => {
            const first = order.items[0];
            return {
              number: order.number,
              customer: order.customer.name,
              whatsapp: localWhatsapp(order.customer.whatsapp),
              email: order.customer.email,
              model: first?.modelName ?? "—",
              color: first?.color.name ?? "—",
              colorHex: first?.color.hex ?? "#777f83",
              size: (first?.size ?? "M") as SizeCode,
              quantity: order.items.reduce((total, item) => total + item.quantity, 0),
              paymentStatus: order.paymentStatus,
              paymentMethod: order.paymentMethod,
              deliveryStatus: order.deliveryStatus,
              totalCents: order.totalCents,
              couponCode: order.couponCode,
              subtotalCents: order.subtotalCents,
              discountCents: order.discountCents,
              createdAt: order.createdAt,
              status: order.status,
              cancellationReason: order.cancellationReason,
              items: order.items.map((item) => ({ model: item.modelName, color: item.color.name, colorHex: item.color.hex, size: item.size as SizeCode, quantity: item.quantity, unitPriceCents: item.unitPriceCents, lineTotalCents: item.lineTotalCents })),
            };
          }),
        }));
      })
      .catch(() => {
        setOrders((current) => ({ ...current, [code]: current[code] ?? [] }));
      });
  }, [mode]);

  const reload = useCallback(() => setReloadCount((value) => value + 1), []);

  return { mode, campaigns, orders, loading, error, attempt: reloadCount, loadOrders, reload };
}
