import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, Save, Wallet, Loader2, History, PiggyBank, FileText } from 'lucide-react';

// १. इंटरफेस व्याख्या
interface CashEntry {
    id: string;
    date: string;
    entry_type: string;
    payment_mode: string;
    paid_to: string;
    remarks: string;
    amount: number;
    expense_no: string;
    status?: string;
}

const CashInHand = () => {
    const [entries, setEntries] = useState<CashEntry[]>([]);
    const [totalCash, setTotalCash] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const initialFormState = {
        date: new Date().toISOString().split('T')[0],
        entry_type: 'जमा' as 'जमा' | 'खर्च' | 'बचत' | 'बिल',
        payment_mode: 'Cash',
        paid_to: '',
        remarks: '',
        amount: '',
        expense_no: `CSH-${Date.now()}`
    };

    const [formData, setFormData] = useState(initialFormState);

    // २. डेटा मिळवणे आणि बॅलन्स मोजणे
    const fetchCashBalance = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('entries')
                .select('*')
                // .eq('payment_mode', 'Cash') // अचूक मॅचसाठी eq वापरा
                .or('payment_mode.ilike.cash') // जर स्पेलिंग मध्ये फरक असेल तरी चालेल
                .order('date', { ascending: false });

            if (error) throw error;

            const fetchedData = (data as CashEntry[]) || [];
            setEntries(fetchedData);

            const total = fetchedData.reduce((acc, curr) => {
                const val = Math.abs(Number(curr.amount) || 0);
                const type = curr.entry_type;
                const status = curr.status?.toLowerCase();

                // जर एंट्री 'Pending' असेल तर ती बॅलन्समध्ये धरायची नाही
                if (status === 'pending') return acc;

                // 'जमा' किंवा 'बिल' असेल तर रक्कम प्लस करा
                if (type === 'जमा' || type === 'बिल' || type === 'Bill' || type === 'bill') {
                    return acc + val;
                }

                // 'खर्च' किंवा 'बचत' असेल तर रक्कम मायनस करा
                if (type === 'खर्च' || type === 'बचत' || type === 'Expense' || type === 'Savings') {
                    return acc - val;
                }

                return acc;
            }, 0);

            setTotalCash(total);
        } catch (err: unknown) {
            console.error("Error fetching cash data:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCashBalance();
    }, [fetchCashBalance]);

    // ४. सेव्ह लॉजिक
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            alert("कृपया योग्य रक्कम टाका");
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("लॉगिन सत्र संपले आहे.");

            const amountNum = parseFloat(formData.amount);

            // 'जमा' किंवा 'बिल' असेल तर पॉझिटिव्ह, अन्यथा खर्च म्हणून नेगेटिव्ह साठवा
            const finalAmount = (formData.entry_type === 'जमा' || formData.entry_type === 'बिल')
                ? amountNum : -Math.abs(amountNum);

            const { error } = await supabase
                .from('entries')
                .insert([{
                    user_id: user.id,
                    date: formData.date,
                    entry_type: formData.entry_type,
                    payment_mode: 'Cash',
                    paid_to: formData.paid_to,
                    remarks: formData.remarks,
                    amount: finalAmount,
                    expense_no: formData.expense_no,
                    status: 'Paid',
                    category: formData.entry_type === 'बचत' ? 'Savings' : 'Cash Transaction',
                    isInvoice: formData.entry_type === 'बिल' ? true : false
                }]);

            if (error) throw error;

            setIsModalOpen(false);
            setFormData({ ...initialFormState, expense_no: `CSH-${Date.now()}` });
            fetchCashBalance();
        } catch (err: unknown) {
            const error = err as Error;
            alert(error.message || "काहीतरी त्रुटी आली!");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-6 bg-[#FDFCFB] min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Wallet className="text-green-600" size={28} /> रोख रक्कम
                    </h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Cash In Hand Management</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 w-full md:w-auto justify-center"
                >
                    <Plus size={20} /> नवीन कॅश नोंद
                </button>
            </div>

            {/* Total Balance Card */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-8 max-w-sm">
                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">उपलब्ध रोकड</span>
                <h2 className={`text-4xl font-black mt-1 ${totalCash >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                    ₹{totalCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h2>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center gap-2 font-bold text-slate-700 bg-slate-50/30">
                    <History size={18} className="text-slate-400" /> अलीकडील व्यवहार
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-6 py-4 text-slate-500 font-bold text-[10px] uppercase tracking-wider">तारीख / तपशील</th>
                                <th className="px-6 py-4 text-slate-500 font-bold text-[10px] uppercase tracking-wider text-center">प्रकार</th>
                                <th className="px-6 py-4 text-slate-500 font-bold text-[10px] uppercase tracking-wider text-right">रक्कम</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={3} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-green-600" /></td></tr>
                            ) : entries.length === 0 ? (
                                <tr><td colSpan={3} className="p-10 text-center text-slate-400 italic">अद्याप कोणतीही नोंद नाही.</td></tr>
                            ) : (
                                entries.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-slate-700">
                                                {new Date(item.date).toLocaleDateString('en-GB')}
                                            </div>
                                            <div className="text-[11px] text-slate-400 font-medium">{item.paid_to || 'Self'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter inline-flex items-center gap-1 ${(item.entry_type === 'जमा' || item.entry_type === 'बिल') ? 'bg-green-100 text-green-700' :
                                                item.entry_type === 'बचत' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {item.entry_type === 'बिल' && <FileText size={10} />}
                                                {item.entry_type === 'बचत' && <PiggyBank size={10} />}
                                                {item.entry_type}
                                                {item.status?.toLowerCase() === 'pending' && <span className="ml-1 text-[8px] text-red-500 font-bold">(PENDING)</span>}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 text-right font-black text-sm ${(item.entry_type === 'जमा' || item.entry_type === 'बिल') ? 'text-green-600' : 'text-red-500'
                                            }`}>
                                            ₹{Math.abs(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal - Manual Entry */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-800 p-6 flex justify-between items-center text-white">
                            <h3 className="font-bold text-white uppercase tracking-widest text-sm">नवीन रोख व्यवहार</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">तारीख</label>
                                    <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-green-500/20" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">रक्कम (₹)</label>
                                    <input type="number" step="0.01" required placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-black text-green-700 outline-none focus:ring-2 focus:ring-green-500/20" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">व्यवहार प्रकार</label>
                                <div className="grid grid-cols-4 gap-2 mt-1">
                                    {(['जमा', 'खर्च', 'बचत', 'बिल'] as const).map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, entry_type: type })}
                                            className={`py-2 rounded-xl text-[11px] font-bold border transition-all ${formData.entry_type === type
                                                ? 'bg-green-600 border-green-600 text-white shadow-md'
                                                : 'bg-white border-slate-100 text-slate-500'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">तपशील</label>
                                <input type="text" placeholder="कोणाकडून / कोणाला?" required value={formData.paid_to} onChange={(e) => setFormData({ ...formData, paid_to: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-green-500/20 mb-3" />
                                <textarea placeholder="इतर माहिती (पर्यायी)..." rows={2} value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-semibold outline-none resize-none focus:ring-2 focus:ring-green-500/20" />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                सुरक्षित करा
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashInHand;