import { useMemo } from "react";
import type { ApiProductionRow } from "../api";

export type ProductionReportCampaign = {
  code: string;
  title: string;
  subtitle?: string | null;
};

export type ProductionSize = {
  code: string;
  quantity: number;
  sortOrder: number;
};

export type ProductionColor = {
  name: string;
  normal: ProductionSize[];
  babylook: ProductionSize[];
};

export type ProductionCut = {
  name: string;
  colors: ProductionColor[];
};

export type ProductionSheet = ProductionReportCampaign & {
  cuts: ProductionCut[];
  generatedAt: Date;
};

export function totalDaCor(color: ProductionColor) {
  return [...color.normal, ...color.babylook].reduce((total, size) => total + size.quantity, 0);
}

export function totalDoCorte(cut: ProductionCut) {
  return cut.colors.reduce((total, color) => total + totalDaCor(color), 0);
}

export function totalDoPedido(sheet: ProductionSheet) {
  return sheet.cuts.reduce((total, cut) => total + totalDoCorte(cut), 0);
}

type MutableColor = {
  name: string;
  normal: Map<string, ProductionSize>;
  babylook: Map<string, ProductionSize>;
};

type MutableCut = {
  name: string;
  colors: Map<string, MutableColor>;
};

type MutableSheet = ProductionReportCampaign & {
  cuts: Map<string, MutableCut>;
  generatedAt: Date;
};

/**
 * Converte as linhas oficiais da API na hierarquia da ficha. A ordem dos tamanhos
 * vem do cadastro do banco (`sizeSortOrder`), então novas grades não exigem mudar
 * este componente. Cores empatadas são ordenadas por nome para a saída ser estável.
 */
export function buildProductionSheets(
  rows: ApiProductionRow[],
  campaigns: ProductionReportCampaign[],
  generatedAt: Date,
) {
  const metadata = new Map(campaigns.map((campaign) => [campaign.code, campaign]));
  const sheets = new Map<string, MutableSheet>();
  let fallbackOrder = 0;

  for (const row of rows) {
    if (row.quantity <= 0) continue;
    const campaign = metadata.get(row.campaignCode) ?? {
      code: row.campaignCode,
      title: row.campaignTitle,
      subtitle: null,
    };
    const sheet = sheets.get(row.campaignCode) ?? { ...campaign, cuts: new Map(), generatedAt };
    const cut = sheet.cuts.get(row.modelName) ?? { name: row.modelName, colors: new Map() };
    const color = cut.colors.get(row.color.name) ?? {
      name: row.color.name,
      normal: new Map(),
      babylook: new Map(),
    };
    const grade = row.sizeGroup === "baby_look" ? color.babylook : color.normal;
    const size = grade.get(row.size) ?? {
      code: row.size,
      quantity: 0,
      sortOrder: row.sizeSortOrder ?? fallbackOrder++,
    };
    size.quantity += row.quantity;
    size.sortOrder = Math.min(size.sortOrder, row.sizeSortOrder ?? size.sortOrder);
    grade.set(row.size, size);
    cut.colors.set(row.color.name, color);
    sheet.cuts.set(row.modelName, cut);
    sheets.set(row.campaignCode, sheet);
  }

  return [...sheets.values()].map<ProductionSheet>((sheet) => ({
    code: sheet.code,
    title: sheet.title,
    subtitle: sheet.subtitle,
    generatedAt: sheet.generatedAt,
    cuts: [...sheet.cuts.values()].map((cut) => ({
      name: cut.name,
      colors: [...cut.colors.values()]
        .map((color) => ({
          name: color.name,
          normal: [...color.normal.values()].sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code, "pt-BR")),
          babylook: [...color.babylook.values()].sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code, "pt-BR")),
        }))
        .sort((left, right) => totalDaCor(right) - totalDaCor(left) || left.name.localeCompare(right.name, "pt-BR")),
    })),
  }));
}

