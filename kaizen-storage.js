(function () {
  const STORAGE_ROUTE = '/api/kaizen-data';

  async function readServerData() {
    try {
      const response = await fetch(STORAGE_ROUTE, { method: 'GET' });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.warn('[KAIZEN STORAGE] Falha ao carregar via API:', error);
      return null;
    }
  }

  async function saveServerData(payload) {
    try {
      const response = await fetch(STORAGE_ROUTE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Resposta inválida ao salvar');
      }

      return await response.json();
    } catch (error) {
      console.error('[KAIZEN STORAGE] Falha ao salvar via API:', error);
      return null;
    }
  }

  function fallbackRead(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  }

  function fallbackWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('[KAIZEN STORAGE] localStorage indisponível');
    }
  }

  async function ensureSharedData() {
    const serverData = await readServerData();
    if (!serverData) return;

    const keys = [
      'kaizen_demandas',
      'kaizen_colaboradores',
      'kaizen_periodicas',
      'kaizen_rotina',
      'kaizen_horarios',
      'kaizen_equipes'
    ];

    keys.forEach((key) => {
      const value = serverData[key];
      if (value !== undefined) {
        fallbackWrite(key, value);
      }
    });
  }

  async function saveSharedState() {
    const payload = {
      kaizen_demandas: fallbackRead('kaizen_demandas', []),
      kaizen_colaboradores: fallbackRead('kaizen_colaboradores', []),
      kaizen_periodicas: fallbackRead('kaizen_periodicas', []),
      kaizen_rotina: fallbackRead('kaizen_rotina', []),
      kaizen_horarios: fallbackRead('kaizen_horarios', {}),
      kaizen_equipes: fallbackRead('kaizen_equipes', {})
    };

    return await saveServerData(payload);
  }

  window.KaizenStorage = {
    ensureSharedData,
    saveSharedState,
    readServerData,
    saveServerData,
    get(key, fallback) {
      const value = fallbackRead(key, fallback);
      return value;
    },
    set(key, value) {
      fallbackWrite(key, value);
      return value;
    }
  };

  window.addEventListener('load', () => {
    ensureSharedData();
  });
})();
