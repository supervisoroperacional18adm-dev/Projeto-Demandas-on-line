const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

let spreadsheetDoc = null;
let sheetsInitialized = false;

async function initializeSheets() {
  try {
    if (sheetsInitialized && spreadsheetDoc) return spreadsheetDoc;

    const SHEET_ID = process.env.GOOGLE_SHEET_ID;
    const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;

    if (!SHEET_ID || !PRIVATE_KEY || !CLIENT_EMAIL) {
      throw new Error('Credenciais do Google Sheets ausentes. Configure GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL e GOOGLE_PRIVATE_KEY em .env');
    }

    const auth = new JWT({
      email: CLIENT_EMAIL,
      key: PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    spreadsheetDoc = new GoogleSpreadsheet(SHEET_ID, auth);
    await spreadsheetDoc.loadInfo();
    sheetsInitialized = true;

    console.log('✓ Google Sheets conectado com sucesso');
    await ensureSheetsExist();
    return spreadsheetDoc;
  } catch (error) {
    console.error('Erro ao inicializar Google Sheets:', error.message);
    throw error;
  }
}

async function ensureSheetsExist() {
  if (!spreadsheetDoc) return;

  const requiredSheets = ['demandas', 'colaboradores', 'config'];

  for (const sheetName of requiredSheets) {
    let sheet = spreadsheetDoc.sheetsByTitle[sheetName];

    if (!sheet) {
      console.log(`Criando aba: ${sheetName}`);
      sheet = await spreadsheetDoc.addSheet({ title: sheetName });

      if (sheetName === 'demandas') {
        await sheet.setHeaderRow([
          'id',
          'dataAbertura',
          'dataModificacao',
          'status',
          'equipe',
          'categoria',
          'atividade',
          'executor',
          'responsavel',
          'local',
          'andares',
          'obsAbertura',
          'dataConclusao',
          'conformidade',
          'obsFechamento'
        ]);
      } else if (sheetName === 'colaboradores') {
        await sheet.setHeaderRow([
          'nome',
          'equipe',
          'entrada',
          'saida',
          'intervalo',
          'dias'
        ]);
      } else if (sheetName === 'config') {
        await sheet.setHeaderRow(['chave', 'valor']);
      }
    }
  }
}

function normalizeDemandas(rows) {
  return rows.map((row) => ({
    id: row.get('id') || '',
    dataAbertura: row.get('dataAbertura') || '',
    dataModificacao: row.get('dataModificacao') || '',
    status: row.get('status') || '',
    equipe: row.get('equipe') || '',
    categoria: row.get('categoria') || '',
    atividade: row.get('atividade') || '',
    executor: row.get('executor') || '',
    responsavel: row.get('responsavel') || '',
    local: row.get('local') || '',
    andares: row.get('andares') || '',
    obsAbertura: row.get('obsAbertura') || '',
    dataConclusao: row.get('dataConclusao') || '',
    conformidade: row.get('conformidade') || '',
    obsFechamento: row.get('obsFechamento') || ''
  }));
}

function normalizeColaboradores(rows) {
  return rows.map((row) => ({
    nome: row.get('nome') || '',
    equipe: row.get('equipe') || '',
    entrada: row.get('entrada') || '',
    saida: row.get('saida') || '',
    intervalo: Number(row.get('intervalo')) || 60,
    dias: typeof row.get('dias') === 'string' && row.get('dias')
      ? row.get('dias').split(',').map((d) => Number(d)).filter(Boolean)
      : [1, 2, 3, 4, 5]
  }));
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'KAIZEN backend com Google Sheets online' });
});

app.get('/api/demandas', async (req, res) => {
  try {
    const doc = await initializeSheets();
    const sheet = doc.sheetsByTitle['demandas'];
    const rows = await sheet.getRows();
    const demandas = normalizeDemandas(rows);
    const abertas = demandas.filter((d) => !d.dataConclusao);
    const fechadas = demandas.filter((d) => d.dataConclusao);

    res.json({ abertas, fechadas, total: demandas.length });
  } catch (error) {
    console.error('Erro ao buscar demandas:', error);
    res.status(500).json({ error: error.message || 'Erro ao buscar demandas' });
  }
});

app.post('/api/demandas', async (req, res) => {
  try {
    const doc = await initializeSheets();
    const sheet = doc.sheetsByTitle['demandas'];
    const payload = Array.isArray(req.body) ? req.body : [req.body];

    for (const item of payload) {
      const demanda = { ...item };
      if (!demanda.id) {
        demanda.id = `D${Date.now()}${Math.random().toString(16).slice(2, 6)}`;
      }
      demanda.dataModificacao = new Date().toISOString();

      const rows = await sheet.getRows();
      const existing = rows.find((r) => r.get('id') === demanda.id);

      if (existing) {
        Object.entries(demanda).forEach(([key, value]) => {
          existing[key] = value;
        });
        await existing.save();
      } else {
        await sheet.addRow(demanda);
      }
    }

    res.json({ ok: true, total: payload.length });
  } catch (error) {
    console.error('Erro ao salvar demandas:', error);
    res.status(500).json({ error: error.message || 'Erro ao salvar demandas' });
  }
});

app.get('/api/colaboradores', async (req, res) => {
  try {
    const doc = await initializeSheets();
    const sheet = doc.sheetsByTitle['colaboradores'];
    const rows = await sheet.getRows();
    const colaboradores = normalizeColaboradores(rows);
    res.json(colaboradores);
  } catch (error) {
    console.error('Erro ao buscar colaboradores:', error);
    res.status(500).json({ error: error.message || 'Erro ao buscar colaboradores' });
  }
});

app.post('/api/colaboradores', async (req, res) => {
  try {
    const doc = await initializeSheets();
    const sheet = doc.sheetsByTitle['colaboradores'];
    const payload = Array.isArray(req.body) ? req.body : [req.body];

    for (const item of payload) {
      const colaborador = { ...item };
      if (!colaborador.nome) continue;
      colaborador.dias = Array.isArray(colaborador.dias) ? colaborador.dias.join(',') : '1,2,3,4,5';

      const rows = await sheet.getRows();
      const existing = rows.find((r) => r.get('nome') === colaborador.nome);

      if (existing) {
        Object.entries(colaborador).forEach(([key, value]) => {
          existing[key] = value;
        });
        await existing.save();
      } else {
        await sheet.addRow(colaborador);
      }
    }

    res.json({ ok: true, total: payload.length });
  } catch (error) {
    console.error('Erro ao salvar colaboradores:', error);
    res.status(500).json({ error: error.message || 'Erro ao salvar colaboradores' });
  }
});

app.get('/api/sync', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const interval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  res.on('close', () => {
    clearInterval(interval);
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'Documento de Santoro.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 KAIZEN backend rodando em http://localhost:${PORT}`);
  console.log('📊 Aguardando configuração do Google Sheets (.env)...');
});
