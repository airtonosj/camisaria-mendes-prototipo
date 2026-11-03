import { useState } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { campaignSizesInGroup, sizeGroupLabels } from "../../../data";
import type { ShirtColorName, ShirtColorOption, ShirtModelName, SizeCode, SizeGroup } from "../../../data";

type StockModel = { name: ShirtModelName; code: string };
type Props = {
  models: StockModel[];
  modelColors: Record<ShirtModelName, ShirtColorName[]>;
  modelSizes: Record<ShirtModelName, SizeCode[]>;
  colorOptions: ShirtColorOption[];
  limits: Record<string, string>;
  setLimits: Dispatch<SetStateAction<Record<string, string>>>;
};

const MAX_STOCK = 1000000;
const stockKey = (modelCode: string, color: string, size: string) => `${modelCode}\u0000${color}\u0000${size}`;
const validStock = (value: string | undefined) => /^\d+$/.test(value ?? "") && Number(value) >= 1 && Number(value) <= MAX_STOCK;
const stockValue = (value: string | undefined) => validStock(value) ? Number(value) : 0;
const pieces = (total: number) => `${total.toLocaleString("pt-BR")} ${total === 1 ? "peça" : "peças"}`;
const modelLabel = (name: ShirtModelName) => name === "Comum" ? "Padrão" : name;

