/**
 * KAIZEN - Sincronização, QR Code e Importação/Exportação
 * Módulo para gerenciar demandas abertas/fechadas com QR Code e múltiplos formatos
 */

// ============================================================================
// 1. SINCRONIZAÇÃO DE DADOS
// ============================================================================

const SyncManager = {
  // Chave para armazenar última sincronização
  LAST_SYNC_KEY: 'kaizen_last_sync',
  SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutos
  
  init() {
    // Inicia sincronização periódica
    setInterval(() => this.syncDemandas(), this.SYNC_INTERVAL);
    
    // Sincroniza ao carregar
    this.syncDemandas();
  },
  
  syncDemandas() {
    try {
      const demandas = JSON.parse(localStorage.getItem('kaizen_demandas')) || [];
      const lastSync = localStorage.getItem(this.LAST_SYNC_KEY);
      
      console.log(`[SYNC] Sincronizando demandas às ${new Date().toLocaleTimeString('pt-BR')}`);
      
      // Separa demandas abertas e fechadas
      const abertas = demandas.filter(d => !d.dataConclusao);
      const fechadas = demandas.filter(d => d.dataConclusao);
      
      // Armazena separadamente para fácil acesso
      localStorage.setItem('kaizen_demandas_abertas', JSON.stringify(abertas));
      localStorage.setItem('kaizen_demandas_fechadas', JSON.stringify(fechadas));
      
      // Atualiza timestamp
      localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
      
      // Dispara evento customizado
      window.dispatchEvent(new CustomEvent('syncCompleted', { 
        detail: { abertas: abertas.length, fechadas: fechadas.length } 
      }));
      
      return { abertas, fechadas };
    } catch (e) {
      console.error('[SYNC] Erro na sincronização:', e);
      window.kzToast('Erro ao sincronizar demandas', 'err');
    }
  },
  
  getDemandas(tipo = 'todas') {
    const demandas = JSON.parse(localStorage.getItem('kaizen_demandas')) || [];
    
    if (tipo === 'abertas') {
      return demandas.filter(d => !d.dataConclusao);
    } else if (tipo === 'fechadas') {
      return demandas.filter(d => d.dataConclusao);
    }
    return demandas;
  },
  
  getStatistics() {
    const demandas = JSON.parse(localStorage.getItem('kaizen_demandas')) || [];
    const abertas = demandas.filter(d => !d.dataConclusao);
    const fechadas = demandas.filter(d => d.dataConclusao);
    
    return {
      total: demandas.length,
      abertas: abertas.length,
      fechadas: fechadas.length,
      percentualConclusao: demandas.length > 0 
        ? ((fechadas.length / demandas.length) * 100).toFixed(1) 
        : 0
    };
  }
};

// ============================================================================
// 2. GERAÇÃO DE QR CODE
// ============================================================================

const QRCodeManager = {
  // CDN de QR Code
  QR_API: 'https://api.qrserver.com/v1/create-qr-code/',
  
  // Gera URL do QR Code
  generateQRURL(data, size = 300) {
    const encoded = encodeURIComponent(data);
    return `${this.QR_API}?size=${size}x${size}&data=${encoded}`;
  },
  
  // Cria QR Code para exportação de demandas
  generateExportQR(tipo = 'abertas') {
    try {
      const demandas = SyncManager.getDemandas(tipo);
      const data = JSON.stringify({
        tipo: 'kaizen_export',
        exportType: tipo,
        timestamp: new Date().toISOString(),
        count: demandas.length,
        demandas: demandas
      });
      
      return this.generateQRURL(data);
    } catch (e) {
      console.error('Erro ao gerar QR Code de exportação:', e);
      return null;
    }
  },
  
  // Cria QR Code para importação (link de sincronização)
  generateSyncQR() {
    try {
      const syncData = {
        tipo: 'kaizen_sync',
        timestamp: new Date().toISOString(),
        url: window.location.href
      };
      
      return this.generateQRURL(JSON.stringify(syncData));
    } catch (e) {
      console.error('Erro ao gerar QR Code de sincronização:', e);
      return null;
    }
  },
  
  // Exibe QR Code em modal
  showQRModal(qrURL, titulo = 'QR Code') {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;
    
    const box = document.createElement('div');
    box.style.cssText = `
      background: white;
      border-radius: 20px;
      padding: 30px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 400px;
      width: 100%;
    `;
    
    const title = document.createElement('h3');
    title.textContent = titulo;
    title.style.cssText = 'font-size: 18px; font-weight: bold; margin-bottom: 20px; color: #1e293b;';
    
    const img = document.createElement('img');
    img.src = qrURL;
    img.style.cssText = 'width: 300px; height: 300px; margin: 0 auto; display: block;';
    
    const info = document.createElement('p');
    info.textContent = 'Escaneie para importar ou sincronizar dados';
    info.style.cssText = 'font-size: 12px; color: #64748b; margin-top: 15px;';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fechar';
    closeBtn.style.cssText = `
      margin-top: 20px;
      padding: 10px 20px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-weight: bold;
    `;
    closeBtn.onclick = () => modal.remove();
    
    box.appendChild(title);
    box.appendChild(img);
    box.appendChild(info);
    box.appendChild(closeBtn);
    modal.appendChild(box);
    document.body.appendChild(modal);
  }
};

