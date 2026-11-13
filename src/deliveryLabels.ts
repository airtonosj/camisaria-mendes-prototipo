import { jsPDF } from 'jspdf';
import type { ApiDeliveryRow } from './api';

export const deliveryLabelBrand = { instagram: '@camisariamendes', phone: '(98) 98778-0960' };

// Folha A5 retrato com duas etiquetas de 136 × 93 mm, separadas por linha tracejada de corte.
// Margem de 6 mm até a borda do papel, fora da área que as impressoras não alcançam. Medidas em mm.
const labelHeight = 105;
const card = { x: 6, y: 6, width: 136, height: 93, radius: 5 };
const badge = { x: 86, y: 5.5, width: 50, height: 9, radius: 3 };
const logoBox = { x: 12, y: 7.8, width: 7.1, height: 11 };
const left = 12;
const right = 136;
const columns = [42.16, 29.76, 24.8, 27.28];
const headerHeight = 8.5;
const rowHeight = 9.5;
const compactRowHeight = 7.5;
const cellLineHeight = 4;
const nameLineHeight = 7.5;
const lineWidth = .282;
const footer = { lineY: 90.5, lineLeft: 24, lineRight: 124, textY: 95.6 };
// Último ponto em que a tabela pode terminar para "TOTAL" caber acima do rodapé.
const maxTableEnd = 79;

type Row = { cells: string[][]; lines: number; height: number };
type Label = { order: ApiDeliveryRow; name: string[]; rows: Row[]; total: number; part: string };
type LogoSource = HTMLImageElement | string;

export function selectedDeliveryOrders(allRows: ApiDeliveryRow[], filteredRows: ApiDeliveryRow[]) {
  const key = (row: ApiDeliveryRow) => JSON.stringify([row.campaignCode, row.orderNumber]);
  const selected = new Set(filteredRows.map(key));
  return allRows.filter(row => selected.has(key(row)));
}

function tableTop(nameLines: number) {
  return 36.5 + (nameLines - 1) * nameLineHeight;
}

function rowsHeight(rows: Row[], base: number) {
  return rows.reduce((sum, row) => sum + base + (row.lines - 1) * cellLineHeight, 0);
}

function layoutLabels(doc: jsPDF, rows: ApiDeliveryRow[]): Label[] {
  const orders = new Map<string, ApiDeliveryRow[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.campaignCode, row.orderNumber]);
    orders.set(key, [...(orders.get(key) ?? []), row]);
  }
  const sorted = [...orders.values()].sort((a, b) =>
    a[0].customerName.localeCompare(b[0].customerName, 'pt-BR', { sensitivity: 'base' })
    || a[0].orderNumber.localeCompare(b[0].orderNumber));
  const labels: Label[] = [];
  for (const items of sorted) {
    doc.setFont('helvetica', 'bold').setFontSize(18);
    const name = (doc.splitTextToSize(items[0].customerName.trim(), right - left) as string[]).slice(0, 3);
    const top = tableTop(name.length) + headerHeight;
    const prepared: Row[] = items.map(item => {
      const cells = [item.modelName, item.colorName, item.size, String(item.quantity)].map((value, index) => {
        doc.setFont('helvetica', index >= 2 ? 'bold' : 'normal').setFontSize(10);
        return doc.splitTextToSize(value, columns[index] - 3) as string[];
      });
      return { cells, lines: Math.max(...cells.map(cell => cell.length)), height: 0 };
    });
    // Linhas normais quando o pedido cabe; senão, linhas compactas e, se preciso, mais etiquetas.
    const base = top + rowsHeight(prepared, rowHeight) <= maxTableEnd ? rowHeight : compactRowHeight;
    prepared.forEach(row => { row.height = base + (row.lines - 1) * cellLineHeight; });
    const chunks: Row[][] = [[]];
    let used = top;
    for (const row of prepared) {
      if (used + row.height > maxTableEnd && chunks.at(-1)!.length) { chunks.push([]); used = top; }
      if (used + row.height > maxTableEnd) throw new Error('Um item é muito extenso para a etiqueta A5. Revise o cadastro antes de imprimir.');
      chunks.at(-1)!.push(row); used += row.height;
    }
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    chunks.forEach((chunk, index) => labels.push({
      order: items[0], name, rows: chunk, total,
      part: chunks.length > 1 ? ` (${index + 1}/${chunks.length})` : '',
    }));
  }
  return labels;
}

