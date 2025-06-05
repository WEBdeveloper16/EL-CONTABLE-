// Clase principal de la aplicación
class AjusteDeCuentas {
    constructor() {
        this.db = null;
        this.currentReport = null;
        this.currentReportData = null;
        this.initDB();
        this.initEventListeners();
    }

    // 1. Inicialización de la base de datos
    initDB() {
        const request = indexedDB.open('AjusteDeCuentasDB', 3);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const oldVersion = event.oldVersion;
            
            // Versión 1: Estructura básica
            if (oldVersion < 1) {
                // Configuración de empresa
                db.createObjectStore('companyConfig', { keyPath: 'id' });
                
                // Plan de cuentas
                const accountsStore = db.createObjectStore('chartOfAccounts', { keyPath: 'code' });
                accountsStore.createIndex('parentCode', 'parentCode', { unique: false });
                
                // Asientos contables
                const entriesStore = db.createObjectStore('accountingEntries', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                entriesStore.createIndex('date', 'date', { unique: false });
                
                // Líneas de asiento
                const linesStore = db.createObjectStore('entryLines', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                linesStore.createIndex('entryId', 'entryId', { unique: false });
                linesStore.createIndex('accountCode', 'accountCode', { unique: false });
            }
            
            // Versión 2: Mejoras en índices
            if (oldVersion < 2) {
                const entriesStore = event.currentTarget.transaction.objectStore('accountingEntries');
                entriesStore.createIndex('concept', 'concept', { unique: false });
                
                const accountsStore = event.currentTarget.transaction.objectStore('chartOfAccounts');
                accountsStore.createIndex('accountType', 'accountType', { unique: false });
            }
            
            // Versión 3: Histórico de cambios
            if (oldVersion < 3) {
                db.createObjectStore('auditLog', {
                    keyPath: 'id',
                    autoIncrement: true
                }).createIndex('timestamp', 'timestamp', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            this.db = event.target.result;
            this.checkInitialData();
            this.loadCompanyConfig();
            this.updateDashboard();
        };

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            alert('Error al inicializar la base de datos');
        };
    }

    // 2. Verificación e inicialización de datos
    checkInitialData() {
        const transaction = this.db.transaction(['chartOfAccounts'], 'readonly');
        const store = transaction.objectStore('chartOfAccounts');
        const countRequest = store.count();
        
        countRequest.onsuccess = (event) => {
            if (event.target.result === 0) {
                this.loadChartOfAccounts();
            }
        };
    }

    loadChartOfAccounts() {
        const pgcAccounts = [
            // Grupo 1 - Financiación básica
            { code: '1', name: 'FINANCIACIÓN BÁSICA', parentCode: '', accountType: 'patrimonio', editable: false },
            { code: '10', name: 'CAPITAL', parentCode: '1', accountType: 'patrimonio', editable: false },
            { code: '100', name: 'Capital social', parentCode: '10', accountType: 'patrimonio', editable: false },
            
            // Grupo 2 - Inmovilizado
            { code: '2', name: 'INMOVILIZADO', parentCode: '', accountType: 'activo', editable: false },
            { code: '21', name: 'Inmovilizado material', parentCode: '2', accountType: 'activo', editable: false },
            { code: '210', name: 'Terrenos y bienes naturales', parentCode: '21', accountType: 'activo', editable: false },
            
            // Grupo 3 - Existencias
            { code: '3', name: 'EXISTENCIAS', parentCode: '', accountType: 'activo', editable: false },
            { code: '300', name: 'Mercaderías', parentCode: '3', accountType: 'activo', editable: false },
            
            // Grupo 4 - Acreedores y deudores
            { code: '4', name: 'ACREEDORES Y DEUDORES', parentCode: '', accountType: 'pasivo', editable: false },
            { code: '430', name: 'Clientes', parentCode: '4', accountType: 'activo', editable: false },
            { code: '400', name: 'Proveedores', parentCode: '4', accountType: 'pasivo', editable: false },
            
            // Grupo 5 - Cuentas financieras
            { code: '5', name: 'CUENTAS FINANCIERAS', parentCode: '', accountType: 'activo', editable: false },
            { code: '570', name: 'Caja', parentCode: '5', accountType: 'activo', editable: false },
            { code: '571', name: 'Bancos', parentCode: '5', accountType: 'activo', editable: false },
            
            // Grupo 6 - Compras y gastos
            { code: '6', name: 'COMPRAS Y GASTOS', parentCode: '', accountType: 'gasto', editable: false },
            { code: '600', name: 'Compras de mercaderías', parentCode: '6', accountType: 'gasto', editable: false },
            { code: '621', name: 'Arrendamientos y cánones', parentCode: '6', accountType: 'gasto', editable: false },
            
            // Grupo 7 - Ventas e ingresos
            { code: '7', name: 'VENTAS E INGRESOS', parentCode: '', accountType: 'ingreso', editable: false },
            { code: '700', name: 'Ventas de mercaderías', parentCode: '7', accountType: 'ingreso', editable: false }
        ];

        const transaction = this.db.transaction(['chartOfAccounts'], 'readwrite');
        const store = transaction.objectStore('chartOfAccounts');
        
        pgcAccounts.forEach(account => {
            store.add(account);
        });
        
        transaction.oncomplete = () => {
            this.renderAccountsList();
            this.populateAccountSelects();
            this.logAudit('Plan de cuentas inicial cargado');
        };
    }

    // 3. Configuración de la empresa
    loadCompanyConfig() {
        const transaction = this.db.transaction(['companyConfig'], 'readonly');
        const store = transaction.objectStore('companyConfig');
        const request = store.get(1);
        
        request.onsuccess = (event) => {
            const config = event.target.result;
            
            if (config) {
                document.getElementById('company-name').textContent = config.name || 'Ajuste de Cuentas';
                
                const companyInfo = [
                    config.phone ? `Tel: ${config.phone}` : '',
                    config.email ? `Email: ${config.email}` : ''
                ].filter(Boolean).join(' | ');
                
                document.getElementById('company-info').textContent = companyInfo;
                
                if (config.logo) {
                    document.getElementById('company-logo').src = config.logo;
                }
                
                // Rellenar formulario
                document.getElementById('company-name-input').value = config.name || '';
                document.getElementById('company-phone').value = config.phone || '';
                document.getElementById('company-email').value = config.email || '';
                document.getElementById('company-address').value = config.address || '';
                document.getElementById('company-nif').value = config.nif || '';
            }
        };
    }

    saveCompanyConfig(event) {
        event.preventDefault();
        
        const config = {
            id: 1,
            name: document.getElementById('company-name-input').value,
            phone: document.getElementById('company-phone').value,
            email: document.getElementById('company-email').value,
            address: document.getElementById('company-address').value,
            nif: document.getElementById('company-nif').value
        };
        
        const logoFile = document.getElementById('company-logo').files[0];
        
        if (logoFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                config.logo = e.target.result;
                this.finalizeSaveConfig(config);
            };
            reader.readAsDataURL(logoFile);
        } else {
            this.finalizeSaveConfig(config);
        }
    }
    
    finalizeSaveConfig(config) {
        const transaction = this.db.transaction(['companyConfig'], 'readwrite');
        const store = transaction.objectStore('companyConfig');
        const request = store.put(config);
        
        request.onsuccess = () => {
            this.loadCompanyConfig();
            this.closeModal();
            this.logAudit('Configuración de empresa actualizada');
            alert('Configuración guardada correctamente');
        };
    }

    // 4. Gestión de asientos contables
    saveAccountingEntry(event) {
        event.preventDefault();
        
        const date = document.getElementById('entry-date').value;
        const concept = document.getElementById('entry-concept').value;
        const lines = document.querySelectorAll('.entry-line');
        
        if (!date || !concept || lines.length === 0) {
            alert('Complete todos los campos obligatorios');
            return;
        }
        
        // Validar asiento
        let totalDebit = 0;
        let totalCredit = 0;
        const entryLines = [];
        
        for (const line of lines) {
            const accountCode = line.querySelector('.account-select').value;
            const debit = parseFloat(line.querySelector('.debit').value) || 0;
            const credit = parseFloat(line.querySelector('.credit').value) || 0;
            
            if (!accountCode || (debit === 0 && credit === 0)) {
                alert('Complete todas las líneas correctamente');
                return;
            }
            
            if (debit > 0 && credit > 0) {
                alert('Una línea no puede tener debe y haber simultáneamente');
                return;
            }
            
            totalDebit += debit;
            totalCredit += credit;
            entryLines.push({ accountCode, debit, credit });
        }
        
        if (totalDebit.toFixed(2) !== totalCredit.toFixed(2)) {
            alert(`Asiento descuadrado. Debe: ${totalDebit.toFixed(2)} XFA ≠ Haber: ${totalCredit.toFixed(2)} XFA`);
            return;
        }
        
        // Guardar en IndexedDB
        const transaction = this.db.transaction(['accountingEntries', 'entryLines', 'auditLog'], 'readwrite');
        const entriesStore = transaction.objectStore('accountingEntries');
        const linesStore = transaction.objectStore('entryLines');
        const auditStore = transaction.objectStore('auditLog');
        
        const entry = { date, concept, totalDebit, totalCredit };
        const entryRequest = entriesStore.add(entry);
        
        entryRequest.onsuccess = (event) => {
            const entryId = event.target.result;
            let linesSaved = 0;
            
            for (const line of entryLines) {
                const lineRequest = linesStore.add({ ...line, entryId });
                
                lineRequest.onsuccess = () => {
                    if (++linesSaved === entryLines.length) {
                        // Registrar en auditoría
                        auditStore.add({
                            action: 'create_entry',
                            entryId,
                            timestamp: new Date(),
                            details: `Asiento #${entryId}: ${concept}`
                        });
                        
                        // Resetear formulario
                        document.getElementById('accounting-entry-form').reset();
                        const linesContainer = document.querySelector('.entry-lines');
                        linesContainer.innerHTML = '';
                        this.addAccountingLine();
                        
                        // Actualizar vistas
                        this.loadAccountingEntries();
                        this.updateDashboard();
                        
                        alert('Asiento guardado correctamente');
                    }
                };
            }
        };
    }

    loadAccountingEntries(filter = {}) {
        const transaction = this.db.transaction(['accountingEntries'], 'readonly');
        const store = transaction.objectStore('accountingEntries');
        let request;
        
        if (filter.fromDate || filter.toDate) {
            const index = store.index('date');
            request = index.getAll(IDBKeyRange.bound(
                filter.fromDate || '0000-00-00',
                filter.toDate || '9999-99-99'
            ));
        } else {
            request = store.getAll();
        }
        
        request.onsuccess = (event) => {
            let entries = event.target.result;
            
            // Filtrar por concepto si es necesario
            if (filter.concept) {
                const term = filter.concept.toLowerCase();
                entries = entries.filter(e => e.concept.toLowerCase().includes(term));
            }
            
            // Ordenar por fecha (más reciente primero)
            entries.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Renderizar en tabla
            const tbody = document.querySelector('#entries-table tbody');
            tbody.innerHTML = '';
            
            entries.forEach(entry => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(entry.date).toLocaleDateString()}</td>
                    <td>${entry.id}</td>
                    <td>${entry.concept}</td>
                    <td class="text-right">${entry.totalDebit.toFixed(2)}</td>
                    <td class="text-right">${entry.totalCredit.toFixed(2)}</td>
                    <td>
                        <button class="btn-view-entry" data-id="${entry.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-delete-entry" data-id="${entry.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            
            // Agregar event listeners
            document.querySelectorAll('.btn-view-entry').forEach(btn => {
                btn.addEventListener('click', () => 
                    this.viewEntryDetails(parseInt(btn.dataset.id)));
            });
            
            document.querySelectorAll('.btn-delete-entry').forEach(btn => {
                btn.addEventListener('click', () => 
                    this.deleteEntry(parseInt(btn.dataset.id)));
            });
        };
    }

    viewEntryDetails(entryId) {
        const transaction = this.db.transaction(['accountingEntries', 'entryLines', 'chartOfAccounts'], 'readonly');
        const entriesStore = transaction.objectStore('accountingEntries');
        const linesStore = transaction.objectStore('entryLines');
        const accountsStore = transaction.objectStore('chartOfAccounts');
        
        entriesStore.get(entryId).onsuccess = (event) => {
            const entry = event.target.result;
            
            linesStore.index('entryId').getAll(entryId).onsuccess = (linesEvent) => {
                const lines = linesEvent.target.result;
                const accountRequests = [];
                
                lines.forEach(line => {
                    accountRequests.push(new Promise(resolve => {
                        accountsStore.get(line.accountCode).onsuccess = (accountEvent) => {
                            resolve({
                                ...line,
                                accountName: accountEvent.target.result?.name || 'Cuenta desconocida'
                            });
                        };
                    }));
                });
                
                Promise.all(accountRequests).then(completeLines => {
                    // Renderizar detalles
                    let linesHtml = '';
                    completeLines.forEach(line => {
                        linesHtml += `
                            <tr>
                                <td>${line.accountCode}</td>
                                <td>${line.accountName}</td>
                                <td class="text-right">${line.debit.toFixed(2)}</td>
                                <td class="text-right">${line.credit.toFixed(2)}</td>
                            </tr>
                        `;
                    });
                    
                    const html = `
                        <h3>Asiento #${entry.id}</h3>
                        <p><strong>Fecha:</strong> ${new Date(entry.date).toLocaleDateString()}</p>
                        <p><strong>Concepto:</strong> ${entry.concept}</p>
                        <table class="entry-details-table">
                            <thead>
                                <tr>
                                    <th>Cuenta</th>
                                    <th>Descripción</th>
                                    <th>Debe (XFA)</th>
                                    <th>Haber (XFA)</th>
                                </tr>
                            </thead>
                            <tbody>${linesHtml}</tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="2">Total</td>
                                    <td class="text-right">${entry.totalDebit.toFixed(2)}</td>
                                    <td class="text-right">${entry.totalCredit.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    `;
                    
                    document.getElementById('report-preview').innerHTML = html;
                    this.currentReport = 'entry_details';
                    this.currentReportData = { entry, lines: completeLines };
                    
                    // Mostrar botones de exportación
                    document.querySelector('.report-actions').style.display = 'flex';
                });
            };
        };
    }

    deleteEntry(entryId) {
        if (!confirm('¿Eliminar este asiento permanentemente?')) return;
        
        const transaction = this.db.transaction(
            ['accountingEntries', 'entryLines', 'auditLog'], 
            'readwrite'
        );
        
        const entriesStore = transaction.objectStore('accountingEntries');
        const linesStore = transaction.objectStore('entryLines');
        const auditStore = transaction.objectStore('auditLog');
        
        // Primero obtener el concepto para el log
        entriesStore.get(entryId).onsuccess = (event) => {
            const entry = event.target.result;
            
            // Eliminar líneas primero
            const linesRequest = linesStore.index('entryId').openCursor(entryId);
            
            linesRequest.onsuccess = (linesEvent) => {
                const cursor = linesEvent.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    // Luego eliminar el asiento
                    entriesStore.delete(entryId);
                    
                    // Registrar en auditoría
                    auditStore.add({
                        action: 'delete_entry',
                        entryId,
                        timestamp: new Date(),
                        details: `Eliminado asiento #${entryId}: ${entry.concept}`
                    });
                    
                    // Actualizar interfaz
                    transaction.oncomplete = () => {
                        this.loadAccountingEntries();
                        this.updateDashboard();
                        alert('Asiento eliminado correctamente');
                    };
                }
            };
        };
    }

