# Pedidos: menu lateral de campanhas — 03/10/2026

Implementação da prévia aprovada: lista lateral com miniatura existente da campanha, nome, fase, total de pedidos ativos e total pago. Busca por nome/código e filtro por fase permanecem disponíveis. Um único botão de menu mostra/oculta a lista; no celular a lista fica acima dos detalhes. A seleção preserva o menu e restaura o filtro de pedidos pagos.

O resumo inclui uma única coluna Prazo: Início (data de criação), Fim (prazo dos pedidos) e Entrega não definida. O sistema não tem campo de previsão de entrega; não foi inventada uma data. createdAt foi adicionado como campo opcional no contrato administrativo, usando a coluna existente created_at, sem migração.

Rolagem da lista de pedidos, histórico de cupons e popup de detalhes mantidos. Deploy autorizado pelo usuário em 03/10/2026, com solicitação explícita para não verificar após a publicação. Nenhuma operação real de pedidos. Evidências visuais desta revisão em qa-evidence/orders-menu/.

Validação: npm.cmd test aprovado (tipos, lint, 28 unitários e oito integrações em MySQL 8.0.46 local); build aprovado; quatro jornadas desktop/celular de Pedidos e prévia de retirada aprovadas. Após ajustar o tamanho do botão no celular e o espaçamento no menu recolhido, build e duas jornadas de Pedidos repetidos com sucesso, incluindo ausência de overflow e largura do botão. Capturas inspecionadas. diff --check aprovado. A primeira tentativa de integrações encontrou MySQL local desligado; após iniciar a instância isolada na porta 3317, todas passaram.
