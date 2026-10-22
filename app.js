// State Variables
let appData = {
  pdvData: [],
  defaultConfig: {},
  salesDetailData: {} // To store Hoja3 aggregated data
};

let currentState = {
  selectedCadena: '',
  selectedPdv: null,
  anfitrionesEvaluar: 2,
  horasServicio: {
    Lunes: 14.0,
    Martes: 14.0,
    Miércoles: 14.0,
    Jueves: 14.0,
    Viernes: 14.0,
    Sábado: 14.0,
    Domingo: 14.0
  },
  selectedDates: [], // For the daily sales average tab
  selectedHours: [] // To store multiple selected hours (strings)
};

// Initialize selected hours with 8-24 by default
for (let h = 8; h <= 24; h++) {
  currentState.selectedHours.push(String(h));
}

// Initialize selected dates dynamically when PDV or data is loaded

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
  setupDragAndDrop();
  loadSavedDataOrDefaults();
});

// Switch Tabs
function switchTab(tabName) {
  document.getElementById('tab-calculator').classList.toggle('active', tabName === 'calculator');
  document.getElementById('tab-sales-average').classList.toggle('active', tabName === 'sales-average');
  document.getElementById('tab-sync').classList.toggle('active', tabName === 'sync');
  
  document.getElementById('content-calculator').style.display = tabName === 'calculator' ? 'block' : 'none';
  document.getElementById('content-sales-average').style.display = tabName === 'sales-average' ? 'block' : 'none';
  document.getElementById('content-sync').style.display = tabName === 'sync' ? 'block' : 'none';

  if (tabName === 'sales-average') {
    updateSalesAverageTab();
  }
}

// Load Default Data from local JSON
async function loadSavedDataOrDefaults() {
  setAppStatus("Cargando base de datos...", "info");
  
  // 1. Check if there is data in localStorage
  const savedData = localStorage.getItem('drive_dashboard_data');
  const savedUrl = localStorage.getItem('drive_dashboard_sheets_url');
  
  if (savedUrl) {
    document.getElementById('sheets-url').value = savedUrl;
  }

  // Fetch the fresh data.json to bypass cache and have it ready
  let freshData = null;
  try {
    const response = await fetch('data.json?v=' + Date.now());
    if (response.ok) {
      freshData = await response.json();
    }
  } catch (e) {
    console.error("Error fetching data.json", e);
  }

  if (savedData) {
    try {
      appData = JSON.parse(savedData);
      
      // Check if the loaded salesDetailData has the old format (no 'hours' key in its dates)
      let isOldFormat = false;
      if (appData.salesDetailData) {
        const firstCeco = Object.keys(appData.salesDetailData)[0];
        if (firstCeco) {
          const datesObj = appData.salesDetailData[firstCeco];
          const firstDate = Object.keys(datesObj)[0];
          if (firstDate && datesObj[firstDate] && !datesObj[firstDate].hours) {
            isOldFormat = true;
          }
        }
      } else {
        isOldFormat = true;
      }
      
      // If salesDetailData is missing, empty, or in the old format, merge it from freshData
      if ((isOldFormat || !appData.salesDetailData || Object.keys(appData.salesDetailData).length === 0) && freshData) {
        appData.salesDetailData = freshData.salesDetailData;
        localStorage.setItem('drive_dashboard_data', JSON.stringify(appData));
      }
      
      setAppStatus("Base de datos cargada (Local guardada)", "success");
      initSelectorsAndSliders();
      return;
    } catch (e) {
      console.error("Error loading localStorage data, falling back to defaults", e);
    }
  }

  // 2. Use default freshData if no savedData
  if (freshData) {
    appData = freshData;
    setAppStatus("Base de datos sincronizada", "success");
    initSelectorsAndSliders();
  } else {
    setAppStatus("Error: Sube un archivo Excel para iniciar", "danger");
    switchTab('sync');
  }
}

// Set status text
function setAppStatus(text, type) {
  const statusEl = document.getElementById('app-status');
  statusEl.innerText = text;
  
  // Clean classes
  statusEl.className = '';
  if (type === "success") statusEl.style.color = "var(--success)";
  else if (type === "danger") statusEl.style.color = "var(--danger)";
  else statusEl.style.color = "var(--accent-cyan)";
}