    // 5. Reportes y análisis
    generateReport(reportType) {
        this.currentReport = reportType;
        
        switch (reportType) {
            case 'balance-general':
                this.generateBalanceGeneral();
                break;
            case 'estado-resultados':
                this.generateEstadoResultados();
                break;
            case 'mayor':
                this.generateLibroMayor();
                break;
            case 'diario':
                this.generateLibroDiario();
                break;
        }
    }

    generateBalanceGeneral() {
        const transaction = this.db.transaction(['entryLines', 'chartOfAccounts'], 'readonly');
        const linesStore = transaction.objectStore('entryLines');
        const accountsStore = transaction.objectStore('chartOfAccounts');
        
        // Obtener cuentas por tipo
        const activoPromise = this.getAccountsByType('activo');
        const pasivoPromise = this.getAccountsByType('pasivo');
        const patrimonioPromise = this.getAccountsByType('patrimonio');
        
        Promise.all([activoPromise, pasivoPromise, patrimonioPromise]).then(results => {
            const [activoAccounts, pasivoAccounts, patrimonioAccounts] = results;
            
            // Calcular saldos
            const activoPromise = this.calculateBalances(activoAccounts);
            const pasivoPromise = this.calculateBalances(pasivoAccounts);
            const patrimonioPromise = this.calculateBalances(patrimonioAccounts);
            
            Promise.all([activoPromise, pasivoPromise, patrimonioPromise]).then(balances => {
                const [activoBalances, pasivoBalances, patrimonioBalances] = balances;
                
                // Filtrar cuentas con saldo
                const activoWithBalance = activoBalances.filter(a => a.balance !== 0);
                const pasivoWithBalance = pasivoBalances.filter(a => a.balance !== 0);
                const patrimonioWithBalance = patrimonioBalances.filter(a => a.balance !== 0);
                
                // Calcular totales
                const activoTotal = activoWithBalance.reduce((sum, a) => sum + a.balance, 0);
                const pasivoTotal = pasivoWithBalance.reduce((sum, a) => sum + a.balance, 0);
                const patrimonioTotal = patrimonioWithBalance.reduce((sum, a) => sum + a.balance, 0);
                
                // Renderizar reporte
                let html = `
                    <h3>Balance General</h3>
                    <p>Fecha: ${new Date().toLocaleDateString()}</p>
                    
                    <div class="report-section">
                        <h4>ACTIVO</h4>
                        ${this.renderBalanceSection(activoWithBalance, activoTotal)}
                    </div>
                    
                    <div class="report-section">
                        <h4>PASIVO</h4>
                        ${this.renderBalanceSection(pasivoWithBalance, pasivoTotal)}
                    </div>
                    
                    <div class="report-section">
                        <h4>PATRIMONIO NETO</h4>
                        ${this.renderBalanceSection(patrimonioWithBalance, patrimonioTotal)}
                    </div>
                    
                    <div class="report-total">
                        <p>Total Activo: ${activoTotal.toFixed(2)} XFA</p>
                        <p>Total Pasivo + Patrimonio: ${(pasivoTotal + patrimonioTotal).toFixed(2)} XFA</p>
                    </div>
                `;
                
                document.getElementById('report-preview').innerHTML = html;
                this.currentReportData = {
                    activo: activoWithBalance,
                    pasivo: pasivoWithBalance,
                    patrimonio: patrimonioWithBalance,
                    activoTotal,
                    pasivoTotal,
                    patrimonioTotal
                };
                
                document.querySelector('.report-actions').style.display = 'flex';
            });
        });
    }

