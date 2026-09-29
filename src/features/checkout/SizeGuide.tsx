import { useEffect, useRef, useState } from "react";
import type { ShirtModelName } from "../../data";

export type MeasurementRow = { size: string; [measurement: string]: string };

export type MeasurementColumn = { key: string; label: string };

export const standardMeasurements: MeasurementRow[] = [
  { size: "P", length: "67", width: "46,5", shoulder: "38" },
  { size: "M", length: "72", width: "49,5", shoulder: "42,5" },
  { size: "G", length: "77", width: "54", shoulder: "45" },
  { size: "GG", length: "78", width: "59", shoulder: "48" },
  { size: "EXGG", length: "80,5", width: "67", shoulder: "55" },
];

export const babyLookMeasurements: MeasurementRow[] = [
  { size: "PB", length: "57", width: "45", shoulder: "31", waist: "39" },
  { size: "MB", length: "61,5", width: "47,5", shoulder: "34", waist: "42,5" },
  { size: "GB", length: "64", width: "51", shoulder: "38", waist: "45" },
];

export const oversizedMeasurements: MeasurementRow[] = [
  { size: "PP", width: "51,4", length: "73,8", sleeve: "21" },
  { size: "P", width: "54,4", length: "76,3", sleeve: "22,5" },
  { size: "M", width: "57,4", length: "78,8", sleeve: "24" },
  { size: "G", width: "60,4", length: "81,3", sleeve: "25,5" },
  { size: "GG", width: "63,4", length: "83,8", sleeve: "27" },
  { size: "XG", width: "66,4", length: "86,3", sleeve: "28,5" },
];

export const standardColumns: MeasurementColumn[] = [
  { key: "length", label: "Comprimento" },
  { key: "width", label: "Largura" },
  { key: "shoulder", label: "Ombro" },
];

export const babyLookColumns: MeasurementColumn[] = [
  ...standardColumns,
  { key: "waist", label: "Cintura" },
];

export const oversizedColumns: MeasurementColumn[] = [
  { key: "width", label: "Largura" },
  { key: "length", label: "Comprimento" },
  { key: "sleeve", label: "Manga" },
];

export function MeasurementTable({ title, columns, rows }: { title: string; columns: MeasurementColumn[]; rows: MeasurementRow[] }) {
  return (
    <section className="campaign-measurement-card" aria-labelledby={`measurement-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <h4 id={`measurement-${title.toLowerCase().replace(/\s/g, "-")}`}>{title}</h4>
      <div className="campaign-measurement-scroll">
        <table>
          <thead><tr><th scope="col">Tamanho</th>{columns.map((column) => <th scope="col" key={column.key}>{column.label}<small>cm</small></th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.size}><th scope="row">{row.size}</th>{columns.map((column) => <td key={column.key}>{row[column.key]}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

export function SizeGuide({ model, open, onClose }: { model: ShirtModelName; open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [guideModel, setGuideModel] = useState<ShirtModelName>(model);
  const showOversized = guideModel === "Oversized";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) setGuideModel(model);
  }, [model, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  return (
    <dialog
      className="campaign-size-guide"
      id="campaign-size-guide-table"
      ref={dialogRef}
      aria-labelledby="campaign-size-guide-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <header><span className="material-symbols-rounded" aria-hidden="true">straighten</span><div><h3 id="campaign-size-guide-title">Guia de medidas</h3><p>Compare com uma camiseta sua estendida sobre uma superfície plana.</p></div><button type="button" aria-label="Fechar guia de medidas" onClick={onClose}><span className="material-symbols-rounded" aria-hidden="true">close</span></button></header>
      <div className="campaign-size-guide-tabs" role="tablist" aria-label="Modelagem da camiseta">
        <button id="size-guide-common-tab" type="button" role="tab" aria-selected={!showOversized} aria-controls="size-guide-measurements" className={!showOversized ? "is-active" : ""} onClick={() => setGuideModel("Comum")}>Tradicional e Baby look</button>
        <button id="size-guide-oversized-tab" type="button" role="tab" aria-selected={showOversized} aria-controls="size-guide-measurements" className={showOversized ? "is-active" : ""} onClick={() => setGuideModel("Oversized")}>Oversized</button>
      </div>
      <div className={`campaign-measurement-grid${showOversized ? " is-single" : ""}`} id="size-guide-measurements" role="tabpanel" aria-labelledby={showOversized ? "size-guide-oversized-tab" : "size-guide-common-tab"}>
        {showOversized ? (
          <MeasurementTable title="Oversized" columns={oversizedColumns} rows={oversizedMeasurements} />
        ) : (
          <>
            <MeasurementTable title="Tradicional" columns={standardColumns} rows={standardMeasurements} />
            <MeasurementTable title="Baby look" columns={babyLookColumns} rows={babyLookMeasurements} />
          </>
        )}
      </div>
      {!showOversized && <p className="campaign-measurement-tolerance">As medidas da Tradicional e Baby look podem variar até 2,5 cm.</p>}
    </dialog>
  );
}