// Initialize Selectors and Sliders with appData
function initSelectorsAndSliders() {
  if (!appData.pdvData || appData.pdvData.length === 0) return;

  // Apply default config from Excel if present and not set
  if (appData.defaultConfig) {
    const conf = appData.defaultConfig;
    currentState.anfitrionesEvaluar = Math.round(conf.anfitriones_evaluar) || 2;
    if (conf.horas_semana) {
      currentState.horasServicio = { ...conf.horas_semana };
    }
  }

  // Set initial slider UI values
  document.getElementById('input-anfitriones').value = currentState.anfitrionesEvaluar;
  document.getElementById('val-anfitriones').innerText = currentState.anfitrionesEvaluar.toFixed(0);

  // Set day values in UI
  Object.keys(currentState.horasServicio).forEach(day => {
    document.getElementById(`val-${day}`).innerText = currentState.horasServicio[day].toFixed(1);
  });

  // Extract unique Cadenas (Columna A en el Excel)
  const cadenas = [...new Set(appData.pdvData.map(item => item['CADENA']))].filter(Boolean);
  
  const cadenaSelect = document.getElementById('select-cadena');
  const cadenaSelectSales = document.getElementById('select-cadena-sales');
  
  if (cadenaSelect) cadenaSelect.innerHTML = '';
  if (cadenaSelectSales) cadenaSelectSales.innerHTML = '';
  
  cadenas.forEach(cad => {
    if (cadenaSelect) {
      const opt = document.createElement('option');
      opt.value = cad;
      opt.innerText = cad;
      cadenaSelect.appendChild(opt);
    }
    if (cadenaSelectSales) {
      const opt = document.createElement('option');
      opt.value = cad;
      opt.innerText = cad;
      cadenaSelectSales.appendChild(opt);
    }
  });

  if (cadenas.length > 0) {
    currentState.selectedCadena = cadenas[0];
    onCadenaChange();
  }
}

// Populate PDV drop-downs for both tabs
function populatePdvDropdowns(cadena) {
  const filteredPdvs = appData.pdvData.filter(item => item['CADENA'] === cadena);
  
  const pdvSelectMain = document.getElementById('select-pdv');
  const pdvSelectSales = document.getElementById('select-pdv-sales');
  
  if (pdvSelectMain) pdvSelectMain.innerHTML = '';
  if (pdvSelectSales) pdvSelectSales.innerHTML = '';
  
  filteredPdvs.forEach(pdv => {
    if (pdvSelectMain) {
      const optMain = document.createElement('option');
      optMain.value = pdv['CECO'];
      optMain.innerText = `${pdv['RESTAURANTE']} (${pdv['CECO']})`;
      pdvSelectMain.appendChild(optMain);
    }
    if (pdvSelectSales) {
      const optSales = document.createElement('option');
      optSales.value = pdv['CECO'];
      optSales.innerText = `${pdv['RESTAURANTE']} (${pdv['CECO']})`;
      pdvSelectSales.appendChild(optSales);
    }
  });
}

// Handle chain change -> populate PDVs
function onCadenaChange() {
  const cadenaSelect = document.getElementById('select-cadena');
  const val = cadenaSelect.value;
  currentState.selectedCadena = val;

  const salesCadenaSelect = document.getElementById('select-cadena-sales');
  if (salesCadenaSelect) salesCadenaSelect.value = val;

  populatePdvDropdowns(val);

  // Set first pdv as default
  const filteredPdvs = appData.pdvData.filter(item => item['CADENA'] === val);
  if (filteredPdvs.length > 0) {
    const defaultCeco = appData.defaultConfig && appData.defaultConfig.ceco ? appData.defaultConfig.ceco.toUpperCase() : '';
    const match = filteredPdvs.find(p => p['CECO'].toUpperCase() === defaultCeco);
    const selectedPdv = match || filteredPdvs[0];
    
    currentState.selectedPdv = selectedPdv;
    
    if (document.getElementById('select-pdv')) {
      document.getElementById('select-pdv').value = selectedPdv['CECO'];
    }
    if (document.getElementById('select-pdv-sales')) {
      document.getElementById('select-pdv-sales').value = selectedPdv['CECO'];
    }
    
    onPdvChangeCommon();
  }
}

function onCadenaSalesChange() {
  const salesCadenaSelect = document.getElementById('select-cadena-sales');
  const val = salesCadenaSelect.value;
  currentState.selectedCadena = val;

  const mainCadenaSelect = document.getElementById('select-cadena');
  if (mainCadenaSelect) mainCadenaSelect.value = val;

  populatePdvDropdowns(val);

  // Set first pdv as default
  const filteredPdvs = appData.pdvData.filter(item => item['CADENA'] === val);
  if (filteredPdvs.length > 0) {
    const defaultCeco = appData.defaultConfig && appData.defaultConfig.ceco ? appData.defaultConfig.ceco.toUpperCase() : '';
    const match = filteredPdvs.find(p => p['CECO'].toUpperCase() === defaultCeco);
    const selectedPdv = match || filteredPdvs[0];
    
    currentState.selectedPdv = selectedPdv;
    
    if (document.getElementById('select-pdv')) {
      document.getElementById('select-pdv').value = selectedPdv['CECO'];
    }
    if (document.getElementById('select-pdv-sales')) {
      document.getElementById('select-pdv-sales').value = selectedPdv['CECO'];
    }
    
    onPdvChangeCommon();
  }
}

// Handle PDV selection change
function onPdvChange() {
  const pdvSelect = document.getElementById('select-pdv');
  const ceco = pdvSelect.value;

  const salesPdvSelect = document.getElementById('select-pdv-sales');
  if (salesPdvSelect) salesPdvSelect.value = ceco;

  currentState.selectedPdv = appData.pdvData.find(item => item['CECO'] === ceco);
  onPdvChangeCommon();
}

