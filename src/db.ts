// db.ts
import Dexie, { type Table } from 'dexie';

// १. प्रत्येक व्यवहारातील आयटम्ससाठी इंटरफेस
export interface EntryItem {
    id: number;
    description: string;
    qty: number;
    price: number;
    amount: number;
}

// २. मुख्य आर्थिक नोंदणीसाठी इंटरफेस
export interface FinancialEntry {
    id?: number;
    date: string;
    expenseNo: string;
    entryType: 'जमा' | 'खर्च' | 'बचत' | 'बिल';
    category: string;
    paidTo: string;
    amount: number;
    paymentMode: string;
    status: 'Paid' | 'Pending' | 'Partial';
    remarks?: string;
    isInvoice?: boolean;
    items?: EntryItem[];
    // खालील ओळ नवीन जोडा:
    bankId?: string | null;
}

// ३. बँकांच्या माहितीसाठी इंटरफेस
export interface Bank {
    id?: number;
    bankName: string;
    accountNo?: string;
    openingBalance: number;
    currentBalance: number;
    isActive?: boolean; // हे नवीन जोडा (true/false)
}

// ४. कॅटेगरीसाठी इंटरफेस
export interface Category {
    id?: number;
    name: string;
    // 'बिल' प्रकारासाठी कॅटेगरी ऐवजी आपण ग्राहक वापरणार आहोत, 
    // तरीही सुसंगततेसाठी इथे 'बिल' ठेवले आहे.
    type: 'जमा' | 'खर्च' | 'बचत' | 'बिल';
}

// ५. डिस्क्रिप्शन सजेशन्ससाठी इंटरफेस
export interface Suggestion {
    id?: number;
    text: string;
}

// ६. ग्राहकांसाठी (Customers) नवीन इंटरफेस - 'बिल' विभागासाठी आवश्यक
export interface Customer {
    id?: number;
    name: string;
    phone?: string;
    address?: string;
}

// ७. मुख्य डेटाबेस क्लास
export class MyDatabase extends Dexie {
    entries!: Table<FinancialEntry>;
    banks!: Table<Bank>;
    categories!: Table<Category>;
    suggestions!: Table<Suggestion>;
    customers!: Table<Customer>; // नवीन टेबल

    constructor() {
        super('VihaanTrackerDB');

        // व्हर्जन ५: 'customers' टेबल आणि 'entryType' अपडेटसह
        this.version(5).stores({
            entries: '++id, date, expenseNo, entryType, category, paymentMode, status',
            banks: '++id, bankName, accountNo',
            categories: '++id, name, type',
            suggestions: '++id, &text',
            customers: '++id, name, phone' // ग्राहक स्टोअर इंडेक्स
        });
    }
}

// ८. डेटाबेस इन्स्टन्स एक्सपोर्ट करणे
export const db = new MyDatabase();

/**
 * तांत्रिक दुरुस्ती नोट्स:
 * १. 'entryType' मध्ये 'बिल' हा नवीन प्रकार जोडला आहे.
 * २. 'customers' नावाचे नवीन टेबल तयार केले आहे, जे 'बिल' निवडल्यावर वापरले जाईल.
 * ३. व्हर्जन ४ वरून ५ वर अपडेट केल्यामुळे नवीन 'customers' टेबल स्कीमा लागू होईल.
 * ४. 'suggestions' मध्ये '&text' मुळे डुप्लिकेट आयटम्स रोखले जातील.
 */