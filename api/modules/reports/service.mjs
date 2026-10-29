import * as queries from './repository.mjs';
import { pool } from "../../database.mjs";

export async function productionReport(requestUrl) {
  const campaign = requestUrl.searchParams.get("campaign");
  const parameters = [];
  let condition = "";
  if (campaign) {
    condition = " WHERE campaign_code = ?";
    parameters.push(campaign.toUpperCase());
  }
  const [rows] = await queries.productionReportQuery1(pool, parameters, condition);
  return rows.map((row) => ({
    campaignCode: row.campaign_code,
    campaignTitle: row.campaign_title,
    modelName: row.model_name,
    color: { name: row.color_name, hex: row.hex_color },
    size: row.size,
    sizeGroup: row.size_group,
    sizeSortOrder: Number(row.size_sort_order),
    quantity: Number(row.quantity),
  }));
}

export async function deliveryReport(requestUrl) {
  const campaign = requestUrl.searchParams.get("campaign");
  const parameters = [];
  let condition = "";
  if (campaign) {
    condition = " WHERE campaign_code = ?";
    parameters.push(campaign.toUpperCase());
  }
  const [rows] = await queries.deliveryReportQuery1(pool, parameters, condition);
  return rows.map((row) => ({
    campaignCode: row.campaign_code,
    campaignTitle: row.campaign_title,
    representativeName: row.representative_name,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerWhatsapp: row.customer_whatsapp,
    modelName: row.model_name,
    colorName: row.color_name,
    size: row.size,
    quantity: Number(row.quantity),
    deliveryStatus: row.effective_delivery_status,
  }));
}