function onPdvSalesChange() {
  const salesPdvSelect = document.getElementById('select-pdv-sales');
  const ceco = salesPdvSelect.value;

  const pdvSelect = document.getElementById('select-pdv');
  if (pdvSelect) pdvSelect.value = ceco;

  currentState.selectedPdv = appData.pdvData.find(item => item['CECO'] === ceco);
  onPdvChangeCommon();
}

function onPdvChangeCommon() {
  updatePdvInfoCard();
  recalculateProductivity();
  updateSalesAverageTab();
}

// Update UI info card of the selected restaurant
function updatePdvInfoCard() {
  const pdv = currentState.selectedPdv;
  if (!pdv) return;

  document.getElementById('info-venta').innerText = formatCurrency(pdv['Ventas']);
  document.getElementById('info-gasto-personal').innerText = formatCurrency(pdv['Gasto personal PYG']);
  document.getElementById('info-planta').innerText = Number(pdv['Planta anfitriones PDV'] || 0).toFixed(0);
  document.getElementById('info-ticket').innerText = formatCurrency(pdv['Ticket promedio transacciones']);
  document.getElementById('info-servicios').innerText = formatCurrency(pdv['Servicios']);

  // Obtener Utilidad Neta Objetivo de la base
  let utilityKey = Object.keys(pdv).find(key => key.toLowerCase().includes('utilidad') && key.toLowerCase().includes('objetivo'));
  if (!utilityKey) {
    utilityKey = Object.keys(pdv).find(key => key.toLowerCase().includes('utilidad'));
  }
  let rawUtility = utilityKey ? pdv[utilityKey] : 0.1012;
  let parsedUtility = parseFloat(rawUtility);
  if (isNaN(parsedUtility)) parsedUtility = 0.1012;
  if (parsedUtility > 1) {
    parsedUtility = parsedUtility / 100;
  }
  document.getElementById('info-utilidad-neta').innerText = formatNumber(parsedUtility * 100, 2) + "%";
}

// Update simulation variable: Anfitriones
function updateAnfitriones(val) {
  currentState.anfitrionesEvaluar = Math.round(parseFloat(val)) || 1;
  document.getElementById('val-anfitriones').innerText = currentState.anfitrionesEvaluar.toFixed(0);
  recalculateProductivity();
}

function adjustAnfitriones(amount) {
  const slider = document.getElementById('input-anfitriones');
  let val = Math.round(parseFloat(slider.value)) + Math.round(amount);
  val = Math.max(1, Math.min(15, val));
  slider.value = val;
  updateAnfitriones(val);
}

// Update service hours
function adjustDayHour(day, amount) {
  let val = currentState.horasServicio[day] + amount;
  val = Math.max(0, Math.min(24, val));
  currentState.horasServicio[day] = val;
  document.getElementById(`val-${day}`).innerText = val.toFixed(1);
  recalculateProductivity();
}

function setAllHours(hours) {
  Object.keys(currentState.horasServicio).forEach(day => {
    currentState.horasServicio[day] = hours;
    document.getElementById(`val-${day}`).innerText = hours.toFixed(1);
  });
  recalculateProductivity();
}

// Formatting helpers
function formatCurrency(val) {
  if (val === undefined || val === null || isNaN(val)) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val).replace('COP', '$').trim();
}

function formatNumber(val, decimals = 2) {
  if (val === undefined || val === null || isNaN(val)) return '0.0';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(val);
}