function ReportHeader({ sheet }: { sheet: ProductionSheet }) {
  const total = totalDoPedido(sheet);
  return (
    <header className="production-sheet-header">
      <div className="production-sheet-heading">
        <span>Ordem de produção</span>
        <h3>{sheet.title}</h3>
        {sheet.subtitle && <p>{sheet.subtitle}</p>}
      </div>
      <dl className="production-sheet-meta">
        <div><dt>Pedido / campanha</dt><dd>{sheet.code}</dd></div>
        <div><dt>Data</dt><dd>{sheet.generatedAt.toLocaleDateString("pt-BR")}</dd></div>
        <div><dt>Total do pedido</dt><dd>{total} {total === 1 ? "peça" : "peças"}</dd></div>
      </dl>
    </header>
  );
}

function SizeList({ sizes }: { sizes: ProductionSize[] }) {
  return (
    <div className="production-size-list">
      {sizes.map((size) => <div key={size.code}><span>{size.code}</span><strong>{size.quantity}</strong></div>)}
    </div>
  );
}

function ColorCard({ color }: { color: ProductionColor }) {
  const hasNormal = color.normal.length > 0;
  const hasBabylook = color.babylook.length > 0;
  return (
    <article className="production-color-card">
      <h5>{color.name} <span>({totalDaCor(color)})</span></h5>
      <div className={`production-size-grades${hasNormal && hasBabylook ? "" : " production-size-grades--single"}`}>
        {hasNormal && <section><h6>Normal</h6><SizeList sizes={color.normal} /></section>}
        {hasBabylook && <section><h6>Babylook</h6><SizeList sizes={color.babylook} /></section>}
      </div>
    </article>
  );
}

function CutSection({ cut }: { cut: ProductionCut }) {
  return (
    <section className="production-cut-section">
      <header><h4>{cut.name} <span>({totalDoCorte(cut)})</span></h4><i aria-hidden="true" /></header>
      <div className="production-color-grid">
        {cut.colors.map((color) => <ColorCard color={color} key={color.name} />)}
      </div>
    </section>
  );
}

function ReportFooter({ sheet }: { sheet: ProductionSheet }) {
  const total = totalDoPedido(sheet);
  return (
    <footer className="production-sheet-footer">
      <span>Somente pedidos com pagamento confirmado</span>
      <strong>Total geral do pedido: {total} {total === 1 ? "camisa" : "camisas"}</strong>
    </footer>
  );
}

export function ProductionReport({
  rows,
  campaigns,
  generatedAt,
}: {
  rows: ApiProductionRow[];
  campaigns: ProductionReportCampaign[];
  generatedAt: Date;
}) {
  const sheets = useMemo(() => buildProductionSheets(rows, campaigns, generatedAt), [rows, campaigns, generatedAt]);

  if (sheets.length === 0) {
    return <p className="campaign-production-empty"><span className="material-symbols-rounded" aria-hidden="true">hourglass_empty</span>Nenhum pedido pago no filtro atual. Confirme os pagamentos em Pedidos para a produção aparecer aqui.</p>;
  }

  return (
    <div className="production-report-print-area" aria-label="Fichas de produção prontas para impressão">
      {sheets.map((sheet) => (
        <article className="production-sheet" key={sheet.code}>
          <ReportHeader sheet={sheet} />
          <main>{sheet.cuts.map((cut) => <CutSection cut={cut} key={cut.name} />)}</main>
          <ReportFooter sheet={sheet} />
        </article>
      ))}
    </div>
  );
}

function xml(value: string | number) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function excelCell(value: string | number, style?: string) {
  const type = typeof value === "number" ? "Number" : "String";
  return `<Cell${style ? ` ss:StyleID="${style}"` : ""}><Data ss:Type="${type}">${xml(value)}</Data></Cell>`;
}

function worksheetName(value: string, used: Set<string>) {
  const base = value.replace(/[\\/:*?\[\]]/g, " ").trim().slice(0, 31) || "Produção";
  let name = base;
  let suffix = 2;
  while (used.has(name)) {
    const marker = ` ${suffix++}`;
    name = `${base.slice(0, 31 - marker.length)}${marker}`;
  }
  used.add(name);
  return name;
}

