# Camisaria Mendes — Protótipo de campanhas privadas

Protótipo responsivo desenvolvido com React, TypeScript, CSS e Vite.

## Fluxos demonstrados

- Landing page institucional;
- Mostruário público apenas com campanhas concluídas;
- Acesso a campanhas ativas por código, link direto ou QR Code;
- Página privada para escolha de modelo, tamanho e quantidade;
- Orientações para representantes criarem campanhas pelo WhatsApp;
- Área interna reservada em `/acesso-camisaria/`, sem link na navegação pública.

Use o código `MENDES-ENG-26` para testar uma campanha privada.

Para testar o painel interno em `/acesso-camisaria/`:

- E-mail: `admin@teste.com`
- Senha: `123456`

> Este projeto ainda é uma demonstração visual. Não possui backend, banco de dados, autenticação ou pagamentos reais.

## Executar localmente

```bash
npm install
npm run dev
```

## Gerar a versão de publicação

```bash
npm run build
```
