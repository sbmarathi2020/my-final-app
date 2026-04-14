import { useState } from 'react';
import { db, type FinancialEntry } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '../supabaseClient';
import {
    Trash2, Edit, Search,
    ArrowUpCircle, ArrowDownCircle, PiggyBank, Loader2
} from 'lucide-react';

interface RecentEntriesProps {
    // string ऐवजी आपण वर डिफाइन केलेली TabId किंवा (tab: any) च्या ऐवजी अचूक टाइप वापरा
    setActiveTab: (tab: 'Dashboard' | 'NewEntry' | 'RecentEntriesPage' | 'CashInHand' | 'BankBalance') => void;
}

export default function RecentEntriesPage({ setActiveTab }: RecentEntriesProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('All');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    // Dexie मधून डेटा मिळवणे
    const allEntries = useLiveQuery(() =>
        db.entries.orderBy('date').reverse().toArray()
    );

    // फिल्टर लॉजिक
    const filteredEntries = allEntries?.filter(entry => {
        const matchesSearch =
            (entry.paidTo?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (entry.expenseNo?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (entry.category?.toLowerCase() || "").includes(searchTerm.toLowerCase());

        const matchesFilter = filterType === 'All' || entry.entryType === filterType;
        return matchesSearch && matchesFilter;
    });

    // एडिट फंक्शन
    const handleEdit = (entry: FinancialEntry) => {
        try {
            localStorage.setItem('edit_entry_data', JSON.stringify(entry));
            setActiveTab('NewEntry');
        } catch (err) {
            console.error("Error saving to localStorage", err);
        }
    };

    // डिलीट फंक्शन
    const handleDelete = async (id: number, expenseNo: string) => {
        if (!window.confirm("तुम्हाला खात्री आहे की तुम्ही ही नोंद हटवू इच्छिता?")) return;

        setIsDeleting(expenseNo);
        try {
            // १. प्रथम Supabase मधून डिलीट करा (जेणेकरून ऑनलाइन एरर आली तर स्थानिक डेटा सुरक्षित राहील)
            const { error } = await supabase
                .from('entries')
                .delete()
                .eq('expense_no', expenseNo);

            if (error) throw error;

            // २. स्थानिक Dexie मधून डिलीट करा
            await db.entries.delete(id);

            // alert("नोंद यशस्वीरित्या हटवली!"); // युजर एक्सपिरियन्ससाठी अलर्ट ऐवजी टोस्ट वापरणे चांगले
        } catch (err) {
            console.error(err);
            alert("डेटा हटवताना समस्या आली. कृपया इंटरनेट तपासा.");
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div className="p-4 space-y-4 bg-gray-50 min-h-screen">
            {/* --- Header & Search --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-black text-gray-800 tracking-tight">मागील सर्व नोंदी</h2>

                <div className="flex flex-1 max-w-md gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="नाव, कॅटेगरी किंवा नंबर शोधा..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="border rounded-lg px-3 py-2 bg-white text-xs font-bold cursor-pointer outline-none focus:ring-2 focus:ring-blue-500"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="All">सर्व</option>
                        <option value="जमा">जमा</option>
                        <option value="खर्च">खर्च</option>
                        <option value="बचत">बचत</option>
                    </select>
                </div>
            </div>

            {/* --- Entries Table --- */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b">
                            <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <th className="px-6 py-4">तारीख / नं.</th>
                                <th className="px-6 py-4">नाव / कॅटेगरी</th>
                                <th className="px-6 py-4">प्रकार</th>
                                <th className="px-6 py-4 text-right">रक्कम</th>
                                <th className="px-6 py-4 text-center">कृती</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {!allEntries ? (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center text-gray-400">
                                        <Loader2 className="animate-spin inline mr-2" size={20} />
                                        डेटा लोड होत आहे...
                                    </td>
                                </tr>
                            ) : filteredEntries?.map((entry) => (
                                <tr key={entry.id} className="hover:bg-blue-50/20 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-gray-800">{entry.date}</div>
                                        <div className="text-[10px] text-gray-400 font-mono">{entry.expenseNo}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-semibold text-gray-700">{entry.paidTo}</div>
                                        <div className="text-[10px] text-gray-400 uppercase font-bold">{entry.category}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-full w-fit ${entry.entryType === 'जमा' ? 'bg-green-100 text-green-700' :
                                                entry.entryType === 'बचत' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {entry.entryType === 'जमा' ? <ArrowUpCircle size={10} /> :
                                                entry.entryType === 'बचत' ? <PiggyBank size={10} /> : <ArrowDownCircle size={10} />}
                                            {entry.entryType}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-black text-sm ${entry.entryType === 'जमा' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        ₹ {Number(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-4">
                                            <button
                                                onClick={() => handleEdit(entry)}
                                                className="text-blue-500 hover:text-blue-700 transition-transform active:scale-90"
                                                disabled={!!isDeleting}
                                            >
                                                <Edit size={18} />
                                            </button>

                                            <button
                                                onClick={() => entry.id && handleDelete(entry.id, entry.expenseNo)}
                                                className="text-red-400 hover:text-red-600 transition-transform active:scale-90 disabled:opacity-50"
                                                disabled={isDeleting === entry.expenseNo}
                                            >
                                                {isDeleting === entry.expenseNo ?
                                                    <Loader2 size={18} className="animate-spin" /> :
                                                    <Trash2 size={18} />
                                                }
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {allEntries && filteredEntries?.length === 0 && (
                        <div className="text-center py-20 text-gray-400 text-sm font-medium italic">
                            कोणतीही नोंद सापडली नाही.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}