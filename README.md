# KAIZEN - Armazenamento compartilhado

Este projeto agora inclui um backend simples em Node/Express que salva e lê os dados principais do sistema em um único arquivo JSON compartilhado.

## Como rodar

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor:
   ```bash
   npm start
   ```
3. Abra o site em:
   ```bash
   http://localhost:3000/Documento\ de\ Santoro.html
   ```

## O que fica compartilhado

O arquivo de dados fica em:

```text
data/kaizen-data.json
```

Ele guarda:
- `kaizen_demandas`
- `kaizen_colaboradores`
- `kaizen_periodicas`
- `kaizen_rotina`
- `kaizen_horarios`
- `kaizen_equipes`

## Endpoints

- `GET /api/kaizen-data` → lê os dados compartilhados
- `POST /api/kaizen-data` → salva os dados compartilhados
- `GET /api/demandas` → retorna apenas as demandas abertas e fechadas
- `POST /api/demandas` → salva somente a lista de demandas

## Observações

Para que ele funcione em um ambiente real do site, a aplicação precisa ser servida por um servidor Node, não apenas aberta como arquivo estático.

Se quiser, no próximo passo eu também posso integrar automaticamente este backend ao HTML principal do sistema para que todas as demandas e fechamento sejam gravadas via API ao invés de `localStorage`.