// ============================================================================
// 3. IMPORTAÇÃO E EXPORTAÇÃO (Excel, CSV, JSON)
// ============================================================================

const ImportExportManager = {
  
  // EXPORTAR para Excel
  exportToExcel() {
    try {
      const demandas = SyncManager.getDemandas('todas');
      
      if (demandas.length === 0) {
        window.kzToast('Nenhuma demanda para exportar', 'err');
        return;
      }
      
      // Prepara dados para Excel
      const data = demandas.map(d => ({
        'Status': d.dataConclusao ? 'Fechada' : 'Aberta',
        'Equipe': d.equipe,
        'Categoria': d.categoria,
        'Atividade': d.atividade,
        'Executor': d.executor,
        'Responsável': d.responsavel,
        'Local/Unidade': d.local,
        'Andares': (d.andares || []).join(', '),
        'Abertura': d.dataAbertura,
        'Conclusão': d.dataConclusao || '--',
        'Conformidade': d.conformidade || '--',
        'Observações': d.obsAbertura || ''
      }));
      
      // Converte para CSV (que pode ser importado no Excel)
      const csv = this.convertToCSV(data);
      
      // Download do arquivo
      this.downloadFile(csv, `demandas-kaizen-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      window.kzToast('Demandas exportadas para Excel com sucesso!', 'ok');
    } catch (e) {
      console.error('Erro ao exportar Excel:', e);
      window.kzToast('Erro ao exportar dados', 'err');
    }
  },
  
  // EXPORTAR para CSV
  exportToCSV() {
    try {
      const demandas = SyncManager.getDemandas('todas');
      
      if (demandas.length === 0) {
        window.kzToast('Nenhuma demanda para exportar', 'err');
        return;
      }
      
      const data = demandas.map(d => ({
        'ID': d.id || 'N/A',
        'Status': d.dataConclusao ? 'Fechada' : 'Aberta',
        'Equipe': d.equipe,
        'Categoria': d.categoria,
        'Atividade': d.atividade,
        'Executor': d.executor,
        'Responsável': d.responsavel,
        'Local': d.local,
        'Andares': (d.andares || []).join('; '),
        'Abertura': d.dataAbertura,
        'Conclusão': d.dataConclusao || '--',
        'Conformidade': d.conformidade || '--',
        'Observações Abertura': d.obsAbertura || '',
        'Observações Fechamento': d.obsFechamento || ''
      }));
      
      const csv = this.convertToCSV(data);
      this.downloadFile(csv, `demandas-kaizen-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      window.kzToast('Demandas exportadas para CSV com sucesso!', 'ok');
    } catch (e) {
      console.error('Erro ao exportar CSV:', e);
      window.kzToast('Erro ao exportar dados', 'err');
    }
  },
  
  // EXPORTAR para JSON
  exportToJSON() {
    try {
      const demandas = SyncManager.getDemandas('todas');
      const json = JSON.stringify(demandas, null, 2);
      
      this.downloadFile(json, `demandas-kaizen-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      window.kzToast('Demandas exportadas para JSON com sucesso!', 'ok');
    } catch (e) {
      console.error('Erro ao exportar JSON:', e);
      window.kzToast('Erro ao exportar dados', 'err');
    }
  },
  
  // IMPORTAR de arquivo
  importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          let data = [];
          
          // Detecta formato
          if (file.name.endsWith('.json')) {
            data = JSON.parse(content);
          } else if (file.name.endsWith('.csv')) {
            data = this.parseCSV(content);
          } else {
            throw new Error('Formato de arquivo não suportado. Use JSON ou CSV.');
          }
          
          if (!Array.isArray(data)) {
            throw new Error('Dados inválidos. Esperado um array de demandas.');
          }
          
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file);
    });
  },
  
  // Sincroniza importação com demandas existentes
  async syncImportedDemandas(importedData, mergeMode = 'merge') {
    try {
      const existingDemandas = SyncManager.getDemandas('todas');
      let merged = [...existingDemandas];
      
      if (mergeMode === 'replace') {
        merged = [...importedData];
      } else if (mergeMode === 'merge') {
        // Mescla dados: se ID existir, atualiza; senão, adiciona
        importedData.forEach(imported => {
          const index = merged.findIndex(d => d.id === imported.id);
          if (index >= 0) {
            merged[index] = { ...merged[index], ...imported };
          } else {
            merged.push(imported);
          }
        });
      }
      
      localStorage.setItem('kaizen_demandas', JSON.stringify(merged));
      SyncManager.syncDemandas();
      
      window.kzToast(`${importedData.length} demanda(s) importada(s) com sucesso!`, 'ok');
      return merged;
    } catch (e) {
      console.error('Erro ao sincronizar importação:', e);
      window.kzToast('Erro ao sincronizar dados importados', 'err');
      throw e;
    }
  },
  
  // Converte array de objetos para CSV
  convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(obj => 
      headers.map(header => {
        const value = obj[header];
        // Escapa aspas e quebras de linha
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  },
  
  // Parse CSV para array de objetos
  parseCSV(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const obj = {};
      const values = this.parseCSVLine(lines[i]);
      
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      
      data.push(obj);
    }
    
    return data;
  },
  
  // Parse de uma linha CSV respeitando aspas
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  },
  
  // Download de arquivo
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// ============================================================================
// 4. INTERFACE DE CONTROLE
// ============================================================================

function renderSyncControls() {
  const container = document.getElementById('sync-controls');
  if (!container) return;
  
  const stats = SyncManager.getStatistics();
  
  container.innerHTML = `
    <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
            <i class="fa-solid fa-sync text-blue-600"></i>
            Sincronização e Importação/Exportação
          </h3>
          <p class="text-xs text-slate-500 mt-1">
            Demandas Abertas: <strong>${stats.abertas}</strong> | 
            Fechadas: <strong>${stats.fechadas}</strong> | 
            Total: <strong>${stats.total}</strong>
          </p>
        </div>
      </div>
      
      <div class="flex flex-wrap gap-2">
        <!-- Botões de QR Code -->
        <button onclick="QRCodeManager.showQRModal(QRCodeManager.generateExportQR('abertas'), 'QR Code - Demandas Abertas')" 
                class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2">
          <i class="fa-solid fa-qrcode"></i> QR Abertas
        </button>
        
        <button onclick="QRCodeManager.showQRModal(QRCodeManager.generateExportQR('fechadas'), 'QR Code - Demandas Fechadas')" 
                class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2">
          <i class="fa-solid fa-qrcode"></i> QR Fechadas
        </button>
        
        <button onclick="QRCodeManager.showQRModal(QRCodeManager.generateSyncQR(), 'QR Code - Sincronização')" 
                class="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2">
          <i class="fa-solid fa-qrcode"></i> QR Sync
        </button>
        
        <!-- Botões de Exportação -->
        <button onclick="ImportExportManager.exportToExcel()" 
                class="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2">
          <i class="fa-solid fa-file-excel"></i> Exportar Excel
        </button>
        
        <button onclick="ImportExportManager.exportToCSV()" 
                class="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2">
          <i class="fa-solid fa-file-csv"></i> Exportar CSV
        </button>
        
        <button onclick="ImportExportManager.exportToJSON()" 
                class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2">
          <i class="fa-solid fa-file-code"></i> Exportar JSON
        </button>
        
        <!-- Botão de Importação -->
        <button onclick="document.getElementById('import-file-input').click()" 
                class="bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2">
          <i class="fa-solid fa-upload"></i> Importar
        </button>
        
        <input type="file" id="import-file-input" accept=".json,.csv" style="display:none;" onchange="handleFileImport(event)">
      </div>
    </div>
  `;
}

async function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const data = await ImportExportManager.importFromFile(file);
    
    const confirmed = await window.kzAsk(
      `Importar ${data.length} demanda(s)?\n\nEscolha: Mesclar com existentes ou Substituir?`,
      'Mesclar',
      'info'
    );
    
    const mergeMode = confirmed ? 'merge' : 'replace';
    await ImportExportManager.syncImportedDemandas(data, mergeMode);
    
    // Atualiza interface
    if (typeof renderDemandasEmAndamento === 'function') {
      renderDemandasEmAndamento();
    }
    if (typeof renderManagerDashboard === 'function') {
      renderManagerDashboard();
    }
  } catch (e) {
    window.kzToast(`Erro na importação: ${e.message}`, 'err');
  }
  
  // Limpa input
  event.target.value = '';
}

// ============================================================================
// 5. INICIALIZAÇÃO
// ============================================================================

// Inicia sincronização ao carregar página
window.addEventListener('load', () => {
  SyncManager.init();
  renderSyncControls();
  
  // Atualiza controles ao sincronizar
  window.addEventListener('syncCompleted', (e) => {
    console.log('✓ Sincronização concluída:', e.detail);
  });
});

// Exporta para uso global
window.SyncManager = SyncManager;
window.QRCodeManager = QRCodeManager;
window.ImportExportManager = ImportExportManager;
