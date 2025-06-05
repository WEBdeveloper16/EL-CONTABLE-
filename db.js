// Configuración de la base de datos
const DB_NAME = 'AjusteDeCuentasDB';
const DB_VERSION = 3; // Incrementar al hacer cambios en el esquema

// Definición de object stores e índices
const DB_SCHEMA = {
    objectStores: [
        {
            name: 'companyConfig',
            keyPath: 'id',
            autoIncrement: false,
            indexes: []
        },
        {
            name: 'chartOfAccounts',
            keyPath: 'code',
            autoIncrement: false,
            indexes: [
                { name: 'parentCode', keyPath: 'parentCode', unique: false },
                { name: 'accountType', keyPath: 'accountType', unique: false }
            ]
        },
        {
            name: 'accountingEntries',
            keyPath: 'id',
            autoIncrement: true,
            indexes: [
                { name: 'date', keyPath: 'date', unique: false },
                { name: 'concept', keyPath: 'concept', unique: false },
                { name: 'createdAt', keyPath: 'createdAt', unique: false }
            ]
        },
        {
            name: 'entryLines',
            keyPath: 'id',
            autoIncrement: true,
            indexes: [
                { name: 'entryId', keyPath: 'entryId', unique: false },
                { name: 'accountCode', keyPath: 'accountCode', unique: false },
                { 
                    name: 'entryId_accountCode', 
                    keyPath: ['entryId', 'accountCode'], 
                    unique: false 
                }
            ]
        },
        {
            name: 'auditLog',
            keyPath: 'id',
            autoIncrement: true,
            indexes: [
                { name: 'timestamp', keyPath: 'timestamp', unique: false },
                { name: 'action', keyPath: 'action', unique: false },
                { name: 'entryId', keyPath: 'entryId', unique: false }
            ]
        }
    ]
};

// Clase Database para manejar IndexedDB
class AccountingDatabase {
    constructor() {
        this.db = null;
        this.initPromise = this.initDatabase();
    }

