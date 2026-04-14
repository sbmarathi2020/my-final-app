import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { X, Save, PiggyBank, Landmark, Loader2, History, Trash2, Edit2, Settings2, Wallet, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { db } from '../db';
import { useNavigate } from 'react-router-dom';

// --- Interfaces ---
interface BankEntry {
    id: string;
    date: string;
    entry_type: 'जमा' | 'खर्च' | 'बचत';
    payment_mode: string;
    paid_to: string;
    remarks: string;
    amount: number;
    expense_no: string;
}

interface BankAccount {
    id?: string;
    account_display_name: string;
    opening_balance: number;
    as_of_date: string;
    print_qr: boolean;
    print_details: boolean;
    account_number: string;
    ifsc_code: string;
    upi_id: string;
    bank_name: string;
    account_holder_name: string;
}

const BankBalance = () => {
    // --- States ---
    const navigate = useNavigate();
    const [entries, setEntries] = useState<BankEntry[]>([]);
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [selectedBankFilter, setSelectedBankFilter] = useState<string>('All');
    const [totalBalance, setTotalBalance] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

    const initialAccountState: BankAccount = {
        account_display_name: '',
        opening_balance: 0,
        as_of_date: new Date().toISOString().split('T')[0],
        print_qr: true,
        print_details: true,
        account_number: '',
        ifsc_code: '',
        upi_id: '',
        bank_name: '',
        account_holder_name: ''
    };

    const [accountFormData, setAccountFormData] = useState<BankAccount>(initialAccountState);

    // --- १. बँकांची यादी मिळवणे ---
    const fetchAccounts = useCallback(async () => {
        const { data, error } = await supabase.from('bank_accounts').select('*');
        if (!error && data) {
            setAccounts(data);
            const dexieData = data.map(bank => ({
                id: bank.id,
                bankName: bank.account_display_name,
                openingBalance: bank.opening_balance || 0,
                currentBalance: bank.opening_balance || 0
            }));
            await db.banks.bulkPut(dexieData);
        }
    }, []);

    // --- २. व्यवहार इतिहास आणि बॅलन्स मिळवणे ---
    const fetchBankData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: accountsData, error: accError } = await supabase.from('bank_accounts').select('*');
            if (accError) throw accError;

            const activeBankNames = accountsData?.map(a => a.account_display_name) || [];
            const validModes = ['UPI', 'G-Pay', 'Cash', ...activeBankNames];

            let query = supabase.from('entries').select('*');
            if (selectedBankFilter !== 'All') {
                query = query.eq('payment_mode', selectedBankFilter);
            } else {
                query = query.in('payment_mode', validModes);
            }

            const { data: entriesData, error: entriesError } = await query.order('date', { ascending: false });
            if (entriesError) throw entriesError;

            const fetchedEntries = (entriesData as BankEntry[]) || [];
            setEntries(fetchedEntries);

            let totalOpeningBal = 0;
            if (selectedBankFilter !== 'All') {
                const currentBank = accountsData?.find(a => a.account_display_name === selectedBankFilter);
                totalOpeningBal = Number(currentBank?.opening_balance || 0);
            } else {
                totalOpeningBal = accountsData?.reduce((acc, curr) => acc + Number(curr.opening_balance || 0), 0) || 0;
            }

            const totalTransactionSum = fetchedEntries.reduce((acc, curr) => {
                const amt = Number(curr.amount || 0);
                // जर प्रकार 'जमा' असेल तर प्लस करा, 'खर्च' असेल तर मायनस
                if (curr.entry_type === 'जमा') {
                    return acc + amt;
                } else if (curr.entry_type === 'खर्च') {
                    return acc - amt;
                } else {
                    return acc; // बचत किंवा इतर प्रकारासाठी
                }
            }, 0);

            setTotalBalance(totalOpeningBal + totalTransactionSum);

        } catch (err: unknown) {
            if (err instanceof Error) console.error("Fetch Error:", err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedBankFilter]);

    useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
    useEffect(() => { fetchBankData(); }, [fetchBankData]);

    const startEditAccount = (acc: BankAccount) => {
        setEditingAccountId(acc.id || null);
        setAccountFormData(acc);
        setIsAccountModalOpen(true);
    };

    const handleDeleteAccount = async (id: string, name: string) => {
        if (!window.confirm(`तुम्हाला '${name}' खाते हटवायचे आहे का?`)) return;
        try {
            setIsSubmitting(true);
            await supabase.from('entries').delete().eq('payment_mode', name);
            const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
            if (error) throw error;
            fetchBankData();
            fetchAccounts();
        } catch (err: unknown) {
            if (err instanceof Error) alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const payload = {
                ...accountFormData,
                user_id: user?.id
            };

            // ID काढावा लागतो कारण तो Supabase स्वतः जनरेट करतो किंवा अपडेटला वेगळा लागतो
            const { id, ...updatePayload } = payload;
            console.log(id); // For TS satisfaction

            if (editingAccountId) {
                await supabase.from('bank_accounts').update(updatePayload).eq('id', editingAccountId);
            } else {
                await supabase.from('bank_accounts').insert([updatePayload]);
            }
            setIsAccountModalOpen(false);
            setAccountFormData(initialAccountState);
            fetchAccounts();
        } catch (err: unknown) {
            if (err instanceof Error) alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-8 bg-[#F1F5F9] min-h-screen font-sans text-slate-900">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
                            <Landmark className="text-white" size={24} />
                        </div>
                        बँक मॅनेजमेंट
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">तुमची खाती आणि व्यवहार ट्रॅक करा</p>
                </div>

                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <select
                        value={selectedBankFilter}
                        onChange={(e) => setSelectedBankFilter(e.target.value)}
                        className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm text-sm"
                    >
                        <option value="All">सर्व बँका</option>
                        {accounts.map((acc) => (
                            <option key={acc.id} value={acc.account_display_name}>{acc.account_display_name}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => { setEditingAccountId(null); setAccountFormData(initialAccountState); setIsAccountModalOpen(true); }}
                        className="bg-white border-2 border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Settings2 size={18} className="text-slate-400" /> खाते जोडा
                    </button>

                  
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stats & Banks */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                            <Wallet size={14} /> एकूण शिल्लक
                        </span>
                        <h2 className={`text-4xl font-black mt-3 tracking-tight ${totalBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                            ₹ {totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </h2>
                        <div className="mt-4 inline-block px-3 py-1 bg-white/10 rounded-lg text-[10px] text-slate-300 font-bold uppercase">
                            {selectedBankFilter === 'All' ? 'सर्व खाती' : selectedBankFilter}
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between font-black text-slate-700 uppercase text-xs tracking-widest">
                            <span className="flex items-center gap-2"><Landmark size={16} className="text-blue-500" /> तुमची बँक खाती</span>
                            <span className="bg-slate-100 px-2 py-1 rounded text-slate-500">{accounts.length}</span>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-50">
                            {accounts.map((acc) => (
                                <div key={acc.id} className="p-5 flex justify-between items-center group hover:bg-blue-50/30 transition-all">
                                    <div>
                                        <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{acc.account_display_name}</div>
                                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">{acc.account_number || 'No Acc No.'}</div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <button onClick={() => startEditAccount(acc)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-xl transition-all">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => acc.id && handleDeleteAccount(acc.id, acc.account_display_name)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-xl transition-all">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Transaction History */}
                <div className="lg:col-span-2 bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-50 flex items-center gap-2 font-black text-slate-700 uppercase text-xs tracking-widest">
                        <History size={16} className="text-blue-500" /> अलीकडील व्यवहार
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-6 py-4 text-slate-400 font-black text-[10px] uppercase tracking-wider">तारीख & तपशील</th>
                                    <th className="px-6 py-4 text-slate-400 font-black text-[10px] uppercase tracking-wider text-center">प्रकार</th>
                                    <th className="px-6 py-4 text-slate-400 font-black text-[10px] uppercase tracking-wider text-right">रक्कम (₹)</th>
                                    <th className="px-6 py-4 text-slate-400 font-black text-[10px] uppercase tracking-wider text-center">कृती</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan={4} className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" size={32} /></td></tr>
                                ) : entries.length === 0 ? (
                                    <tr><td colSpan={4} className="p-20 text-center text-slate-400 font-medium italic">व्यवहार सापडले नाहीत.</td></tr>
                                ) : (
                                    entries.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/80 group transition-all">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-slate-700">{new Date(item.date).toLocaleDateString('en-GB')}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black uppercase">{item.payment_mode}</span>
                                                    <span className="text-xs text-slate-400 font-medium truncate max-w-[150px]">{item.paid_to}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${item.entry_type === 'जमा' ? 'bg-emerald-50 text-emerald-600' :
                                                        item.entry_type === 'बचत' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                                    }`}>
                                                    {item.entry_type === 'जमा' ? <ArrowUpCircle size={12} /> :
                                                        item.entry_type === 'खर्च' ? <ArrowDownCircle size={12} /> : <PiggyBank size={12} />}
                                                    {item.entry_type}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-black text-sm ${item.entry_type === 'जमा' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {item.entry_type === 'जमा' ? '+' : '-'} ₹{Math.abs(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => navigate(`/new-entry?id=${item.id}`)} className="p-2 text-slate-400 hover:text-blue-600 transition-all">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => { if (window.confirm("हटवायचे?")) supabase.from('entries').delete().eq('id', item.id).then(() => fetchBankData()) }} className="p-2 text-slate-400 hover:text-red-500 transition-all">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Account Modal */}
            {isAccountModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in zoom-in duration-200">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                                {editingAccountId ? 'बँक खाते सुधारा' : 'नवीन बँक खाते जोडा'}
                            </h3>
                            <button onClick={() => setIsAccountModalOpen(false)} className="bg-white p-2 rounded-full shadow-sm text-slate-400 hover:text-red-500 transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveAccount} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Account Display Name</label>
                                    <input type="text" required value={accountFormData.account_display_name} onChange={(e) => setAccountFormData({ ...accountFormData, account_display_name: e.target.value })} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl p-4 font-bold text-slate-700 outline-none transition-all" placeholder="उदा. HDFC Bank" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Opening Balance</label>
                                    <input type="number" value={accountFormData.opening_balance} onChange={(e) => setAccountFormData({ ...accountFormData, opening_balance: Number(e.target.value) })} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl p-4 font-bold text-blue-600 outline-none transition-all" />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-[1.5rem] grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input type="text" placeholder="बँकेचे नाव" value={accountFormData.bank_name} onChange={(e) => setAccountFormData({ ...accountFormData, bank_name: e.target.value })} className="bg-white border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none" />
                                <input type="text" placeholder="Account Number" value={accountFormData.account_number} onChange={(e) => setAccountFormData({ ...accountFormData, account_number: e.target.value })} className="bg-white border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none" />
                                <input type="text" placeholder="IFSC Code" value={accountFormData.ifsc_code} onChange={(e) => setAccountFormData({ ...accountFormData, ifsc_code: e.target.value })} className="bg-white border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none" />
                                <input type="text" placeholder="UPI ID" value={accountFormData.upi_id} onChange={(e) => setAccountFormData({ ...accountFormData, upi_id: e.target.value })} className="bg-white border border-slate-200 rounded-xl p-3 text-sm font-semibold outline-none" />
                            </div>

                            <button type="submit" disabled={isSubmitting} className="w-full bg-slate-800 hover:bg-black text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={20} />} सुरक्षित करा
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BankBalance;