// Real-time calculation math matching Excel formula exactly
function recalculateProductivity() {
  const pdv = currentState.selectedPdv;
  if (!pdv) return;

  // 1. Total Horas Semana
  const totalHorasSemana = Object.values(currentState.horasServicio).reduce((sum, h) => sum + h, 0);
  
  // 2. Total Horas mes (B27) = B26 * (31 / 7) -> para un mes de 31 días (enero)
  const totalHorasMes = totalHorasSemana * (31 / 7);

  // 3. Gasto personal por hora de servicio (E14)
  // Formula: =+((GastoPersonal / HorasServicio) * AnfitrionesEvaluar) / PlantaPDV
  const gastoPersonalTotal = pdv['Gasto personal PYG'] || 0;
  const plantaPDV = pdv['Planta anfitriones PDV'] || 1.0;
  
  let gastoPersonalHora = 0;
  if (totalHorasMes > 0 && plantaPDV > 0) {
    gastoPersonalHora = ((gastoPersonalTotal / totalHorasMes) * currentState.anfitrionesEvaluar) / plantaPDV;
  }

  // 3.1 Costo de Servicios por hora de servicio (Servicios / totalHorasMes)
  const serviciosTotal = pdv['Servicios'] || 0;
  let servicioHora = 0;
  if (totalHorasMes > 0) {
    servicioHora = serviciosTotal / totalHorasMes;
  }

  // 3.2 Utilidad esperada por hora (Costo Personal por hora + Costo Servicios por hora)
  const utilidadEsperadaHora = gastoPersonalHora + servicioHora;

  // 4. $ Utilidad neta x transaccion (E9)
  // Obtener Utilidad Neta Objetivo de la base
  let utilityKey = Object.keys(pdv).find(key => key.toLowerCase().includes('utilidad') && key.toLowerCase().includes('objetivo'));
  if (!utilityKey) {
    utilityKey = Object.keys(pdv).find(key => key.toLowerCase().includes('utilidad'));
  }
  let rawUtility = utilityKey ? pdv[utilityKey] : 0.1012;
  let parsedUtility = parseFloat(rawUtility);
  if (isNaN(parsedUtility)) parsedUtility = 0.1012;
  if (parsedUtility > 1) {
    parsedUtility = parsedUtility / 100;
  }

  const ticketPromedio = pdv['Ticket promedio transacciones'] || 1.0;
  const utilidadNetaPorTransaccion = parsedUtility * ticketPromedio;

  // 5. Cantidad transacciones para productividad por hora (E18)
  // Formula: =+ UtilidadEsperadaHora / UtilidadNetaPorTransaccion
  let transaccionesRequeridasHora = 0;
  if (utilidadNetaPorTransaccion > 0) {
    transaccionesRequeridasHora = utilidadEsperadaHora / utilidadNetaPorTransaccion;
  }

  // 6. Cantidad de venta por Hora (E20)
  // Formula: =+ TransaccionesRequeridasHora * TicketPromedio
  const ventaRequeridaHora = transaccionesRequeridasHora * ticketPromedio;

  // Update UI Elements
  document.getElementById('result-horas-mes').innerText = formatNumber(totalHorasMes, 1) + " hrs";
  document.getElementById('result-gasto-personal-hora').innerText = formatCurrency(gastoPersonalHora);
  if (document.getElementById('result-servicios-hora')) {
    document.getElementById('result-servicios-hora').innerText = formatCurrency(servicioHora);
  }
  if (document.getElementById('result-total-costo-hora')) {
    document.getElementById('result-total-costo-hora').innerText = formatCurrency(utilidadEsperadaHora);
  }
  document.getElementById('result-transacciones-hora').innerText = formatNumber(transaccionesRequeridasHora, 2);
  document.getElementById('result-venta-hora').innerText = formatCurrency(ventaRequeridaHora);

  // Actual average sales per hour for comparison:
  // (Ventas Totales del PDV / totalHorasMes)
  let actualVentaHora = 0;
  if (totalHorasMes > 0) {
    actualVentaHora = (pdv['Ventas'] || 0) / totalHorasMes;
  }
}

// ----------------- SYNC / UPLOAD FUNCTIONALITY -----------------

// Drag & Drop Area Setup
function setupDragAndDrop() {
  const dropArea = document.getElementById('drop-area');

  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropArea.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropArea.classList.remove('dragover');
    }, false);
  });

  dropArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      processLocalExcelFile(files[0]);
    }
  }, false);
}

function triggerFileSelect() {
  document.getElementById('fileInput').click();
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    processLocalExcelFile(file);
  }
}

// Process local Excel Upload
function processLocalExcelFile(file) {
  const reader = new FileReader();
  
  setAppStatus("Procesando archivo Excel...", "info");
  
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      
      const parsedData = parseWorkbookData(workbook);
      
      // Save parsed data
      appData = parsedData;
      localStorage.setItem('drive_dashboard_data', JSON.stringify(appData));
      
      // Update UI info
      document.getElementById('file-info').style.display = 'block';
      document.getElementById('file-name').innerText = file.name;
      
      setAppStatus("Excel cargado correctamente", "success");
      initSelectorsAndSliders();
      
      // Switch back to calculator tab automatically
      setTimeout(() => switchTab('calculator'), 1000);
      
    } catch (err) {
      console.error("Error reading file", err);
      setAppStatus("Error al leer el archivo Excel. Revisa el formato.", "danger");
    }
  };
  
  reader.readAsArrayBuffer(file);
}

