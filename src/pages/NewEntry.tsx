import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, X, Info, Receipt } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type FinancialEntry, type EntryItem, type Bank, type Category } from '../db';
import { supabase } from '../supabaseClient';

type EntryType = 'जमा' | 'खर्च' | 'बचत';
type StatusType = 'Paid' | 'Pending' | 'Partial';

interface SupabasePayload {
    user_id: string;
    date: string;
    amount: number;
    remarks: string;
    category: string;
    payment_mode: string;
    bank_id: string | null;
    expense_no: string;
    status: string;
    entry_type: string;
    paid_to: string;
}

export default function NewEntry() {
    const location = useLocation();
    const navigate = useNavigate();

    // --- Form States ---
    const [editId, setEditId] = useState<number | null>(null);
    const [entryType, setEntryType] = useState<EntryType>('खर्च');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState<string>('');
    const [paymentMode, setPaymentMode] = useState<string>('Cash');
    const [remarks, setRemarks] = useState<string>('');
    const [paidTo, setPaidTo] = useState<string>('');
    const [expenseNo, setExpenseNo] = useState<string>("V-" + Math.floor(100000 + Math.random() * 900000));
    const [status, setStatus] = useState<StatusType>('Paid');
    const [items, setItems] = useState<EntryItem[]>([
        { id: Date.now(), description: '', qty: 1, price: 0, amount: 0 }
    ]);

    // --- Database Queries ---
    const rawCategories = useLiveQuery<Category[]>(() => db.categories.toArray());
    const rawBankList = useLiveQuery<Bank[]>(() => db.banks.toArray());
    const recentEntries = useLiveQuery<FinancialEntry[]>(() =>
        db.entries.orderBy('date').reverse().limit(10).toArray()
    );

    const filteredOptions = useMemo(() => {
        const allCats = rawCategories || [];
        return allCats
            .filter((c: Category) => c.type === entryType)
            .map(c => ({ id: c.id, name: c.name }));
    }, [rawCategories, entryType]);

    const uniqueBankList = useMemo(() => {
        const banks = rawBankList || [];
        const seen = new Set<string>();
        return banks
            .filter((bank: Bank) => !["SBI", "HDFC", "Bank of Maharashtra"].includes(bank.bankName))
            .filter((bank: Bank) => {
                const name = bank.bankName.trim().toLowerCase();
                const duplicate = seen.has(name);
                seen.add(name);
                return !duplicate;
            });
    }, [rawBankList]);

    const subTotal = useMemo(() =>
        items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0)
        , [items]);

    // --- Effects ---
    useEffect(() => {
        const editData = (location.state?.editData as FinancialEntry);

        // जर editData असेल आणि आपण आधीच तो सेट केलेला नसेल (editId === null) तरच लोड करा
        if (editData && editId === null) {
            if (editData.entryType === 'बिल') {
                alert("ही बिल एंट्री आहे.");
                navigate('/dashboard');
                return;
            }
            setEditId(editData.id ?? null);
            setDate(editData.date);
            setExpenseNo(editData.expenseNo);
            setEntryType(editData.entryType as EntryType);
            setPaidTo(editData.paidTo || "");
            setCategory(editData.category);
            setPaymentMode(editData.paymentMode || "Cash");
            setRemarks(editData.remarks || "");
            setStatus((editData.status as StatusType) || "Paid");
            setItems(editData.items && editData.items.length > 0
                ? editData.items
                : [{ id: Date.now(), description: '', qty: 1, price: 0, amount: 0 }]);
        }
    }, [location.state, navigate, editId]); // dependency मध्ये editId टाका

    const resetForm = () => {
        // १. सर्व स्टेट्स मॅन्युअली रिसेट करा
        setEditId(null);
        setPaidTo('');
        setRemarks('');
        setCategory('');
        setExpenseNo("V-" + Math.floor(100000 + Math.random() * 900000));
        setItems([{ id: Date.now(), description: '', qty: 1, price: 0, amount: 0 }]);
        setPaymentMode('Cash');
        setEntryType('खर्च');
        setStatus('Paid');
        setDate(new Date().toISOString().split('T')[0]);
        navigate('/new-entry', { replace: true, state: null });
    };

    const handleAddOption = async () => {
        const name: string | null = prompt(`${entryType} साठी नवीन कॅटेगरीचे नाव टाका:`);
        if (name && name.trim()) {
            try {
                await db.categories.add({
                    name: name.trim(),
                    type: entryType
                });
                setCategory(name.trim());
            } catch (err: unknown) {
                console.error("कॅटेगरी जोडताना त्रुटी:", err);
            }
        }
    };

    const handleSave = async () => {
        if (!category) { alert("कृपया कॅटेगरी निवडा!"); return; }
        try {
            const { data: authData } = await supabase.auth.getUser();
            const user = authData?.user;
            if (!user) throw new Error("लॉगिन सत्र संपले आहे.");

            const amountNumber = Number(subTotal);
            const finalAmount = (entryType === 'जमा') ? Math.abs(amountNumber) : -Math.abs(amountNumber);
            const selectedBank = uniqueBankList.find(b => b.bankName === paymentMode);
            const finalBankId = selectedBank ? String(selectedBank.id) : null;

            const commonTxnData = { user_id: user.id, date, amount: finalAmount, description: `${entryType}: ${category} (${expenseNo})`, expense_no: expenseNo };

            if (paymentMode === 'Cash') {
                await supabase.from('cash_transactions').upsert([{ ...commonTxnData, entry_type: entryType, payment_mode: 'Cash' }], { onConflict: 'expense_no' });
            } else {
                await supabase.from('bank_transactions').upsert([{ ...commonTxnData, bank_id: finalBankId, entry_type: entryType, payment_mode: paymentMode }], { onConflict: 'expense_no' });
            }

            const payload = { date, expenseNo, entryType, category, paidTo, status, isInvoice: false, amount: finalAmount, paymentMode, bankId: finalBankId, remarks, items };
            const supabasePayload: SupabasePayload = { user_id: user.id, date, amount: finalAmount, remarks, category, payment_mode: paymentMode, bank_id: finalBankId, expense_no: expenseNo, status, entry_type: entryType, paid_to: paidTo };

            if (editId) {
                await db.entries.put({ ...payload, id: Number(editId) });
                await supabase.from('entries').upsert([supabasePayload], { onConflict: 'expense_no' });
            } else {
                await db.entries.add(payload);
                await supabase.from('entries').insert([supabasePayload]);
            }

            alert("यशस्वीरित्या जतन केले!");
            resetForm();
            
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "काहीतरी चूक झाली";
            alert("त्रुटी: " + errorMessage);
        }
    };

    const updateItem = (id: number, field: keyof EntryItem, value: string | number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                if (field === 'qty' || field === 'price') updated.amount = (Number(updated.qty) || 0) * (Number(updated.price) || 0);
                return updated;
            }
            return item;
        }));
    };

    return (
        <div className="flex flex-col h-full space-y-4 bg-[#F4F7F9] p-4 overflow-hidden font-sans">

            {/* HEADER */}
            <div className="flex items-center justify-between bg-[#1B2A4A] p-4 rounded-xl shadow-lg border-b-4 border-[#36BA7F] shrink-0">
                <div className="flex items-center space-x-4">
                    <div className="bg-[#36BA7F] p-2 rounded-lg shadow-inner">
                        <Receipt className="text-white" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white leading-tight tracking-tight">
                            {editId ? "नोंद सुधारा" : "नवीन व्हाउचर नोंद"}
                        </h2>
                        <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">Vihaan Business Solutions</p>
                    </div>
                </div>
                <div className="flex items-center space-x-6">
                    <div className="text-right hidden sm:block border-l border-blue-800 pl-6">
                        <span className="text-[10px] font-black text-blue-300 block uppercase">Voucher ID</span>
                        <span className="text-lg font-black text-white">{expenseNo}</span>
                    </div>
                    <button onClick={resetForm} className="bg-white/10 hover:bg-red-500/20 p-2 rounded-full transition-all group">
                        <X size={20} className="text-white group-hover:text-red-200" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 overflow-hidden">

                {/* LEFT MAIN FORM */}
                <div className="lg:col-span-3 space-y-4 overflow-y-auto pr-1 pb-24 lg:pb-0">

                    {/* Primary Info Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-[#1B2A4A] uppercase tracking-wider">एंट्रीचा प्रकार</label>
                                <div className="flex bg-gray-100 p-1.5 rounded-lg border-2 border-gray-200">
                                    {(['जमा', 'खर्च', 'बचत'] as const).map((t) => (
                                        <button key={t} onClick={() => { setEntryType(t); setCategory(''); }}
                                            className={`flex-1 py-2 rounded-md text-xs font-black transition-all ${entryType === t ? 'bg-[#1B2A4A] text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-[#1B2A4A] uppercase tracking-wider">वर्गवारी (Category)</label>
                                <div className="flex gap-1">
                                    <select value={category} onChange={(e) => setCategory(e.target.value)}
                                        className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-lg p-2.5 text-sm font-bold text-[#1B2A4A] outline-none focus:border-[#1B2A4A]">
                                        <option value="">निवडा...</option>
                                        {filteredOptions.map(opt => <option key={opt.id} value={opt.name}>{opt.name}</option>)}
                                    </select>
                                    <button onClick={handleAddOption} type="button" className="p-2 bg-blue-50 text-blue-700 rounded-lg border-2 border-blue-100">
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-[#1B2A4A] uppercase tracking-wider">कोणाकडून / कोणास</label>
                                <input type="text" value={paidTo} onChange={(e) => setPaidTo(e.target.value)}
                                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-[#1B2A4A]" placeholder="नाव टाका..." />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="text-[11px] font-black text-[#1B2A4A] uppercase tracking-wider">तारीख</label>
                                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-200 rounded-lg p-2.5 text-sm font-bold outline-none" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[11px] font-black text-[#1B2A4A] uppercase tracking-wider">स्थिती (Status)</label>
                                    <div className="flex bg-gray-50 p-1 rounded-lg border-2 border-gray-200">
                                        {(['Paid', 'Pending'] as const).map((s) => (
                                            <button key={s} onClick={() => setStatus(s)}
                                                className={`flex-1 py-1.5 rounded-md text-[10px] font-black transition-all ${status === s ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>{s}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ITEMS TABLE */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-[#EDF2F7] border-b-2 border-gray-200 text-[11px] font-black text-[#1B2A4A] uppercase">
                                <tr>
                                    <th className="px-4 py-4 w-16 text-center">Action</th>
                                    <th className="px-4 py-4">तपशील (Description)</th>
                                    <th className="px-4 py-4 w-24 text-right">Qty</th>
                                    <th className="px-4 py-4 w-32 text-right">Price</th>
                                    <th className="px-4 py-4 w-32 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.map((item) => (
                                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => setItems(items.length > 1 ? items.filter(i => i.id !== item.id) : items)} className="text-red-300 hover:text-red-600 transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                                className="w-full bg-transparent outline-none text-sm font-bold text-gray-700"
                                                placeholder="येथे तपशील लिहा..."
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <input type="number" value={item.qty || ''} onChange={(e) => updateItem(item.id, 'qty', Number(e.target.value))} className="w-full bg-transparent text-right font-black outline-none text-[#1B2A4A]" />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <input type="number" value={item.price || ''} onChange={(e) => updateItem(item.id, 'price', Number(e.target.value))} className="w-full bg-transparent text-right font-black outline-none text-[#1B2A4A]" />
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-black text-[#1B2A4A]">₹ {(item.amount || 0).toLocaleString('en-IN')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-4 bg-gray-50/50 border-t flex justify-between">
                            <button onClick={() => setItems([...items, { id: Date.now(), description: '', qty: 1, price: 0, amount: 0 }])}
                                className="text-[11px] font-black text-blue-700 uppercase flex items-center hover:underline">
                                <Plus size={16} className="mr-1" /> नवीन आयटम जोडा
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDEBAR */}
                <div className="bg-[#1B2A4A] rounded-xl shadow-xl flex flex-col overflow-hidden max-h-[500px] lg:max-h-full">
                    <div className="p-4 border-b border-blue-800 bg-white/5 font-black text-xs text-blue-200 uppercase flex items-center shrink-0">
                        <Info size={14} className="mr-2 text-[#36BA7F]" /> अलीकडील व्यवहारांची यादी
                    </div>
                    <div className="p-3 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                        {recentEntries?.filter(e => e.entryType !== 'बिल').map((entry) => (
                            <div key={entry.id} onClick={() => navigate('/new-entry', { state: { editData: entry } })}
                                className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-all">
                                <div className="flex justify-between items-center">
                                    <div className="min-w-0">
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${entry.entryType === 'जमा' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{entry.entryType}</span>
                                        <span className="text-xs font-bold text-white block truncate mt-1">{entry.paidTo || entry.category}</span>
                                        <span className="text-[9px] text-gray-400 block">{entry.date}</span>
                                    </div>
                                    <div className={`text-sm font-black ${entry.entryType === 'जमा' ? 'text-green-400' : 'text-red-400'}`}>
                                        ₹{Math.abs(entry.amount).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* FOOTER ACTION BAR */}
            <div className="bg-white p-4 rounded-xl shadow-2xl border-t-4 border-[#36BA7F] flex flex-col md:flex-row justify-between items-center gap-6 shrink-0 z-10">
                <div className="w-full md:flex-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Remarks / काही टिपणी असल्यास</label>
                    <input value={remarks} onChange={(e) => setRemarks(e.target.value)}
                        className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-lg text-sm font-bold outline-none focus:border-[#1B2A4A]" placeholder="येथे माहिती लिहा..." />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-8 w-full md:w-auto">
                    <div className="text-right">
                        <label className="text-[11px] font-black text-[#1B2A4A] uppercase block tracking-tighter">Payment Mode</label>
                        <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                            className="bg-blue-50 text-blue-900 border-none rounded-lg px-4 py-2 text-sm font-black outline-none mt-1">
                            <option value="Cash">CASH</option>
                            <option value="UPI">UPI / G-PAY</option>
                            {uniqueBankList.map((bank) => <option key={bank.id} value={bank.bankName}>{bank.bankName.toUpperCase()}</option>)}
                        </select>
                    </div>

                    <div className="text-right px-6 border-l-2 border-gray-100">
                        <p className="text-[11px] font-black text-gray-400 uppercase">एकूण रक्कम (Total)</p>
                        <h3 className="text-3xl font-black text-[#1B2A4A] leading-none mt-1">
                            ₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </h3>
                    </div>

                    <button onClick={handleSave}
                        className="w-full md:w-auto bg-[#36BA7F] hover:bg-[#2da36e] text-white font-black py-4 px-12 rounded-xl shadow-lg flex items-center justify-center transition-all active:scale-95 group">
                        <Save size={20} className="mr-2 group-hover:animate-pulse" />
                        {editId ? "अपडेट करा" : "सेव्ह करा (F8)"}
                    </button>
                </div>
            </div>
        </div>
    );
}