    renderBalanceSection(accounts, total) {
        let rows = '';
        accounts.forEach(account => {
            rows += `
                <tr>
                    <td>${account.code}</td>
                    <td>${account.name}</td>
                    <td class="text-right ${account.balance >= 0 ? 'positive' : 'negative'}">
                        ${Math.abs(account.balance).toFixed(2)}
                    </td>
                </tr>
            `;
        });
        
        return `
            <table>
                <thead>
                    <tr>
                        <th>Cuenta</th>
                        <th>Descripción</th>
                        <th>Saldo (XFA)</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="2">Total</td>
                        <td class="text-right">${total.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
        `;
    }

    // 6. Exportación de reportes
    exportCurrentReportToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Cabecera con logo y datos de empresa
        const logo = document.getElementById('company-logo').src;
        const companyName = document.getElementById('company-name').textContent;
        const companyInfo = document.getElementById('company-info').textContent;
        
        if (logo) {
            doc.addImage(logo, 'PNG', 10, 10, 30, 30);
        }
        
        doc.setFontSize(16);
        doc.text(companyName, logo ? 50 : 10, 20);
        doc.setFontSize(10);
        doc.text(companyInfo, logo ? 50 : 10, 27);
        
        // Contenido específico del reporte
        switch (this.currentReport) {
            case 'entry_details':
                this.exportEntryToPDF(doc);
                break;
            case 'balance-general':
                this.exportBalanceToPDF(doc);
                break;
            case 'estado-resultados':
                this.exportIncomeStatementToPDF(doc);
                break;
        }
        
