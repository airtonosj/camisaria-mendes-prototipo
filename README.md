# Camisaria Mendes — Protótipo de campanhas privadas

Protótipo responsivo desenvolvido com React, TypeScript, CSS e Vite.

## Fluxos demonstrados

- Landing page institucional;
- Mostruário público apenas com campanhas concluídas;
- Acesso a campanhas ativas por código, link direto ou QR Code;
- Página privada para escolha de modelo, tamanho e quantidade;
- Consulta do andamento do pedido pelo número e WhatsApp;
- Orientações para representantes criarem campanhas pelo WhatsApp;
- Área interna reservada em `/acesso-camisaria/`, sem link na navegação pública.

Use o código `MENDES-ENG-26` para testar a campanha de Engenharia ou `MENDES-ADS-26` para testar a campanha criada pelo painel.

Cada campanha pode definir preços diferentes para `Comum`, `Oversized` e `Baby Look`. O seletor do aluno atualiza automaticamente o total conforme o modelo escolhido.

### Imagens da campanha

No painel, a camisaria configura separadamente a imagem de frente e a imagem de costas de cada modelo (`Comum`, `Oversized` e `Baby Look`). O aluno vê exatamente essas artes durante a escolha e na revisão do pedido.

- Formatos aceitos: `PNG`, `JPG`/`JPEG` e `WEBP`;
- Tamanho máximo: `2 MB` por arquivo;
- Dimensão recomendada: `1200 × 1500 px`;
- Dimensão mínima aceita: `600 × 800 px`;
- Proporção recomendada: próxima de `4:5`;
- Enquadramento: peça centralizada, sem cortar mangas, gola ou barra;
- Fundo: neutro ou transparente, com boa diferença de cor em relação à camiseta;
- Arquivos: usar uma imagem para a frente e outra para as costas, sem reunir os dois lados em uma única foto.

Neste protótipo, as imagens enviadas ficam salvas apenas no navegador usado pela camisaria. Na versão de produção, o upload deve ser ligado ao armazenamento do sistema para que os arquivos fiquem disponíveis com segurança em qualquer aparelho.

Para testar o acompanhamento do pedido em `?rota=acompanhar-pedido`:

- Pedidos: `CM-2026-0147` (aguardando), `CM-2026-0148` (confirmado), `CM-2026-0149` (não aprovado), `CM-2026-0150` (pronto para retirada) e `CM-2026-0151` (entregue)
- WhatsApp: `(98) 99999-0000`

Para testar o painel interno em `/acesso-camisaria/`:

- E-mail: `admin@teste.com`
- Senha: `123456`

> Este projeto ainda é uma demonstração visual. Não possui backend, banco de dados, autenticação ou pagamentos reais.

## Fundação do backend

A primeira base persistente foi iniciada com API Node.js e MySQL 8. Ela já define campanhas, modelos, cores, pedidos, pagamentos, histórico de mudança de fase e as consultas dos dois relatórios operacionais. O front-end ainda usa os dados de demonstração até a próxima etapa de integração.

Consulte [docs/backend-mysql.md](docs/backend-mysql.md) para preparar o banco e executar a API.

## Executar localmente

```bash
npm install
npm run dev
```

## Gerar a versão de publicação

```bash
npm run build
```
