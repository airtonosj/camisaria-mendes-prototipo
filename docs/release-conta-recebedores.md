# Conta e recebedores — release de 02/10/2026

- Autorização: usuário solicitou deploy para produção após aprovação e implementação do visual.
- Base publicada: `17a18e75221101e3d87bd906bb360652be391878`, confirmada no health público e na Hostinger.
- Escopo: conta mais compacta com cores originais, cadastro/edição em diálogo, editar/remover/reativar somente em ícones. Remover desativa com confirmação e preserva campanhas/histórico. Nenhuma migração ou alteração de regra de pagamento.
- Gate local `npm.cmd run check:release`: tipos, lint, 28 unitários, 8 integrações, build e 30 jornadas desktop/celular aprovados. MySQL local, bancos `_test` e provedores falsos.
- Backup Hostinger disponível: arquivos e banco de 02/10/2026 às 10:34. Novo backup manual indisponível até 03/10 às 10:34 (limite de 24 horas da plataforma).
- Capturas locais da conta em `qa-evidence/account-compact/`; mudanças locais de outros trabalhos preservadas fora do commit desta release.
- Recuperação: reativar o artefato anterior compatível, sem restaurar banco nem remover histórico.
