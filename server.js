const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'kaizen-data.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const seed = {
      kaizen_demandas: [],
      kaizen_colaboradores: [
        'Dereck Henry Brandão Rodrigues',
        'Fábio Fernandes da Silva',
        'José Cosmo Barbosa',
        'Luan Luiz de Oliveira',
        'Michel Assis Diniz Líder',
        'Salvador de Souza',
        'TODOS'
      ],
      kaizen_periodicas: [
        'LAVAÇÃO ANDARES GARAGEM',
        'LAVAÇÃO CALÇADAS ANP',
        'LAVAÇÃO CALÇADAS TRP',
        'LAVAÇÃO PAREDES EXTERNAS ANP',
        'LAVAÇÃO PAREDES EXTERNAS TRP',
        'REMOÇÃO CERA ANDARES',
        'REMOÇÃO CERA RECEPÇÃO',
        'APLICAÇÃO CERA ANDARES',
        'APLICAÇÃO CERA RECEPÇÃO',
        'JATEAMENTO PISO PRAÇA',
        'Outro'
      ],
      kaizen_rotina: [
        'Limpeza de Elevadores',
        'Limpeza de Refeitório',
        'Limpeza de Sanitários',
        'Limpeza de Hall / Recepção',
        'Recolhimento de Resíduos',
        'Varrição e Mop de Piso',
        'Outro'
      ],
      kaizen_horarios: {},
      kaizen_equipes: {},
      kaizen_last_sync: ''
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
  }
}

function readData() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function writeData(payload) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2));
  return payload;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'KAIZEN backend online' });
});

app.get('/api/kaizen-data', (_req, res) => {
  try {
    const data = readData();
    data.kaizen_last_sync = new Date().toISOString();
    writeData(data);
    res.json(data);
  } catch (error) {
    console.error('Erro ao ler dados:', error);
    res.status(500).json({ error: 'Erro ao ler dados compartilhados' });
  }
});

app.post('/api/kaizen-data', (req, res) => {
  try {
    const payload = req.body || {};
    const valid = {
      kaizen_demandas: Array.isArray(payload.kaizen_demandas) ? payload.kaizen_demandas : [],
      kaizen_colaboradores: Array.isArray(payload.kaizen_colaboradores) ? payload.kaizen_colaboradores : [],
      kaizen_periodicas: Array.isArray(payload.kaizen_periodicas) ? payload.kaizen_periodicas : [],
      kaizen_rotina: Array.isArray(payload.kaizen_rotina) ? payload.kaizen_rotina : [],
      kaizen_horarios: payload.kaizen_horarios || {},
      kaizen_equipes: payload.kaizen_equipes || {},
      kaizen_last_sync: new Date().toISOString()
    };

    const saved = writeData(valid);
    res.json({ ok: true, data: saved });
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    res.status(500).json({ error: 'Erro ao salvar dados compartilhados' });
  }
});

app.get('/api/demandas', (_req, res) => {
  const data = readData();
  const demandas = Array.isArray(data.kaizen_demandas) ? data.kaizen_demandas : [];
  const abertas = demandas.filter((d) => !d.dataConclusao);
  const fechadas = demandas.filter((d) => d.dataConclusao);
  res.json({ abertas, fechadas, total: demandas.length });
});

app.post('/api/demandas', (req, res) => {
  try {
    const data = readData();
    const lista = Array.isArray(req.body) ? req.body : req.body.demandas || [];
    data.kaizen_demandas = lista;
    const saved = writeData(data);
    res.json({ ok: true, total: saved.kaizen_demandas.length });
  } catch (error) {
    console.error('Erro ao salvar demandas:', error);
    res.status(500).json({ error: 'Erro ao salvar demandas' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'Documento de Santoro.html'));
});

app.listen(PORT, () => {
  console.log(`KAIZEN backend rodando em http://localhost:${PORT}`);
});