// Parse XLSX workbook to structure
function parseWorkbookData(workbook) {
  // Find sheet names ignoring case and spaces
  const findSheetName = (targets) => {
    return workbook.SheetNames.find(name => {
      const clean = name.trim().toLowerCase().replace(/\s+/g, '');
      return targets.some(t => clean === t);
    });
  };

  const sheet2Name = findSheetName(['hoja2', 'sheet2', 'base']);
  const sheet1Name = findSheetName(['hoja1', 'sheet1', 'config', 'configuracion']);
  const sheet3Name = findSheetName(['hoja3', 'sheet3', 'ventas', 'ventasdiarias']);

  // 1. Process Hoja2 (Database)
  if (!sheet2Name) {
    throw new Error("El Excel debe contener una pestaña para la base de datos (Hoja2)");
  }
  
  const sheet2 = workbook.Sheets[sheet2Name];
  const json2 = XLSX.utils.sheet_to_json(sheet2, { header: 1 });
  
  if (json2.length < 2) {
    throw new Error("Hoja2 no contiene suficientes filas.");
  }

  const headers = json2[0].map(h => String(h || '').trim());
  const pdvData = [];

  for (let r = 1; r < json2.length; r++) {
    const row = json2[r];
    if (!row || row.length === 0 || !row.some(cell => cell !== null && cell !== undefined)) {
      continue;
    }
    
    const rowObj = {};
    headers.forEach((h, index) => {
      let val = row[index];
      if (val === undefined || val === null) {
        val = 0;
      }
      if (typeof val === 'string') {
        val = val.trim();
      }
      rowObj[h] = val;
    });
    pdvData.push(rowObj);
  }

  // 2. Process Hoja1 (Config)
  let defaultConfig = {};
  if (sheet1Name) {
    const sheet1 = workbook.Sheets[sheet1Name];
    
    // Read cells based on known addresses in excel
    const getVal = (cellRef, defaultVal) => {
      const cell = sheet1[cellRef];
      return (cell && cell.v !== undefined) ? cell.v : defaultVal;
    };
    
    defaultConfig = {
      ceco: String(getVal('B2', 'v204')).trim(),
      anfitriones_evaluar: parseFloat(getVal('B5', 2.0)),
      promedio_utilidad_neta: parseFloat(getVal('B12', 0.1012)),
      horas_semana: {
        Lunes: parseFloat(getVal('B19', 14.0)),
        Martes: parseFloat(getVal('B20', 14.0)),
        Miércoles: parseFloat(getVal('B21', 14.0)),
        Jueves: parseFloat(getVal('B22', 14.0)),
        Viernes: parseFloat(getVal('B23', 14.0)),
        Sábado: parseFloat(getVal('B24', 14.0)),
        Domingo: parseFloat(getVal('B25', 14.0))
      }
    };
  }

  // 3. Process Hoja3 (Daily Sales details) if it exists
  let salesDetailData = {};
  if (sheet3Name) {
    const sheet3 = workbook.Sheets[sheet3Name];
    const json3 = XLSX.utils.sheet_to_json(sheet3, { header: 1 });
    
    if (json3.length >= 2) {
      const headers3 = json3[0].map(h => String(h || '').trim());
      
      const findHeaderIndex = (headers, targets) => {
        return headers.findIndex(h => {
          const clean = h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return targets.some(t => clean === t || clean.includes(t));
        });
      };

      const coIndex = findHeaderIndex(headers3, ['c.o.', 'ceco', 'centro de costo', 'co']);
      const fechaIndex = findHeaderIndex(headers3, ['fecha', 'date']);
      const diaIndex = findHeaderIndex(headers3, ['dia', 'day']);
      const horaIndex = findHeaderIndex(headers3, ['hora', 'hour']);
      const valorIndex = findHeaderIndex(headers3, ['valor', 'venta', 'sales', 'valor total']);
      const docIndex = findHeaderIndex(headers3, ['nro. documento', 'nro documento', 'transacciones', 'nro doc', 'documento', 'docs']);
      
      const ticketMap = {};
      pdvData.forEach(p => {
        const c = String(p['CECO'] || '').trim().toUpperCase();
        let t = parseFloat(p['Ticket promedio transacciones '] || p['Ticket promedio transacciones'] || 0);
        ticketMap[c] = t;
      });

      if (coIndex !== -1 && fechaIndex !== -1) {
        for (let r = 1; r < json3.length; r++) {
          const row = json3[r];
          if (!row || row.length === 0) continue;
          
          const co = String(row[coIndex] || '').trim().toUpperCase();
          const fechaVal = row[fechaIndex];
          const dia = String(row[diaIndex] || '').trim().toLowerCase();
          
          let valorRaw = row[valorIndex];
          let valor = 0;
          if (valorRaw !== undefined && valorRaw !== null && valorRaw !== '-') {
            valor = parseFloat(valorRaw) || 0;
          }
          
          let docs = 0;
          if (docIndex !== -1 && row[docIndex] !== undefined && row[docIndex] !== null && row[docIndex] !== '-') {
            docs = parseFloat(row[docIndex]) || 0;
          }
          if (docs === 0 && ticketMap[co] > 0) {
            docs = valor / ticketMap[co];
          }
          
          let hourVal = '';
          if (horaIndex !== -1) {
            const rawHour = row[horaIndex];
            if (rawHour !== undefined && rawHour !== null && rawHour !== '-') {
              const numericHour = parseInt(rawHour, 10);
              if (!isNaN(numericHour) && numericHour > 0) {
                hourVal = String(numericHour);
              }
            }
          }
          
          if (co && fechaVal) {
            const dateStr = parseExcelDate(fechaVal);
            if (dateStr && dateStr.length === 10) {
              if (!salesDetailData[co]) {
                salesDetailData[co] = {};
              }
              if (!salesDetailData[co][dateStr]) {
                salesDetailData[co][dateStr] = { sales: 0, transactions: 0, day_of_week: dia, hours: {} };
              }
              
              salesDetailData[co][dateStr].sales += valor;
              salesDetailData[co][dateStr].transactions += docs;
              
              if (hourVal) {
                if (!salesDetailData[co][dateStr].hours[hourVal]) {
                  salesDetailData[co][dateStr].hours[hourVal] = { sales: 0, transactions: 0 };
                }
                salesDetailData[co][dateStr].hours[hourVal].sales += valor;
                salesDetailData[co][dateStr].hours[hourVal].transactions += docs;
              }
            }
          }
        }
      }
    }
  }

  return {
    defaultConfig,
    pdvData,
    salesDetailData
  };
}

