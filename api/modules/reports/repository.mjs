/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function productionReportQuery1(executor, values, fragment0) {
  return executor.execute(`SELECT campaign_code, campaign_title, model_name, color_name, hex_color, size, size_group, size_sort_order, quantity
       FROM v_production_report${fragment0}
      ORDER BY campaign_title, model_name, color_name, size_sort_order`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function deliveryReportQuery1(executor, values, fragment0) {
  return executor.execute(`SELECT campaign_code, campaign_title, representative_name, order_number, customer_name,
            customer_whatsapp, model_name, color_name, size, quantity, effective_delivery_status
       FROM v_delivery_report${fragment0}
      ORDER BY campaign_title, customer_name, order_number, size_sort_order`, values);
}
