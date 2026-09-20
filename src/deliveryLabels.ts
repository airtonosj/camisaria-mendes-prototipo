import { jsPDF } from 'jspdf';
import logo from '../assets/logo-mendes.png';
import type { ApiDeliveryRow } from './api';

export const deliveryLabelBrand = { instagram: '@camisariamendes', phone: '(98) 98778-0960' };
const margin = 6;
const gap = 3;
const width = 66.5;
const pageHeight = 210;
const maxHeight = pageHeight - margin * 2;
const innerWidth = width - 6;
const columns = [19, 19, 12, 10.5];

type Item = { cells: string[][]; height: number };
type Label = { order: ApiDeliveryRow; name: string[]; items: Item[]; total: number; height: number; tableTop: number; part: string };

export function selectedDeliveryOrders(allRows: ApiDeliveryRow[], filteredRows: ApiDeliveryRow[]) {
  const key = (row: ApiDeliveryRow) => JSON.stringify([row.campaignCode, row.orderNumber]);
  const selected = new Set(filteredRows.map(key));
  return allRows.filter(row => selected.has(key(row)));
}

function layoutLabels(doc: jsPDF, rows: ApiDeliveryRow[]): Label[] {
  const orders = new Map<string, ApiDeliveryRow[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.campaignCode, row.orderNumber]);
    orders.set(key, [...(orders.get(key) ?? []), row]);
  }
  const labels: Label[] = [];
  for (const items of orders.values()) {
    doc.setFont('helvetica', 'bold').setFontSize(9);
    const name: string[] = doc.splitTextToSize(items[0].customerName, innerWidth);
    const tableTop = 22 + name.length * 3.5;
    doc.setFont('helvetica', 'normal').setFontSize(6.5);
    const prepared = items.map(item => {
      const cells = [item.modelName, item.colorName, item.size, String(item.quantity)]
        .map((value, index) => doc.splitTextToSize(value, columns[index] - 2) as string[]);
      return { cells, height: Math.max(5, Math.max(...cells.map(cell => cell.length)) * 2.7 + 2) };
    });
    const chunks: Item[][] = [[]];
    let used = tableTop + 4 + 16;
    for (const item of prepared) {
      if (used + item.height > maxHeight && chunks.at(-1)!.length) {
        chunks.push([]); used = tableTop + 4 + 16;
      }
      if (used + item.height > maxHeight) throw new Error('Um item é muito extenso para a etiqueta A5. Revise o cadastro antes de imprimir.');
      chunks.at(-1)!.push(item); used += item.height;
    }
    chunks.forEach((chunk, index) => labels.push({
      order: items[0], name, items: chunk,
      total: items.reduce((total, item) => total + item.quantity, 0),
      height: Math.max(64, tableTop + 4 + chunk.reduce((total, item) => total + item.height, 0) + 16),
      tableTop, part: chunks.length > 1 ? `Parte ${index + 1}/${chunks.length}` : '',
    }));
  }
  return labels;
}

function drawLabel(doc: jsPDF, label: Label, image: HTMLImageElement, x: number, y: number, height: number) {
  doc.setDrawColor(170).setLineWidth(.2).roundedRect(x, y, width, height, 2, 2);
  doc.addImage(image, 'PNG', x + 3, y + 3, 10, 10, 'mendes-logo');
  doc.setTextColor(25).setFont('helvetica', 'bold').setFontSize(8);
  doc.text('ENTREGA DE CAMISAS', x + 16, y + 7);
  doc.setFont('helvetica', 'normal').setFontSize(7);
  doc.text('Camisaria Mendes', x + 16, y + 11);
  doc.setDrawColor(220).line(x + 3, y + 15, x + width - 3, y + 15);
  doc.setTextColor(75).setFontSize(6.3);
  doc.text(label.order.orderNumber, x + 3, y + 18.5);
  if (label.part) doc.text(label.part, x + width - 3, y + 18.5, { align: 'right' });
  doc.setTextColor(20).setFont('helvetica', 'bold').setFontSize(9);
  label.name.forEach((line, index) => doc.text(line, x + 3, y + 23 + index * 3.5));
  let rowY = y + label.tableTop;
  doc.setFillColor('#f0f0f0').rect(x + 3, rowY, innerWidth, 4, 'F');
  doc.setFontSize(5.8);
  let colX = x + 3;
  ['CORTE', 'COR', 'TAMANHO', 'QTD.'].forEach((title, index) => {
    doc.text(title, colX + columns[index] / 2, rowY + 2.7, { align: 'center' }); colX += columns[index];
  });
  rowY += 4;
  doc.setFont('helvetica', 'normal').setFontSize(6.5);
  for (const item of label.items) {
    colX = x + 3;
    item.cells.forEach((lines, index) => {
      doc.setDrawColor(215).setLineWidth(.15).rect(colX, rowY, columns[index], item.height);
      lines.forEach((line, lineIndex) => doc.text(line, colX + columns[index] / 2, rowY + 3.1 + lineIndex * 2.7, { align: 'center' }));
      colX += columns[index];
    });
    rowY += item.height;
  }
  doc.setFont('helvetica', 'bold').setFontSize(6.8);
  doc.text(`Total do pedido: ${label.total} ${label.total === 1 ? 'peça' : 'peças'}`, x + 3, rowY + 4.5);
  doc.setFont('helvetica', 'normal').setFontSize(6.2);
  const checkY = y + height - 8;
  doc.setDrawColor(100).rect(x + 3, checkY - 2, 2, 2);
  doc.text('Conferido', x + 6, checkY - .2);
  doc.rect(x + 29, checkY - 2, 2, 2);
  doc.text('Entregue', x + 32, checkY - .2);
  doc.setDrawColor(220).line(x + 3, y + height - 6, x + width - 3, y + height - 6);
  doc.setFontSize(6.2).setTextColor(45);
  doc.text(`${deliveryLabelBrand.instagram}  |  ${deliveryLabelBrand.phone}`, x + width / 2, y + height - 3, { align: 'center' });
}

export async function createDeliveryLabelsPdf(rows: ApiDeliveryRow[]) {
  if (!rows.length) throw new Error('Não há pedidos pagos para gerar etiquetas no filtro atual.');
  const image = new Image(); image.src = logo;
  await image.decode();
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait', compress: true });
  doc.setProperties({ title: 'Etiquetas de entrega A5 - Camisaria Mendes', author: 'Camisaria Mendes' });
  const labels = layoutLabels(doc, rows);
  let y = margin;
  for (let index = 0; index < labels.length; index += 2) {
    const pair = labels.slice(index, index + 2);
    const height = Math.max(...pair.map(label => label.height));
    if (y + height > pageHeight - margin + .01) { doc.addPage(); y = margin; }
    pair.forEach((label, column) => drawLabel(doc, label, image, margin + column * (width + gap), y, height));
    y += height + gap;
  }
  return doc;
}