// Parse Excel Dates robustly
function parseExcelDate(val) {
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number') {
    // Convert Excel serial number to JS Date
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() + userTimezoneOffset);
    const y = localDate.getFullYear();
    const m = String(localDate.getMonth() + 1).padStart(2, '0');
    const d = String(localDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'string') {
    const cleaned = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
      return cleaned.substring(0, 10);
    }
    const match = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (match) {
      const d = match[1].padStart(2, '0');
      const m = match[2].padStart(2, '0');
      const y = match[3];
      return `${y}-${m}-${d}`;
    }
  }
  return '';
}

// Fetch and Sync Google Sheets Published URL (CSV)
async function saveAndFetchSheetsUrl() {
  const urlInput = document.getElementById('sheets-url');
  const url = urlInput.value.trim();

  if (!url) {
    setAppStatus("Por favor ingresa una URL válida", "danger");
    return;
  }

  setAppStatus("Sincronizando con Google Drive...", "info");

  try {
    // We fetch the published CSV from Google Sheets
    // Note: Due to CORS, sometimes fetching directly from browser might trigger warnings. 
    // Google Sheets published URLs are usually CORS-enabled, so direct fetch works perfectly!
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Error en respuesta de Google Sheets: " + response.statusText);
    }
    
    const csvText = await response.text();
    
    // Parse CSV using SheetJS
    const workbook = XLSX.read(csvText, { type: 'string' });
    
    // When Google Sheets publishes a single sheet as CSV, the workbook has one sheet named 'Sheet1'
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (json.length < 2) {
      throw new Error("El archivo CSV no contiene suficientes filas.");
    }
    
    // Map headers and rows
    const headers = json[0].map(h => String(h || '').trim());
    const pdvData = [];
    
    for (let r = 1; r < json.length; r++) {
      const row = json[r];
      if (!row || row.length === 0 || !row.some(cell => cell !== null && cell !== undefined)) {
        continue;
      }
      
      const rowObj = {};
      headers.forEach((h, index) => {
        let val = row[index];
        if (val === undefined || val === null) {
          val = 0;
        }
        
        // Parse numbers
        if (typeof val === 'string') {
          val = val.trim();
          if (!isNaN(val) && val !== '') {
            val = Number(val);
          }
        }
        rowObj[h] = val;
      });
      pdvData.push(rowObj);
    }

    // Since a published CSV represents only 'Hoja2' (we publish only sheet 2 as CSV),
    // we keep the default defaultConfig.
    appData = {
      defaultConfig: {
        ceco: "v204",
        anfitriones_evaluar: 2.0,
        promedio_utilidad_neta: 0.1012,
        horas_semana: {
          Lunes: 14, Martes: 14, Miércoles: 14, Jueves: 14, Viernes: 14, Sábado: 14, Domingo: 14
        }
      },
      pdvData: pdvData
    };

    // Save URL and data in localStorage
    localStorage.setItem('drive_dashboard_data', JSON.stringify(appData));
    localStorage.setItem('drive_dashboard_sheets_url', url);
    
    setAppStatus("Google Sheets Sincronizado", "success");
    initSelectorsAndSliders();
    
    setTimeout(() => switchTab('calculator'), 1000);

  } catch (err) {
    console.error("Error fetching Google Sheets CSV", err);
    setAppStatus("Error de sincronización. Verifica el enlace y que esté publicado.", "danger");
  }
}

// Reset to initial pre-generated JSON data
async function loadDefaultConfigData() {
  localStorage.removeItem('drive_dashboard_data');
  localStorage.removeItem('drive_dashboard_sheets_url');
  document.getElementById('sheets-url').value = '';
  document.getElementById('file-info').style.display = 'none';
  
  await loadSavedDataOrDefaults();
  switchTab('calculator');
}

// ----------------- PROMEDIO VENTAS TAB LOGIC -----------------

// Helper to get active period info (Year, Month, Month Name, total days) for selected CECO
function getActivePeriodInfo(ceco) {
  const cecoData = appData.salesDetailData ? appData.salesDetailData[ceco] : null;
  let dates = [];
  if (cecoData) {
    dates = Object.keys(cecoData).sort();
  }
  
  if (dates.length === 0 && appData.salesDetailData) {
    for (const k in appData.salesDetailData) {
      const cDates = Object.keys(appData.salesDetailData[k]);
      if (cDates.length > 0) {
        dates = cDates.sort();
        break;
      }
    }
  }
  
  if (dates.length === 0) {
    return { year: 2026, month: 7, monthName: "Julio", totalDays: 31, dates: [] };
  }
  
  const firstDate = dates[0];
  const parts = firstDate.split('-');
  const year = parseInt(parts[0], 10) || 2026;
  const month = parseInt(parts[1], 10) || 7;
  
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const monthName = monthNames[month - 1] || "Julio";
  const totalDays = new Date(year, month, 0).getDate();
  
  return { year, month, monthName, totalDays, dates };
}

