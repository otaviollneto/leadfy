# Outreach — Corridas de Rua 🏃

Backend Node.js + dashboard para encontrar organizadores de corridas de rua e gerar mensagens personalizadas por WhatsApp, E-mail e Instagram.

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- Chave da API da Anthropic → https://console.anthropic.com/settings/keys

---

## Instalação e uso

### 1. Instalar dependências
```bash
cd outreach-corridas
npm install
```

### 2. Configurar a chave da API
```bash
cp .env.example .env
```
Abra o arquivo `.env` e substitua o valor:
```
ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_AQUI
```

### 3. Rodar o servidor
```bash
npm start
```

Acesse no navegador: **http://localhost:3001**

---

## Modo desenvolvimento (reinicia automático)
```bash
npm run dev
```

---

## Rotas da API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Verifica se o servidor está rodando |
| POST | `/api/buscar` | Busca organizadores por cidade e tipo |
| POST | `/api/mensagens` | Gera mensagens personalizadas para um contato |

### Exemplo — buscar organizadores
```bash
curl -X POST http://localhost:3001/api/buscar \
  -H "Content-Type: application/json" \
  -d '{"cidade": "Uberaba", "tipo": "corrida de rua"}'
```

### Exemplo — gerar mensagens
```bash
curl -X POST http://localhost:3001/api/mensagens \
  -H "Content-Type: application/json" \
  -d '{
    "contato": {
      "nome": "Corridas Uberaba",
      "evento": "Meia Maratona do Triângulo",
      "wa": "34 99999-0000",
      "email": "contato@corridasuberaba.com.br",
      "ig": "@corridasuberaba",
      "cidade": "Uberaba - MG"
    }
  }'
```

---

## Estrutura do projeto

```
outreach-corridas/
├── server.js          ← Servidor Express + integração Anthropic
├── package.json
├── .env               ← Sua chave (não commitar!)
├── .env.example       ← Modelo para o .env
├── public/
│   └── index.html     ← Dashboard completo (servido pelo Express)
└── README.md
```

---

## Deploy em produção

Para rodar em um servidor (VPS, Railway, Render, etc.):

1. Defina a variável de ambiente `ANTHROPIC_API_KEY` no painel do serviço
2. Defina `PORT` se necessário (padrão: 3001)
3. Execute `npm start`

Para Railway/Render, o `package.json` já tem o script `start` configurado.
