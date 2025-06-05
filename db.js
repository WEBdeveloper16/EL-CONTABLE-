erDiagram
    companyConfig ||--o{ accountingEntries : has
    companyConfig {
        number id PK
        string name
        string phone
        string email
        string address
        string nif
        string logo
    }
    
    chartOfAccounts ||--o{ entryLines : referenced
    chartOfAccounts {
        string code PK
        string name
        string parentCode
        string accountType
        boolean editable
    }
    
    accountingEntries ||--o{ entryLines : contains
    accountingEntries {
        number id PK
        string date
        string concept
        number totalDebit
        number totalCredit
        date createdAt
    }
    
    entryLines {
        number id PK
        number entryId FK
        string accountCode FK
        number debit
        number credit
    }
    
    auditLog {
        number id PK
        string action
        date timestamp
        string details
        number entryId FK
    }