// Ensure selected dates match current active period
function ensureSelectedDates(ceco) {
  const period = getActivePeriodInfo(ceco);
  const prefix = `${period.year}-${period.month.toString().padStart(2, '0')}`;
  const validForCurrentPeriod = currentState.selectedDates.some(d => d.startsWith(prefix));
  
  if (!validForCurrentPeriod || currentState.selectedDates.length === 0) {
    currentState.selectedDates = [];
    for (let day = 1; day <= period.totalDays; day++) {
      currentState.selectedDates.push(`${prefix}-${day.toString().padStart(2, '0')}`);
    }
  }
}

// Update Sales Average Screen
function updateSalesAverageTab() {
  const pdv = currentState.selectedPdv;
  if (!pdv) return;

  const ceco = pdv['CECO'];
  const hasDetailData = appData.salesDetailData && appData.salesDetailData[ceco];

  if (hasDetailData) {
    document.getElementById('calendar-card').style.display = 'block';
    document.getElementById('hour-card').style.display = 'block';
    document.getElementById('sales-average-results-card').style.display = 'block';
    document.getElementById('sales-average-no-data-card').style.display = 'none';
    
    ensureSelectedDates(ceco);
    renderCalendar();
    renderHoursGrid();
    calculateSalesAverage();
  } else {
    document.getElementById('calendar-card').style.display = 'none';
    document.getElementById('hour-card').style.display = 'none';
    document.getElementById('sales-average-results-card').style.display = 'none';
    document.getElementById('sales-average-no-data-card').style.display = 'block';
  }
}

// Render Calendar Grid dynamically based on active month
function renderCalendar() {
  const container = document.getElementById('calendar-days-grid');
  if (!container) return;
  container.innerHTML = '';

  const pdv = currentState.selectedPdv;
  const ceco = pdv ? pdv['CECO'] : '';
  const cecoData = appData.salesDetailData ? appData.salesDetailData[ceco] : null;
  const period = getActivePeriodInfo(ceco);

  const titleEl = document.getElementById('calendar-card-title');
  if (titleEl) {
    titleEl.innerText = `Seleccionar Días (${period.monthName} ${period.year})`;
  }

  const prefix = `${period.year}-${period.month.toString().padStart(2, '0')}`;

  for (let day = 1; day <= period.totalDays; day++) {
    const dateStr = `${prefix}-${day.toString().padStart(2, '0')}`;
    const dayBtn = document.createElement('div');
    dayBtn.className = 'calendar-day';
    dayBtn.innerText = day;
    dayBtn.id = `cal-day-${day}`;

    const hasData = cecoData && cecoData[dateStr];

    if (!hasData) {
      dayBtn.classList.add('no-data');
    }

    if (currentState.selectedDates.includes(dateStr)) {
      dayBtn.classList.add('selected');
    }

    dayBtn.onclick = () => {
      toggleCalendarDay(day, dateStr, hasData);
    };

    container.appendChild(dayBtn);
  }
}

// Toggle selection of a specific day
function toggleCalendarDay(day, dateStr, hasData) {
  const index = currentState.selectedDates.indexOf(dateStr);
  if (index > -1) {
    currentState.selectedDates.splice(index, 1);
  } else {
    currentState.selectedDates.push(dateStr);
  }
  renderCalendar();
  renderHoursGrid();
  calculateSalesAverage();
}

// Quick Select Days presets
function selectDaysPreset(preset) {
  const pdv = currentState.selectedPdv;
  const ceco = pdv ? pdv['CECO'] : '';
  const period = getActivePeriodInfo(ceco);
  const prefix = `${period.year}-${period.month.toString().padStart(2, '0')}`;

  currentState.selectedDates = [];
  
  for (let day = 1; day <= period.totalDays; day++) {
    const dateStr = `${prefix}-${day.toString().padStart(2, '0')}`;
    const date = new Date(period.year, period.month - 1, day);
    const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday

    if (preset === 'all') {
      currentState.selectedDates.push(dateStr);
    } else if (preset === 'weekdays') {
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        currentState.selectedDates.push(dateStr);
      }
    } else if (preset === 'weekends') {
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        currentState.selectedDates.push(dateStr);
      }
    }
  }

  renderCalendar();
  renderHoursGrid();
  calculateSalesAverage();
}


// Toggle dropdown visibility
function toggleHoursDropdown(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('hours-dropdown-options');
  const trigger = document.getElementById('hours-dropdown-trigger');
  if (dropdown && trigger) {
    const show = dropdown.classList.contains('show');
    if (show) {
      dropdown.classList.remove('show');
      trigger.classList.remove('active');
    } else {
      dropdown.classList.add('show');
      trigger.classList.add('active');
    }
  }
}

// Update trigger label text based on selections (displays all selected hours)
function updateHoursDropdownLabel() {
  const labelEl = document.getElementById('hours-dropdown-value');
  if (!labelEl) return;
  
  const count = currentState.selectedHours.length;
  if (count === 0) {
    labelEl.innerText = "Ninguna hora seleccionada";
  } else {
    const sortedHours = [...currentState.selectedHours].map(Number).sort((a,b)=>a-b);
    const hourLabels = sortedHours.map(h => {
      let displayLabel = h <= 12 ? `${h}:00` : `${h - 12}:00`;
      let ampm = h < 12 ? 'am' : (h === 12 ? 'pm' : (h === 24 ? 'am' : 'pm'));
      return `${displayLabel}${ampm}`;
    });
    labelEl.innerText = hourLabels.join(', ');
  }
}


