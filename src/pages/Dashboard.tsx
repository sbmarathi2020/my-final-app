import { supabase } from '../supabaseClient';
import { useState, useEffect, useMemo } from 'react';
// १. 'import type' चा वापर करून ValueType इंपोर्ट केले (verbatimModuleSyntax साठी)
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';
import {
    CreditCard, ArrowUpCircle, ArrowDownCircle,
    TrendingUp, Landmark, Banknote
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from 'recharts';

// --- Interfaces ---

interface StatCardProps {
    title: string;
    amount: number;
    icon: LucideIcon;
    color: string;
    iconColor: string;
}

interface Entry {
    id: string;
    date: string;
    paid_to: string;
    amount: number;
    entry_type: 'जमा' | 'खर्च' | 'बचत';
    payment_mode: string;
    category: string;
}

interface ChartDataPoint {
    name: string;
    value: number;
    color: string;
}

export default function Dashboard() {
    const [allEntries, setAllEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchEntries = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('entries')
            .select('*')
            .order('date', { ascending: false });

        if (!error && data) {
            setAllEntries(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchEntries();

        const subscription = supabase
            .channel('entries-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, fetchEntries)
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    const stats = useMemo(() => {
        let income = 0; let expense = 0; let savings = 0;
        let bankBal = 0; let cashBal = 0;

        allEntries.forEach(curr => {
            const amt = Number(curr.amount) || 0;
            if (curr.entry_type === 'जमा') income += amt;
            else if (curr.entry_type === 'खर्च') expense += amt;
            else if (curr.entry_type === 'बचत') savings += amt;

            if (curr.payment_mode === 'Cash') {
                if (curr.entry_type === 'जमा') cashBal += amt;
                else cashBal -= amt;
            } else {
                if (curr.entry_type === 'जमा') bankBal += amt;
                else bankBal -= amt;
            }
        });

        return { income, expense, savings, totalBalance: income - expense - savings, bankBal, cashBal };
    }, [allEntries]);

    const chartData: ChartDataPoint[] = [
        { name: 'जमा', value: stats.income, color: '#4CAF50' },
        { name: 'खर्च', value: stats.expense, color: '#F44336' },
        { name: 'बचत', value: stats.savings, color: '#FF9800' },
    ];

    // २. Tooltip साठी सुरक्षित फॉर्मॅटर फंक्शन (undefined चेकसह)
    const renderTooltipValue = (value: ValueType | undefined): [string, string] => {
        const numValue = value ? Number(value) : 0;
        return [`₹ ${numValue.toLocaleString('en-IN')}`, "रक्कम"];
    };

    const StatCard = ({ title, amount, icon: Icon, color, iconColor }: StatCardProps) => (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-gray-400 text-[10px] font-black uppercase tracking-wider">{title}</span>
                <Icon size={16} className={iconColor} />
            </div>
            <h2 className={`text-xl font-bold ${color}`}>
                ₹ {amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h2>
        </div>
    );

    if (loading) return <div className="p-10 text-center text-gray-500 font-bold">माहिती लोड होत आहे...</div>;

    return (
        <div className="p-4 space-y-6 bg-[#F9FAFE] min-h-screen font-sans">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard title="नेट शिल्लक (Total)" amount={stats.totalBalance} icon={CreditCard} color="text-[#1976D2]" iconColor="text-[#1976D2]" />
                <StatCard title="एकूण जमा" amount={stats.income} icon={ArrowUpCircle} color="text-[#4CAF50]" iconColor="text-[#4CAF50]" />
                <StatCard title="एकूण खर्च" amount={stats.expense} icon={ArrowDownCircle} color="text-[#F44336]" iconColor="text-[#F44336]" />
                <StatCard title="बचत (Savings)" amount={stats.savings} icon={TrendingUp} color="text-[#FF5722]" iconColor="text-[#FF5722]" />
                <StatCard title="बँक शिल्लक" amount={stats.bankBal} icon={Landmark} color="text-[#9C27B0]" iconColor="text-[#9C27B0]" />
                <StatCard title="नगद (Cash)" amount={stats.cashBal} icon={Banknote} color="text-[#FF9800]" iconColor="text-[#FF9800]" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm h-80">
                        <h3 className="text-[10px] font-black mb-4 text-gray-400 uppercase tracking-widest">वर्गीकरण</h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {chartData.map((entry, index) => (
                                        <Cell key={`pie-cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={renderTooltipValue} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm h-80">
                        <h3 className="text-[10px] font-black mb-4 text-gray-400 uppercase tracking-widest">आर्थिक तुलना</h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={chartData}>
                                <XAxis dataKey="name" fontSize={10} fontWeight="bold" />
                                <YAxis fontSize={10} />
                                <Tooltip formatter={renderTooltipValue} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`bar-cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                    <h3 className="text-[10px] font-black mb-4 text-[#1B2A4A] uppercase tracking-widest">अलीकडील व्यवहार</h3>
                    <div className="overflow-auto flex-1 scrollbar-hide">
                        <table className="w-full text-[11px] text-left">
                            <thead className="sticky top-0 bg-white">
                                <tr className="text-gray-400 font-bold uppercase tracking-tighter border-b border-gray-50">
                                    <th className="py-2">तारीख</th>
                                    <th className="py-2">तपशील</th>
                                    <th className="py-2 text-right">रक्कम</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {allEntries.length === 0 ? (
                                    <tr><td colSpan={3} className="py-10 text-center text-gray-400 italic">माहिती उपलब्ध नाही</td></tr>
                                ) : (
                                    allEntries.slice(0, 10).map((entry) => (
                                        <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-3 text-gray-500">
                                                {new Intl.DateTimeFormat('mr-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(entry.date))}
                                            </td>
                                            <td className="py-3 font-bold text-gray-700">
                                                {entry.paid_to}
                                                <div className="text-[9px] font-normal text-gray-400">{entry.payment_mode}</div>
                                            </td>
                                            <td className={`py-3 text-right font-black ${entry.entry_type === 'जमा' ? 'text-green-600' : entry.entry_type === 'बचत' ? 'text-orange-500' : 'text-red-500'}`}>
                                                ₹{Number(entry.amount).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}