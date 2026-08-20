# Security Hardening Review: suspensão contratual de licença

## Evidence Basis

O sistema atual é uma aplicação React/Node/MySQL sem módulo de licenciamento. O cliente
que administra a host controla o processo, os arquivos, as variáveis e, possivelmente,
o código-fonte. Portanto, uma “chave escondida” local seria ao mesmo tempo insegura e
removível. A arquitetura correta precisa tratar suspensão como estado contratual
explícito, não como acesso clandestino.

## Constraints

- preservar todos os dados e históricos do cliente;
- nunca executar comandos remotos ou criar credencial mestra;
- manter login administrativo, backup e exportação durante suspensão;
- aplicar avisos e carência definidos no contrato;
- não transformar falha do serviço de licença em desligamento instantâneo;
- minimizar os dados enviados ao fornecedor do licenciamento;
- reconhecer que root/código-fonte permite contornar controles locais.

## Opportunity Portfolio

| Opportunity | Evidence | Options | Recommendation | Proposal |
| --- | --- | --- | --- | --- |
| Criar entitlement contratual explícito | Backend sem licença e implantação controlada pelo cliente (E1–E5) | 1. apenas contrato; 2. lease assinado; 3. serviço essencial do fornecedor | Opção 2 para enforcement proporcional; Opção 3 se resistência a bypass for requisito | [Proposta](proposals/license-suspension-control.md) |

## Recommendation Summary

O usuário selecionou uma primeira versão menor da Opção 2: comandos Ed25519 de
suspensão e reativação, temporários e de uso único, gerados offline pelo fornecedor.
Ela não exige serviço externo, preserva dados e histórico e não é tecnicamente
inviolável quando o cliente possui root e código-fonte.

Se o requisito comercial for impedir tecnicamente o uso mesmo contra um cliente que
modifique a instalação, uma parte indispensável do produto deve continuar hospedada
pelo fornecedor. Nesse caso, o produto deixa de ser totalmente self-hosted e passa a
ter uma dependência SaaS explícita.

## Next Decisions

- confirmar se o cliente recebe código-fonte/repositório e acesso root;
- definir se a venda é cessão definitiva ou licença recorrente;
- definir carência, avisos, recursos bloqueados e prazo de reativação no contrato;
- validar a variante offline selecionada da Opção 2 antes da instalação no cliente;
- obter revisão jurídica antes de implementar ou prometer desligamento remoto.
