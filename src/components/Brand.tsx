import logo from "../../assets/logo-mendes.png";

type BrandProps = {
  compact?: boolean;
};

export function Brand({ compact = false }: BrandProps) {
  return (
    <a className={`brand ${compact ? "brand--compact" : ""}`} href="./" aria-label="Camisaria Mendes — início">
      <img src={logo} alt="" />
      <span>
        <strong>Camisaria Mendes</strong>
        {!compact && <small>Vista a história da sua turma</small>}
      </span>
    </a>
  );
}
