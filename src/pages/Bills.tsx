import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, X, Info, Receipt, User, Calendar } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type FinancialEntry, type EntryItem, type Bank, type Category, type Customer } from '../db';
import { supabase } from '../supabaseClient';

type EntryType = 'जमा' | 'खर्च' | 'बचत' | 'बिल';
type StatusType = 'Paid' | 'Pending' | 'Partial';

export default function BillEntry() {
    const location = useLocation();
    const navigate = useNavigate();

    // --- Form States ---
    const [editId, setEditId] = useState<number | null>(null);
    const [entryType, setEntryType] = useState<EntryType>('बिल');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState<string>('Sales');
    const [paymentMode, setPaymentMode] = useState<string>('Cash');
    const [remarks, setRemarks] = useState<string>('');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [paidTo, setPaidTo] = useState<string>('');
    const [expenseNo, setExpenseNo] = useState<string>("INV-" + Math.floor(100000 + Math.random() * 900000));
    const [status, setStatus] = useState<StatusType>('Paid');
    const [items, setItems] = useState<EntryItem[]>([
        { id: Date.now(), description: '', qty: 1, price: 0, amount: 0 }
    ]);

    // --- Database Queries ---
    const rawCategories = useLiveQuery(() => db.categories.toArray());
    const rawBankList = useLiveQuery(() => db.banks.toArray());
    const customers = useLiveQuery(() => db.customers.toArray());
    const recentEntries = useLiveQuery(() =>
        db.entries.orderBy('date').reverse().limit(10).toArray()
    );

    // --- Memoized Values ---
    const filteredOptions = useMemo(() => {
        const allCats = rawCategories || [];
        if (entryType === 'बिल') return [{ id: 'sales-default', name: 'Sales' }];
        return allCats.filter((c: Category) => c.type === entryType).map(c => ({ id: c.id, name: c.name }));
    }, [rawCategories, entryType]);

    const uniqueBankList = useMemo(() => {
        const banks = rawBankList || [];
        const seen = new Set<string>();
        return banks.filter((bank: Bank) => {
            const name = bank.bankName.trim().toLowerCase();
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
        });
    }, [rawBankList]);

    const subTotal = useMemo(() =>
        items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0)
        , [items]);

    // --- Effects ---
    useEffect(() => {
        const editData = (location.state?.editData as FinancialEntry);
        if (editData && editId === null) {
            setEditId(editData.id ?? null);
            setDate(editData.date);
            setExpenseNo(editData.expenseNo);
            setEntryType(editData.entryType as EntryType);

            if (editData.entryType === 'बिल') {
                const cust = customers?.find(c => c.name === editData.paidTo);
                if (cust) setSelectedCustomerId(String(cust.id));
            } else {
                setPaidTo(editData.paidTo || "");
            }

            setCategory(editData.category);
            setPaymentMode(editData.paymentMode || "Cash");
            setRemarks(editData.remarks || "");
            setStatus((editData.status as StatusType) || "Paid");
            setItems(editData.items && editData.items.length > 0 ? editData.items : []);
        }
    }, [location.state, customers, editId]);

    const resetForm = () => {
        setEditId(null);
        setSelectedCustomerId('');
        setPaidTo('');
        setRemarks('');
        setCategory('Sales');
        setExpenseNo("INV-" + Math.floor(100000 + Math.random() * 900000));
        setItems([{ id: Date.now(), description: '', qty: 1, price: 0, amount: 0 }]);
        setEntryType('बिल');
        navigate('/bill', { replace: true, state: null });
    };

    const handleSave = async () => {
        if (entryType === 'बिल' && !selectedCustomerId) { alert("कृपया ग्राहक निवडा!"); return; }

        try {
            const { data: authData } = await supabase.auth.getUser();
            const user = authData?.user;
            if (!user) throw new Error("लॉगिन सत्र संपले आहे.");

            const amountNumber = Number(subTotal);

            // बदल: जर बिल असेल तर ते 'जमा' (Plus) मानले जावे 
            // यासाठी आपण entry_type 'जमा' म्हणून पाठवू शकतो किंवा 
            // तुमच्या सिस्टीमनुसार 'बिल'ला 'जमा'च्या लॉजिकमध्ये टाकू शकतो.
            const finalAmount = Math.abs(amountNumber);

            const customerName = customers?.find(c => String(c.id) === selectedCustomerId)?.name || paidTo;
            const selectedBank = uniqueBankList.find(b => b.bankName === paymentMode);
            const finalBankId = selectedBank ? String(selectedBank.id) : null;

            const payload = {
                user_id: user.id,
                date,
                amount: finalAmount, // ही रक्कम प्लस मध्येच जाईल
                expense_no: expenseNo,
                // येथे बदल: जर तुम्हाला 'बिल' हे 'जमा' म्हणून दिसायला हवे असेल, 
                // तर तुम्ही entry_type: 'जमा' वापरू शकता.
                entry_type: entryType === 'बिल' ? 'जमा' : entryType,
                category: category,
                paid_to: customerName,
                payment_mode: paymentMode,
                status: status,
                remarks: remarks,
                bank_id: finalBankId,
                items: items,
                is_invoice: true
            };

            // Local IndexedDB Save
            await db.entries.put({
                ...payload,
                expenseNo: expenseNo,
                entryType: entryType === 'बिल' ? 'जमा' : entryType, // येथेही बदल
                paidTo: customerName,
                paymentMode: paymentMode,
                bankId: finalBankId,
                isInvoice: true,
                id: editId ?? undefined
            });

            // Supabase Sync
            await supabase.from('entries').upsert([payload], { onConflict: 'expense_no' });

            alert("बिल यशस्वीरित्या 'जमा' म्हणून जतन केले!");
            resetForm();
        } catch (err: any) {
            alert("त्रुटी: " + (err.message || "काहीतरी चूक झाली"));
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

            {/* HEADER - Styled like New Entry */}
            <div className="flex items-center justify-between bg-[#1B2A4A] p-4 rounded-xl shadow-lg border-b-4 border-[#36BA7F] shrink-0">
                <div className="flex items-center space-x-4">
                    <div className="bg-[#36BA7F] p-2 rounded-lg shadow-inner">
                        <Receipt className="text-white" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white leading-tight tracking-tight">
                            {editId ? "बिल सुधारा" : "नवीन बिल (Invoice)"}
                        </h2>
                        <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">Vihaan Business Solutions</p>
                    </div>
                </div>
                <div className="flex items-center space-x-6">
                    <div className="text-right hidden sm:block border-l border-blue-800 pl-6">
                        <span className="text-[10px] font-black text-blue-300 block uppercase">Invoice No</span>
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

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-[#1B2A4A] uppercase tracking-wider flex items-center gap-1">
                                    <User size={12} /> ग्राहक निवडा (Customer)
                                </label>
                                <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}
                                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-lg p-2.5 text-sm font-bold text-[#1B2A4A] outline-none focus:border-[#1B2A4A]">
                                    <option value="">ग्राहक निवडा...</option>
                                    {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-[#1B2A4A] uppercase tracking-wider flex items-center gap-1">
                                    <Calendar size={12} /> तारीख
                                </label>
                                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-[#1B2A4A]" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-[#1B2A4A] uppercase tracking-wider">पेमेंट स्थिती</label>
                                <div className="flex bg-gray-100 p-1.5 rounded-lg border-2 border-gray-200">
                                    {(['Paid', 'Pending', 'Partial'] as const).map((s) => (
                                        <button key={s} onClick={() => setStatus(s)}
                                            className={`flex-1 py-2 rounded-md text-[10px] font-black transition-all ${status === s ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>
                                            {s.toUpperCase()}
                                        </button>
                                    ))}
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
                                    <th className="px-4 py-4">तपशील (Product Description)</th>
                                    <th className="px-4 py-4 w-24 text-right">Qty</th>
                                    <th className="px-4 py-4 w-32 text-right">Rate</th>
                                    <th className="px-4 py-4 w-32 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.map((item) => (
                                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => setItems(items.length > 1 ? items.filter(i => i.id !== item.id) : items)} className="text-red-300 hover:text-red-600">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <input type="text" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                                className="w-full bg-transparent outline-none text-sm font-bold text-gray-700" placeholder="Product name..." />
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
                        <div className="p-4 bg-gray-50/50 border-t">
                            <button onClick={() => setItems([...items, { id: Date.now(), description: '', qty: 1, price: 0, amount: 0 }])}
                                className="text-[11px] font-black text-blue-700 uppercase flex items-center hover:underline">
                                <Plus size={16} className="mr-1" /> नवीन आयटम जोडा
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDEBAR - Recent Bills */}
                <div className="bg-[#1B2A4A] rounded-xl shadow-xl flex flex-col overflow-hidden max-h-[500px] lg:max-h-full">
                    <div className="p-4 border-b border-blue-800 bg-white/5 font-black text-xs text-blue-200 uppercase flex items-center">
                        <Info size={14} className="mr-2 text-[#36BA7F]" /> अलीकडील बिले (Recent Bills)
                    </div>
                    <div className="p-3 space-y-2 overflow-y-auto flex-1">
                        {recentEntries?.filter(e => e.entryType === 'बिल').map((entry) => (
                            <div key={entry.id} onClick={() => navigate('/bill', { state: { editData: entry } })}
                                className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-all">
                                <div className="flex justify-between items-center">
                                    <div className="min-w-0">
                                        <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase bg-blue-500/20 text-blue-400">INV</span>
                                        <span className="text-xs font-bold text-white block truncate mt-1">{entry.paidTo}</span>
                                        <span className="text-[9px] text-gray-400 block">{entry.date}</span>
                                    </div>
                                    <div className="text-sm font-black text-[#36BA7F]">
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
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Remarks / टिपणी</label>
                    <input value={remarks} onChange={(e) => setRemarks(e.target.value)}
                        className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-lg text-sm font-bold outline-none focus:border-[#1B2A4A]" placeholder="Note..." />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-8 w-full md:w-auto">
                    <div className="text-right">
                        <label className="text-[11px] font-black text-[#1B2A4A] uppercase block tracking-tighter">Payment Method</label>
                        <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                            className="bg-blue-50 text-blue-900 border-none rounded-lg px-4 py-2 text-sm font-black outline-none mt-1">
                            <option value="Cash">CASH</option>
                            <option value="UPI">UPI / G-PAY</option>
                            {uniqueBankList.map((bank) => <option key={bank.id} value={bank.bankName}>{bank.bankName.toUpperCase()}</option>)}
                        </select>
                    </div>

                    <div className="text-right px-6 border-l-2 border-gray-100">
                        <p className="text-[11px] font-black text-gray-400 uppercase">एकूण बिल (Total Amount)</p>
                        <h3 className="text-3xl font-black text-[#1B2A4A] leading-none mt-1">
                            ₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </h3>
                    </div>

                    <button onClick={handleSave}
                        className="w-full md:w-auto bg-[#36BA7F] hover:bg-[#2da36e] text-white font-black py-4 px-12 rounded-xl shadow-lg flex items-center justify-center transition-all active:scale-95 group">
                        <Save size={20} className="mr-2 group-hover:animate-pulse" />
                        {editId ? "अपडेट करा" : "बिल सेव्ह करा"}
                    </button>
                </div>
            </div>
        </div>
    );
}