function drawLabel(doc: jsPDF, label: Label, logo: LogoSource, oy: number) {
  doc.setLineWidth(lineWidth);
  doc.setDrawColor(182).roundedRect(card.x, oy + card.y, card.width, card.height, card.radius, card.radius, 'S');
  doc.setDrawColor(221).setFillColor('#f7f7f7').roundedRect(badge.x, oy + badge.y, badge.width, badge.height, badge.radius, badge.radius, 'FD');
  doc.addImage(logo, 'PNG', logoBox.x, oy + logoBox.y, logoBox.width, logoBox.height, 'mendes-logo');

  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(25);
  doc.text('ENTREGA DE CAMISAS', 21.5, oy + 13);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(45);
  doc.text('Camisaria Mendes', 21.5, oy + 18.2);
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(90);
  doc.text(label.order.orderNumber + label.part, badge.x + badge.width / 2, oy + 11.1, { align: 'center' });

  doc.setFontSize(18).setTextColor(17);
  label.name.forEach((line, index) => doc.text(line, left, oy + 27.5 + index * nameLineHeight));
  const shift = (label.name.length - 1) * nameLineHeight;
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(70);
  doc.text('Confira os itens abaixo', left, oy + 32.5 + shift);

  const top = oy + tableTop(label.name.length);
  const tableWidth = right - left;
  doc.setDrawColor(208).setFillColor('#efefef').rect(left, top, tableWidth, headerHeight, 'FD');
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(32);
  let colX = left;
  ['CORTE', 'COR', 'TAMANHO', 'QTD.'].forEach((title, index) => {
    doc.text(title, colX + columns[index] / 2, top + 5.38, { align: 'center' });
    colX += columns[index];
  });

  let rowY = top + headerHeight;
  label.rows.forEach((row, rowIndex) => {
    doc.setFillColor(rowIndex % 2 ? '#f8f8f8' : '#ffffff').rect(left, rowY, tableWidth, row.height, 'FD');
    colX = left;
    row.cells.forEach((lines, index) => {
      doc.setFont('helvetica', index >= 2 ? 'bold' : 'normal').setFontSize(10).setTextColor(32);
      const first = rowY + row.height / 2 + 1.2 - (lines.length - 1) * cellLineHeight / 2;
      lines.forEach((line, lineIndex) => doc.text(line, colX + columns[index] / 2, first + lineIndex * cellLineHeight, { align: 'center' }));
      colX += columns[index];
    });
    rowY += row.height;
  });
  colX = left;
  columns.slice(0, -1).forEach(columnWidth => {
    colX += columnWidth;
    doc.line(colX, top, colX, rowY);
  });

  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(32);
  doc.text(`TOTAL: ${label.total} ${label.total === 1 ? 'peça' : 'peças'}`, left, rowY + 8);

  doc.setDrawColor(215).line(footer.lineLeft, oy + footer.lineY, footer.lineRight, oy + footer.lineY);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(45);
  doc.text(`${deliveryLabelBrand.instagram}  |  ${deliveryLabelBrand.phone}`, (footer.lineLeft + footer.lineRight) / 2, oy + footer.textY, { align: 'center' });
}

function drawCutLine(doc: jsPDF) {
  doc.setLineWidth(lineWidth).setDrawColor(187).setLineDashPattern([1.411, 1.058], 0);
  doc.line(8, labelHeight, 140, labelHeight);
  doc.setLineDashPattern([], 0);
}

async function loadLogo(): Promise<HTMLImageElement> {
  const { default: src } = await import('../assets/logo-mendes-label.png');
  const image = new Image(); image.src = src;
  await image.decode();
  return image;
}

export async function createDeliveryLabelsPdf(rows: ApiDeliveryRow[], logo?: LogoSource) {
  if (!rows.length) throw new Error('Não há pedidos pagos para gerar etiquetas no filtro atual.');
  const image = logo ?? await loadLogo();
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait', compress: true });
  doc.setProperties({ title: 'Etiquetas de entrega A5 - Camisaria Mendes', author: 'Camisaria Mendes' });
  const labels = layoutLabels(doc, rows);
  labels.forEach((label, index) => {
    if (index && index % 2 === 0) doc.addPage();
    if (index % 2 === 0) drawCutLine(doc);
    drawLabel(doc, label, image, (index % 2) * labelHeight);
  });
  return doc;
}
