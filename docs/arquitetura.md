# Arquitetura

Uma aplicação modular: React + TypeScript, HTTP nativo Node ESM e MySQL 8.

## Dependências

- `src/features`: apresentação, hooks e acesso à API por funcionalidade.
- `src/components`: componentes visuais compartilhados e fachadas compatíveis.
- `shared`: contratos e funções puras, sem React, banco, rede ou segredos.
- `api/http`: transporte, erros, autenticação de requisições e despacho.
- `api/modules`: serviços por domínio e consultas em repositórios.
- `api/runtime`: configuração do servidor, readiness e ciclo de vida.
- Serviços abrem transações. Repositórios recebem o executor e nunca fazem commit.
- Importar um serviço não abre portas nem inicia workers.

## Autoridade

O servidor calcula preços, valida cupons e decide elegibilidade. O navegador usa
as mesmas funções puras para antecipar resultados. Históricos guardam valores da compra.
Pagamentos, notificações e licença preservam suas filas e controles existentes.

## Compatibilidade

Rotas, formatos HTTP, chaves de armazenamento e aparência são contratos. Refatorações
movem responsabilidades antes de alterar regras. Testes de contrato e jornadas protegem
o comportamento. Código de demonstração é exclusivo do desenvolvimento.