/** Grade de estoque público: uma tabela por corte, com cores nas linhas e tamanhos nas colunas. */
export function CampaignStockMatrix({ models, modelColors, modelSizes, colorOptions, limits, setLimits }: Props) {
  const [activeName, setActiveName] = useState<ShirtModelName | null>(null);
  const [fillValue, setFillValue] = useState("");
  const [fillError, setFillError] = useState("");
  const active = models.find((model) => model.name === activeName) ?? models[0];

  const groupsFor = (name: ShirtModelName) => (["standard", "baby_look"] as SizeGroup[])
    .map((group) => ({ group, sizes: campaignSizesInGroup(name, group).filter((size) => modelSizes[name].includes(size)) }))
    .filter((item) => item.sizes.length > 0);
  const keysFor = (model: StockModel) => modelColors[model.name].flatMap((color) => modelSizes[model.name].map((size) => stockKey(model.code, color, size)));
  const allKeys = models.flatMap(keysFor);
  const missingCount = allKeys.filter((key) => !validStock(limits[key])).length;
  const modelTotal = (model: StockModel) => keysFor(model).reduce((total, key) => total + stockValue(limits[key]), 0);

  if (!active) return null;
  const groups = groupsFor(active.name);
  const sizes = groups.flatMap((item) => item.sizes);
  const groupStarts = new Set(groups.slice(1).map((item) => item.sizes[0]));
  const colors = modelColors[active.name];
  const hexFor = (color: string) => colorOptions.find((option) => option.name === color)?.hex ?? "#d7dee3";

  function applyFill(overwrite: boolean) {
    if (!validStock(fillValue)) {
      setFillError("Informe um número inteiro entre 1 e 1.000.000.");
      return;
    }
    setFillError("");
    setLimits((current) => {
      const next = { ...current };
      for (const key of keysFor(active)) if (overwrite || !validStock(next[key])) next[key] = fillValue;
      return next;
    });
  }

  function repeatRow(color: string) {
    const first = sizes.map((size) => limits[stockKey(active.code, color, size)]).find(validStock);
    if (!first) return;
    setLimits((current) => ({ ...current, ...Object.fromEntries(sizes.map((size) => [stockKey(active.code, color, size), first])) }));
  }

  return <fieldset className="campaign-stock-setup">
    <legend>Estoque público por corte, cor e tamanho</legend>
    <div className="campaign-stock-head">
      <p>Quantas peças podem ser vendidas de cada combinação. Pedidos pendentes reservam unidades; cancelamentos liberam o estoque.</p>
      <span className={`campaign-stock-status ${missingCount ? "is-missing" : "is-complete"}`} role="status">
        <span className="material-symbols-rounded" aria-hidden="true">{missingCount ? "error" : "check_circle"}</span>
        {missingCount ? `${missingCount} de ${allKeys.length} ${allKeys.length === 1 ? "combinação" : "combinações"} sem estoque` : "Todas as combinações preenchidas"}
      </span>
    </div>

    {models.length > 1 && <div className="campaign-stock-tabs" role="group" aria-label="Corte para configurar o estoque">
      {models.map((model) => <button type="button" key={model.code} className={`${model.code === active.code ? "is-active" : ""} ${keysFor(model).some((key) => !validStock(limits[key])) ? "has-missing" : ""}`} aria-pressed={model.code === active.code} onClick={() => setActiveName(model.name)}>
        {modelLabel(model.name)}<span>{pieces(modelTotal(model))}</span>
      </button>)}
    </div>}

    <div className="campaign-stock-fill">
      <label><span>Preencher {modelLabel(active.name)} com</span><input type="number" min={1} max={MAX_STOCK} step={1} inputMode="numeric" value={fillValue} placeholder="10" aria-label={`Quantidade para preencher o corte ${modelLabel(active.name)}`} onChange={(event) => { setFillValue(event.target.value); setFillError(""); }} /><span>peças</span></label>
      <div><button type="button" onClick={() => applyFill(false)}>Preencher vazias</button><button type="button" onClick={() => applyFill(true)}>Substituir todas</button></div>
      {fillError && <small role="alert">{fillError}</small>}
    </div>

    <div className="campaign-stock-matrix" style={{ "--stock-columns": sizes.length } as CSSProperties} role="table" aria-label={`Estoque do corte ${modelLabel(active.name)}`}>
      {groups.length > 1 && <div className="campaign-stock-row campaign-stock-row--groups" role="row" aria-hidden="true">
        <span />
        {groups.map((item, index) => <span key={item.group} className={index ? "is-group-start" : ""} style={{ gridColumn: `span ${item.sizes.length}` }}>{sizeGroupLabels[item.group]}</span>)}
        <span />
      </div>}
      <div className="campaign-stock-row campaign-stock-row--head" role="row">
        <span role="columnheader">Cor</span>
        {sizes.map((size) => <span role="columnheader" key={size} className={groupStarts.has(size) ? "is-group-start" : ""}>{size}</span>)}
        <span role="columnheader">Total</span>
      </div>
      {colors.map((color) => {
        const rowTotal = sizes.reduce((total, size) => total + stockValue(limits[stockKey(active.code, color, size)]), 0);
        return <div className="campaign-stock-row" role="row" key={color}>
          <div className="campaign-stock-color-name" role="rowheader">
            <span><i style={{ backgroundColor: hexFor(color) }} aria-hidden="true" />{color}</span>
            <button type="button" onClick={() => repeatRow(color)} aria-label={`Repetir o primeiro valor de ${color} em todos os tamanhos`}>repetir na linha</button>
          </div>
          <div className="campaign-stock-cells">
            {sizes.map((size) => {
              const key = stockKey(active.code, color, size);
              return <label role="cell" key={key} className={`${groupStarts.has(size) ? "is-group-start" : ""} ${validStock(limits[key]) ? "" : "is-missing"}`}>
                <span>{size}</span>
                <input type="number" min={1} max={MAX_STOCK} step={1} inputMode="numeric" placeholder="—" aria-label={`Estoque ${active.name}, ${color}, tamanho ${size}`} value={limits[key] ?? ""} onChange={(event) => setLimits((current) => ({ ...current, [key]: event.target.value }))} required />
              </label>;
            })}
          </div>
          <strong className="campaign-stock-total" role="cell">{rowTotal ? pieces(rowTotal) : "—"}</strong>
        </div>;
      })}
      <div className="campaign-stock-row campaign-stock-row--foot" role="row">
        <span role="rowheader">Total por tamanho</span>
        <div className="campaign-stock-cells">
          {sizes.map((size) => {
            const total = colors.reduce((sum, color) => sum + stockValue(limits[stockKey(active.code, color, size)]), 0);
            return <span role="cell" key={size} className={groupStarts.has(size) ? "is-group-start" : ""}>{total || "—"}</span>;
          })}
        </div>
        <strong className="campaign-stock-total" role="cell">{pieces(modelTotal(active))}</strong>
      </div>
    </div>
  </fieldset>;
}