    // Inicializar la base de datos
    initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const transaction = event.target.transaction;
                this.createObjectStores(db, event.oldVersion);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this);
            };

            request.onerror = (event) => {
                console.error('Database error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Crear object stores durante la actualización
    createObjectStores(db, oldVersion) {
        // Versión 1: Estructura básica inicial
        if (oldVersion < 1) {
            // Configuración de empresa
            const companyConfigStore = db.createObjectStore(
                'companyConfig', 
                { keyPath: 'id' }
            );

            // Plan de cuentas
            const chartOfAccountsStore = db.createObjectStore(
                'chartOfAccounts', 
                { keyPath: 'code' }
            );
            chartOfAccountsStore.createIndex(
                'parentCode', 
                'parentCode', 
                { unique: false }
            );

            // Asientos contables
            const accountingEntriesStore = db.createObjectStore(
                'accountingEntries', 
                { 
                    keyPath: 'id', 
                    autoIncrement: true 
                }
            );
            accountingEntriesStore.createIndex(
                'date', 
                'date', 
                { unique: false }
            );

            // Líneas de asiento
            const entryLinesStore = db.createObjectStore(
                'entryLines', 
                { 
                    keyPath: 'id', 
                    autoIncrement: true 
                }
            );
            entryLinesStore.createIndex(
                'entryId', 
                'entryId', 
                { unique: false }
            );
            entryLinesStore.createIndex(
                'accountCode', 
                'accountCode', 
                { unique: false }
            );
        }

        // Versión 2: Agregar índices adicionales
        if (oldVersion < 2) {
            const transaction = request.transaction;
            
            // Índice para búsqueda por concepto en asientos
            const accountingEntriesStore = transaction.objectStore('accountingEntries');
            accountingEntriesStore.createIndex(
                'concept', 
                'concept', 
                { unique: false }
            );
            
            // Índice para tipo de cuenta
            const chartOfAccountsStore = transaction.objectStore('chartOfAccounts');
            chartOfAccountsStore.createIndex(
                'accountType', 
                'accountType', 
                { unique: false }
            );
        }

        // Versión 3: Agregar auditoría
        if (oldVersion < 3) {
            const auditLogStore = db.createObjectStore(
                'auditLog', 
                { 
                    keyPath: 'id', 
                    autoIncrement: true 
                }
            );
            auditLogStore.createIndex(
                'timestamp', 
                'timestamp', 
                { unique: false }
            );
            auditLogStore.createIndex(
                'action', 
                'action', 
                { unique: false }
            );
            auditLogStore.createIndex(
                'entryId', 
                'entryId', 
                { unique: false }
            );
        }
    }

    // Métodos CRUD para companyConfig
    async getCompanyConfig() {
        return this.read('companyConfig', 1);
    }

    async saveCompanyConfig(config) {
        config.id = 1; // Siempre usamos el ID 1 para la configuración
        return this.update('companyConfig', config);
    }

    // Métodos CRUD para chartOfAccounts
    async getAccount(code) {
        return this.read('chartOfAccounts', code);
    }

    async getAccountsByParent(parentCode) {
        return this.readAllByIndex(
            'chartOfAccounts', 
            'parentCode', 
            parentCode
        );
    }

    async getAccountsByType(accountType) {
        return this.readAllByIndex(
            'chartOfAccounts', 
            'accountType', 
            accountType
        );
    }

    async saveAccount(account) {
        return this.update('chartOfAccounts', account);
    }

    // Métodos CRUD para accountingEntries
    async createAccountingEntry(entry) {
        entry.createdAt = new Date();
        return this.create('accountingEntries', entry);
    }

    async getAccountingEntry(id) {
        return this.read('accountingEntries', id);
    }

    async getAccountingEntriesByDateRange(fromDate, toDate) {
        const range = IDBKeyRange.bound(fromDate, toDate);
        return this.readAllByIndex(
            'accountingEntries', 
            'date', 
            range
        );
    }

    async searchAccountingEntriesByConcept(searchTerm) {
        const entries = await this.readAll('accountingEntries');
        return entries.filter(entry => 
            entry.concept.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    async deleteAccountingEntry(id) {
        // Primero eliminamos las líneas asociadas
        const lines = await this.getEntryLinesByEntry(id);
        await Promise.all(lines.map(line => 
            this.delete('entryLines', line.id)
        ));
        
        // Luego eliminamos el asiento
        return this.delete('accountingEntries', id);
    }

    // Métodos CRUD para entryLines
    async createEntryLine(line) {
        return this.create('entryLines', line);
    }

    async getEntryLinesByEntry(entryId) {
        return this.readAllByIndex(
            'entryLines', 
            'entryId', 
            entryId
        );
    }

    async getEntryLinesByAccount(accountCode) {
        return this.readAllByIndex(
            'entryLines', 
            'accountCode', 
            accountCode
        );
    }

    async getEntryLinesByEntryAndAccount(entryId, accountCode) {
        const range = IDBKeyRange.bound(
            [entryId, accountCode],
            [entryId, accountCode + '\uffff']
        );
        
        return this.readAllByIndex(
            'entryLines', 
            'entryId_accountCode', 
            range
        );
    }

    // Métodos CRUD para auditLog
    async logAuditEvent(action, details, entryId = null) {
        const logEntry = {
            action,
            details,
            timestamp: new Date(),
            entryId
        };
        
        return this.create('auditLog', logEntry);
    }

    async getAuditLogByEntry(entryId) {
        return this.readAllByIndex(
            'auditLog', 
            'entryId', 
            entryId
        );
    }

    async getAuditLogByDateRange(fromDate, toDate) {
        const range = IDBKeyRange.bound(fromDate, toDate);
        return this.readAllByIndex(
            'auditLog', 
            'timestamp', 
            range
        );
    }

    // Métodos genéricos de CRUD
    async create(storeName, data) {
        return this.executeRequest(
            storeName, 
            'readwrite', 
            store => store.add(data)
        );
    }

    async read(storeName, key) {
        return this.executeRequest(
            storeName, 
            'readonly', 
            store => store.get(key)
        );
    }

    async readAll(storeName) {
        return this.executeRequest(
            storeName, 
            'readonly', 
            store => store.getAll()
        );
    }

    async readAllByIndex(storeName, indexName, keyOrRange) {
        return this.executeRequest(
            storeName, 
            'readonly', 
            store => {
                const index = store.index(indexName);
                return index.getAll(keyOrRange);
            }
        );
    }

    async update(storeName, data) {
        return this.executeRequest(
            storeName, 
            'readwrite', 
            store => store.put(data)
        );
    }

    async delete(storeName, key) {
        return this.executeRequest(
            storeName, 
            'readwrite', 
            store => store.delete(key)
        );
    }

    // Ejecutar una operación en la base de datos
    async executeRequest(storeName, mode, operation) {
        await this.initPromise; // Esperar a que la DB esté inicializada
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            
            const request = operation(store);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Métodos de utilidad
    async calculateAccountBalance(accountCode, endDate = null) {
        const lines = await this.getEntryLinesByAccount(accountCode);
        
        // Filtrar por fecha si es necesario
        const filteredLines = endDate ? 
            await this.filterLinesByDate(lines, endDate) : 
            lines;
        
        // Calcular saldo
        return filteredLines.reduce(
            (balance, line) => balance + line.debit - line.credit,
            0
        );
    }

    async filterLinesByDate(lines, endDate) {
        const entryIds = [...new Set(lines.map(line => line.entryId))];
        const entries = await Promise.all(
            entryIds.map(id => this.getAccountingEntry(id))
        );
        
        const validEntries = entries.filter(entry => 
            new Date(entry.date) <= new Date(endDate)
        );
        
        const validEntryIds = new Set(validEntries.map(entry => entry.id));
        return lines.filter(line => validEntryIds.has(line.entryId));
    }

    // Inicializar datos por primera vez
    async initializeSampleData() {
        // Verificar si ya hay datos
        const config = await this.getCompanyConfig();
        if (config) return;
        
        // Configuración inicial de empresa
        await this.saveCompanyConfig({
            name: 'Ajuste de Cuentas',
            phone: '',
            email: '',
            address: '',
            nif: ''
        });
        
        // Plan de cuentas inicial (PGC simplificado)
        const accounts = [
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
        
        // Insertar cuentas
        await Promise.all(accounts.map(account => 
            this.saveAccount(account)
        ));
        
        // Registrar en auditoría
        await this.logAuditEvent('init', 'Datos iniciales cargados');
    }
}

// Exportar singleton de la base de datos
const accountingDB = new AccountingDatabase();
accountingDB.initializeSampleData(); // Cargar datos iniciales si es necesario

// Hacer disponible para la aplicación principal
window.accountingDB = accountingDB;