        // Pie de página
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(`Página ${i} de ${pageCount}`, 190, 285, null, null, 'right');
            doc.text(`Generado el ${new Date().toLocaleDateString()}`, 10, 285);
        }
        
        // Guardar PDF
        const fileName = this.getReportFileName();
        doc.save(fileName);
    }

    exportEntryToPDF(doc) {
        const { entry, lines } = this.currentReportData;
        
        doc.setFontSize(14);
        doc.text(`Asiento Contable #${entry.id}`, 10, 40);
        doc.setFontSize(10);
        doc.text(`Fecha: ${new Date(entry.date).toLocaleDateString()}`, 10, 50);
        doc.text(`Concepto: ${entry.concept}`, 10, 55);
        
        // Tabla de líneas
        const headers = [['Cuenta', 'Descripción', 'Debe', 'Haber']];
        const data = lines.map(line => [
            line.accountCode,
            line.accountName,
            line.debit.toFixed(2),
            line.credit.toFixed(2)
        ]);
        
        // Total
        data.push(['', 'TOTAL', entry.totalDebit.toFixed(2), entry.totalCredit.toFixed(2)]);
        
        doc.autoTable({
            startY: 65,
            head: headers,
            body: data,
            headStyles: { fillColor: [52, 152, 219] },
            columnStyles: { 
                2: { halign: 'right' },
                3: { halign: 'right' }
            }
        });
    }

    getReportFileName() {
        const prefix = {
            'entry_details': 'Asiento',
            'balance-general': 'Balance_General',
            'estado-resultados': 'Estado_Resultados'
        }[this.currentReport] || 'Reporte';
        
        return `${prefix}_${new Date().toISOString().slice(0,10)}.pdf`;
    }

    // 7. Dashboard y utilidades
    updateDashboard() {
        this.calculateBalanceSummary();
        this.calculateIncomeSummary();
        this.loadRecentEntries();
    }

    calculateBalanceSummary() {
        const transaction = this.db.transaction(['entryLines', 'chartOfAccounts'], 'readonly');
        const linesStore = transaction.objectStore('entryLines');
        const accountsStore = transaction.objectStore('chartOfAccounts');
        
        // Obtener cuentas por tipo
        const activoPromise = this.getAccountsByType('activo');
        const pasivoPromise = this.getAccountsByType('pasivo');
        const patrimonioPromise = this.getAccountsByType('patrimonio');
        
        Promise.all([activoPromise, pasivoPromise, patrimonioPromise]).then(results => {
            const [activoAccounts, pasivoAccounts, patrimonioAccounts] = results;
            
            // Calcular saldos
            const activoPromise = this.calculateBalances(activoAccounts);
            const pasivoPromise = this.calculateBalances(pasivoAccounts);
            const patrimonioPromise = this.calculateBalances(patrimonioAccounts);
            
            Promise.all([activoPromise, pasivoPromise, patrimonioPromise]).then(balances => {
                const [activoBalances, pasivoBalances, patrimonioBalances] = balances;
                
                const activoTotal = activoBalances.reduce((sum, a) => sum + a.balance, 0);
                const pasivoTotal = pasivoBalances.reduce((sum, a) => sum + a.balance, 0);
                const patrimonioTotal = patrimonioBalances.reduce((sum, a) => sum + a.balance, 0);
                
                document.getElementById('balance-general').innerHTML = `
                    <div class="dashboard-summary">
                        <div class="summary-item">
                            <span class="summary-label">Activo:</span>
                            <span class="summary-value">${activoTotal.toFixed(2)} XFA</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Pasivo:</span>
                            <span class="summary-value">${pasivoTotal.toFixed(2)} XFA</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Patrimonio:</span>
                            <span class="summary-value">${patrimonioTotal.toFixed(2)} XFA</span>
                        </div>
                    </div>
                `;
            });
        });
    }

    // 8. Funciones auxiliares
    getAccountsByType(type) {
        return new Promise(resolve => {
            const transaction = this.db.transaction(['chartOfAccounts'], 'readonly');
            const store = transaction.objectStore('chartOfAccounts');
            const index = store.index('accountType');
            const request = index.getAll(type);
            
            request.onsuccess = (event) => {
                resolve(event.target.result || []);
            };
        });
    }

    calculateBalances(accounts) {
        return new Promise(resolve => {
            const transaction = this.db.transaction(['entryLines'], 'readonly');
            const linesStore = transaction.objectStore('entryLines');
            
            const balances = [];
            let processed = 0;
            
            accounts.forEach(account => {
                linesStore.index('accountCode').getAll(account.code).onsuccess = (event) => {
                    const lines = event.target.result;
                    const balance = lines.reduce((sum, line) => sum + line.debit - line.credit, 0);
                    
                    if (balance !== 0) {
                        balances.push({
                            ...account,
                            balance
                        });
                    }
                    
                    if (++processed === accounts.length) {
                        resolve(balances);
                    }
                };
            });
            
            if (accounts.length === 0) resolve([]);
        });
    }

    logAudit(message) {
        const transaction = this.db.transaction(['auditLog'], 'readwrite');
        const store = transaction.objectStore('auditLog');
        
        store.add({
            action: 'system',
            timestamp: new Date(),
            details: message
        });
    }

    // 9. Inicialización de la aplicación
    initEventListeners() {
        // Navegación principal
        document.querySelectorAll('.sidebar li').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                this.showSection(section);
            });
        });

        // Configuración
        document.getElementById('config-btn').addEventListener('click', () => 
            this.showModal('config-modal'));
        document.querySelector('.close-modal').addEventListener('click', () => 
            this.closeModal());
        document.getElementById('company-config-form').addEventListener('submit', (e) => 
            this.saveCompanyConfig(e));

        // Contabilidad
        document.getElementById('add-line-btn').addEventListener('click', () => 
            this.addAccountingLine());
        document.getElementById('accounting-entry-form').addEventListener('submit', (e) => 
            this.saveAccountingEntry(e));
        document.getElementById('filter-entries-btn').addEventListener('click', () => 
            this.filterAccountingEntries());

        // Reportes
        document.querySelectorAll('.report-card').forEach(card => {
            card.addEventListener('click', () => {
                const report = card.dataset.report;
                this.generateReport(report);
            });
        });

        document.getElementById('export-report-pdf').addEventListener('click', () => 
            this.exportCurrentReportToPDF());
        document.getElementById('export-report-excel').addEventListener('click', () => 
            this.exportCurrentReportToExcel());
    }

    showSection(sectionId) {
        // Actualizar navegación
        document.querySelectorAll('.sidebar li').forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });

        // Mostrar sección
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.toggle('active', section.id === sectionId);
        });

        // Actualizar datos si es necesario
        if (sectionId === 'dashboard') {
            this.updateDashboard();
        } else if (sectionId === 'accounts') {
            this.renderAccountsList();
        } else if (sectionId === 'accounting') {
            this.loadAccountingEntries();
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    const app = new AjusteDeCuentas();
    window.app = app; // Hacer accesible para depuración
});