/** Gera SpreadsheetML, um arquivo .xls real e manipulável, aceito pelo Excel. */
export function downloadProductionExcel(sheets: ProductionSheet[], filename: string) {
  const usedNames = new Set<string>();
  const worksheets = sheets.map((sheet) => {
    const rows: string[] = [];
    rows.push(`<Row>${excelCell(sheet.title, "Title")}</Row>`);
    if (sheet.subtitle) rows.push(`<Row>${excelCell(sheet.subtitle, "Muted")}</Row>`);
    rows.push(`<Row>${excelCell("Pedido / campanha", "Label")}${excelCell(sheet.code)}${excelCell("Data", "Label")}${excelCell(sheet.generatedAt.toLocaleDateString("pt-BR"))}${excelCell("Total", "Label")}${excelCell(totalDoPedido(sheet), "Total")}</Row>`);
    rows.push("<Row/>");
    rows.push(`<Row>${["Corte", "Cor", "Modelagem", "Tamanho", "Quantidade", "Total da cor"].map((value) => excelCell(value, "Header")).join("")}</Row>`);
    for (const cut of sheet.cuts) {
      for (const color of cut.colors) {
        const sizes = [
          ...color.normal.map((size) => ({ ...size, grade: "Normal" })),
          ...color.babylook.map((size) => ({ ...size, grade: "Babylook" })),
        ];
        sizes.forEach((size, index) => {
          rows.push(`<Row>${excelCell(cut.name)}${excelCell(color.name)}${excelCell(size.grade)}${excelCell(size.code)}${excelCell(size.quantity, "Quantity")}${excelCell(index === 0 ? totalDaCor(color) : "", index === 0 ? "Total" : undefined)}</Row>`);
        });
      }
      rows.push(`<Row>${excelCell(`Subtotal ${cut.name}`, "Subtotal")}${excelCell("")}${excelCell("")}${excelCell("")}${excelCell(totalDoCorte(cut), "Subtotal")}</Row>`);
    }
    rows.push(`<Row>${excelCell("TOTAL GERAL DO PEDIDO", "GrandTotal")}${excelCell("")}${excelCell("")}${excelCell("")}${excelCell(totalDoPedido(sheet), "GrandTotal")}</Row>`);
    return `<Worksheet ss:Name="${xml(worksheetName(sheet.code, usedNames))}"><Table><Column ss:Width="110"/><Column ss:Width="105"/><Column ss:Width="80"/><Column ss:Width="70"/><Column ss:Width="75"/><Column ss:Width="80"/>${rows.join("")}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>5</SplitHorizontal><TopRowBottomPane>5</TopRowBottomPane><ActivePane>2</ActivePane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>`;
  }).join("");

  const workbook = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Title"><Font ss:Bold="1" ss:Size="16" ss:Color="#273236"/></Style><Style ss:ID="Muted"><Font ss:Italic="1" ss:Color="#666666"/></Style><Style ss:ID="Label"><Font ss:Bold="1" ss:Color="#6F6045"/></Style><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#6F6045" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style><Style ss:ID="Quantity"><Alignment ss:Horizontal="Center"/><NumberFormat ss:Format="0"/></Style><Style ss:ID="Total"><Font ss:Bold="1"/><Alignment ss:Horizontal="Center"/></Style><Style ss:ID="Subtotal"><Font ss:Bold="1" ss:Color="#6F6045"/><Interior ss:Color="#F3EFE6" ss:Pattern="Solid"/></Style><Style ss:ID="GrandTotal"><Font ss:Bold="1" ss:Size="11"/><Interior ss:Color="#DDD3BF" ss:Pattern="Solid"/></Style></Styles>${worksheets}</Workbook>`;
  const url = URL.createObjectURL(new Blob([`\ufeff${workbook}`], { type: "application/vnd.ms-excel;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function printProductionReport(filename: string) {
  const previousTitle = document.title;
  document.title = filename.replace(/\.pdf$/i, "");
  document.body.classList.add("printing-production-report");
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    document.body.classList.remove("printing-production-report");
    document.title = previousTitle;
  };

  // A prévia de impressão é assíncrona em navegadores móveis. Um timeout curto
  // pode remover esta classe antes de Android/iOS capturarem o documento e fazer
  // o navegador imprimir a tabela administrativa antiga. O `afterprint` indica
  // que a impressão começou ou que a prévia foi fechada, então é o momento seguro
  // para restaurar a tela.
  window.addEventListener("afterprint", restore, { once: true });
  window.requestAnimationFrame(() => {
    window.print();
  });
}