// Global click event to close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('hours-dropdown-options');
  const trigger = document.getElementById('hours-dropdown-trigger');
  if (dropdown && trigger && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
    dropdown.classList.remove('show');
    trigger.classList.remove('active');
  }
});

// Render Hours Checkboxes inside Dropdown
function renderHoursGrid() {
  const container = document.getElementById('hours-dropdown-options');
  if (!container) return;
  container.innerHTML = '';

  const pdv = currentState.selectedPdv;
  const ceco = pdv ? pdv['CECO'] : '';
  const cecoData = appData.salesDetailData ? appData.salesDetailData[ceco] : null;

  for (let h = 8; h <= 24; h++) {
    const hourStr = String(h);
    
    // Create option label container
    const option = document.createElement('label');
    option.className = 'multiselect-option';
    
    // Checkbox input
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = hourStr;
    checkbox.checked = currentState.selectedHours.includes(hourStr);
    
    // Check if we have data for this hour in the selected dates
    let hasData = false;
    if (cecoData) {
      hasData = currentState.selectedDates.some(dateStr => {
        return cecoData[dateStr] && cecoData[dateStr].hours && cecoData[dateStr].hours[hourStr];
      });
    }

    if (!hasData) {
      option.classList.add('no-data');
    }

    // Label span
    const labelSpan = document.createElement('span');
    let displayLabel = h <= 12 ? `${h}:00` : `${h - 12}:00`;
    let ampm = h < 12 ? 'am' : (h === 12 ? 'pm' : (h === 24 ? 'am' : 'pm'));
    labelSpan.innerText = `${displayLabel}${ampm}${hasData ? '' : ' (sin datos)'}`;

    // Handle checkbox changes
    checkbox.onchange = (e) => {
      e.stopPropagation();
      const isChecked = checkbox.checked;
      const index = currentState.selectedHours.indexOf(hourStr);
      if (isChecked && index === -1) {
        currentState.selectedHours.push(hourStr);
      } else if (!isChecked && index > -1) {
        currentState.selectedHours.splice(index, 1);
      }
      updateHoursDropdownLabel();
      calculateSalesAverage();
    };

    option.appendChild(checkbox);
    option.appendChild(labelSpan);
    container.appendChild(option);
  }
  
  updateHoursDropdownLabel();
}

// Quick Select Hours presets
function selectHoursPreset(preset) {
  currentState.selectedHours = [];
  if (preset === 'all') {
    for (let h = 8; h <= 24; h++) {
      currentState.selectedHours.push(String(h));
    }
  } else if (preset === 'lunch') {
    currentState.selectedHours = ["12", "13", "14"];
  } else if (preset === 'dinner') {
    currentState.selectedHours = ["19", "20", "21", "22"];
  } else if (preset === 'none') {
    currentState.selectedHours = [];
  }
  
  renderHoursGrid();
  calculateSalesAverage();
}

// Calculate Accumulates and Averages based on selected days and selected hours
function calculateSalesAverage() {
  const pdv = currentState.selectedPdv;
  if (!pdv) return;

  const ceco = pdv['CECO'];
  const cecoData = appData.salesDetailData ? appData.salesDetailData[ceco] : null;

  let totalSales = 0;
  let totalTransactions = 0;
  let selectedDaysCount = 0;

  if (cecoData) {
    currentState.selectedDates.forEach(dateStr => {
      const dayData = cecoData[dateStr];
      if (dayData && dayData.hours) {
        let daySales = 0;
        let dayTransactions = 0;
        let dayHasDataForSelectedHours = false;

        currentState.selectedHours.forEach(hourStr => {
          const hourData = dayData.hours[hourStr];
          if (hourData) {
            daySales += hourData.sales || 0;
            dayTransactions += hourData.transactions || 0;
            dayHasDataForSelectedHours = true;
          }
        });

        if (dayHasDataForSelectedHours) {
          totalSales += daySales;
          totalTransactions += dayTransactions;
          selectedDaysCount++;
        }
      }
    });
  }

  const averageDailySales = selectedDaysCount > 0 ? (totalSales / selectedDaysCount) : 0;
  const averageTicket = totalTransactions > 0 ? (totalSales / totalTransactions) : 0;

  // Update DOM Elements
  const elDias = document.getElementById('avg-result-dias-seleccionados');
  if (elDias) elDias.innerText = selectedDaysCount;
  const elVentaTotal = document.getElementById('avg-result-venta-total');
  if (elVentaTotal) elVentaTotal.innerText = formatCurrency(totalSales);
  const elVentaDiaria = document.getElementById('avg-result-venta-diaria');
  if (elVentaDiaria) elVentaDiaria.innerText = formatCurrency(averageDailySales);
  const elTrans = document.getElementById('avg-result-transacciones');
  if (elTrans) elTrans.innerText = formatNumber(totalTransactions, 0);
  const elTicket = document.getElementById('avg-result-ticket-promedio');
  if (elTicket) elTicket.innerText = formatCurrency(averageTicket);
}
