import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
    LayoutDashboard, PlusCircle, History, Wallet,
    Users, FileText, Download, RefreshCw, Settings, User as UserIcon, Menu, X, LogOut, Landmark, Package
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

// पेजेस इम्पोर्ट करा
import Dashboard from './pages/Dashboard';
import NewEntry from './pages/NewEntry';
import CashInHand from './pages/CashInHand';
import BankBalance from './pages/BankBalance';
import RecentEntriesPage from './pages/RecentEntriesPage';
import Customers from './pages/Customers';
import Bills from './pages/Bills';
import Items from './pages/Items';
import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });

// १. भाषा शब्दावली (Translations)
const translations = {
    mr: {
        dashboard: "मुख्य डॅशबोर्ड",
        newEntry: "नवीन नोंद",
        allEntries: "सर्व व्यवहार",
        cashInHand: "नगद शिल्लक",
        bankBalance: "बँक शिल्लक",
        customers: "ग्राहक",
        bills: "बिले व इनव्हॉइस",
        stock: "स्टॉक व्यवस्थापन",
        export: "डेटा एक्सपोर्ट",
        refresh: "रिफ्रेश",
        logout: "लॉगआउट",
        loading: "लोड होत आहे...",
        loginText: "Gmail ने लॉगिन करा",
        secureLogin: "सुरक्षित लॉगिन करा",
        management: "व्यवस्थापन",
        transactions: "व्यवहार",
        logoutConfirm: "तुम्हाला लॉगआउट करायचे आहे का?",
        userDefault: "वापरकर्ता"
    },
    en: {
        dashboard: "Dashboard",
        newEntry: "New Entry",
        allEntries: "All Transactions",
        cashInHand: "Cash Balance",
        bankBalance: "Bank Balance",
        customers: "Customers",
        bills: "Bills & Invoices",
        stock: "Stock Management",
        export: "Export Data",
        refresh: "Refresh",
        logout: "Logout",
        loading: "Loading...",
        loginText: "Login with Gmail",
        secureLogin: "Secure Login",
        management: "MANAGEMENT",
        transactions: "TRANSACTIONS",
        logoutConfirm: "Do you want to logout?",
        userDefault: "User"
    }
};

type TabId = 'Dashboard' | 'NewEntry' | 'RecentEntriesPage' | 'CashInHand' | 'BankBalance' | 'Customers' | 'Bills' | 'Items';

interface SidebarButtonProps {
    icon: LucideIcon;
    label: string;
    id: TabId;
    color?: string;
}

function App() {
    const [activeTab, setActiveTab] = useState<TabId>('Dashboard');
    const [isSidebarOpen, setSidebarOpen] = useState<boolean>(false);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [lang, setLang] = useState<'mr' | 'en'>('mr');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false); // ड्रॉपडाउनसाठी स्टेट

    const t = translations[lang];

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, _session) => {
            setUser(_session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    };

    const handleLogout = async () => {
        if (window.confirm(t.logoutConfirm)) {
            await supabase.auth.signOut();
        }
    };

    // भाषा बदलण्याचे फंक्शन
    <button
        onClick={() => {
            setLang(prev => prev === 'mr' ? 'en' : 'mr'); // थेट स्टेट बदला
            setIsSettingsOpen(false);
        }}
        className="w-full flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
    >
        <RefreshCw size={16} className="mr-3 text-blue-600" />
        {lang === 'mr' ? 'Switch to English' : 'मराठीमध्ये बदला'}
    </button>

    const SidebarButton = ({ icon: Icon, label, id, color = "white" }: SidebarButtonProps) => (
        <button
            onClick={() => {
                setActiveTab(id);
                setSidebarOpen(false);
            }}
            className={`w-full flex items-center px-4 py-3 mb-1 rounded-lg transition-all cursor-pointer ${activeTab === id ? 'bg-blue-600 shadow-lg' : 'hover:bg-[#2B3A5A]'
                }`}
        >
            <Icon size={20} color={activeTab === id ? "white" : color} className="mr-4" />
            <span className={`text-sm font-medium ${activeTab === id ? 'text-white' : 'text-gray-300'}`}>{label}</span>
        </button>
    );

    if (loading) return <div className="h-screen flex items-center justify-center font-bold text-[#1B2A4A] bg-[#F9FAFE]">{t.loading}</div>;

    if (!user) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-[#1B2A4A] text-white p-6 text-center font-sans">
                <div className="bg-white p-8 rounded-2xl shadow-2xl text-[#1B2A4A] max-w-sm w-full">
                    <h1 className="text-2xl font-black mb-2 tracking-tight">Vihaan Tracker</h1>
                    <p className="text-gray-500 mb-6 text-sm italic">{t.secureLogin}</p>
                    <button
                        onClick={handleLogin}
                        className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg active:scale-95"
                    >
                        <UserIcon size={20} /> {t.loginText}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#F9FAFE] overflow-hidden font-sans">
            <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-[#1B2A4A] flex flex-col transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>

                <div className="p-6 flex flex-col items-center border-b border-[#2B3A5A]">
                    <div className="w-full flex justify-between items-center mb-4 relative">

                        {/* Settings Button & Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                className="text-white opacity-70 hover:opacity-100 transition-all p-1 hover:bg-[#2B3A5A] rounded-md"
                            >
                                <Settings size={20} />
                            </button>

                            {/* ड्रॉपडाउन मेनू */}
                            {isSettingsOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsSettingsOpen(false)}></div>
                                    <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-2xl z-20 py-2 border border-gray-100 animate-in fade-in zoom-in duration-200">

                                        {/* भाषा बदलण्याचे बटण */}
                                        <button
                                            onClick={() => { setLang(lang === 'mr' ? 'en' : 'mr'); setIsSettingsOpen(false); }}
                                            className="w-full flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                                        >
                                            <RefreshCw size={16} className="mr-3 text-blue-600" />
                                            {lang === 'mr' ? 'Switch to English' : 'मराठीमध्ये बदला'}
                                        </button>

                                        <div className="border-t border-gray-100 my-1"></div>

                                        {/* लॉगआउट बटण */}
                                        <button
                                            onClick={() => { handleLogout(); setIsSettingsOpen(false); }}
                                            className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <LogOut size={16} className="mr-3" />
                                            {t.logout}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        <button className="md:hidden text-white" onClick={() => setSidebarOpen(false)}>
                            <X size={24} />
                        </button>
                    </div>

                    {/* Profile Section */}
                    <div className="w-16 h-16 rounded-full border-2 border-white overflow-hidden shadow-md bg-[#0D1A30] flex items-center justify-center">
                        {user.user_metadata?.avatar_url ? (
                            <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <UserIcon size={32} color="white" />
                        )}
                    </div>
                    <h2 className="mt-3 text-white font-bold text-sm text-center">
                        {user.user_metadata?.full_name || t.userDefault}
                    </h2>
                </div>

                <nav className="flex-1 px-3 mt-4 overflow-y-auto scrollbar-hide">
                    <SidebarButton icon={LayoutDashboard} label={t.dashboard} id="Dashboard" />

                    <div className="mt-6 px-4 mb-2 text-[10px] font-black text-blue-400 uppercase tracking-[0.1em]">{t.transactions}</div>
                    <SidebarButton icon={PlusCircle} label={t.newEntry} id="NewEntry" color="#3b82f6" />
                    <SidebarButton icon={History} label={t.allEntries} id="RecentEntriesPage" />

                    <div className="mt-6 px-4 mb-2 text-[10px] font-black text-orange-400 uppercase tracking-[0.1em]">{t.management}</div>
                    <SidebarButton icon={Wallet} label={t.cashInHand} id="CashInHand" color="#fbbf24" />
                    <SidebarButton icon={Landmark} label={t.bankBalance} id="BankBalance" color="#60a5fa" />
                    <SidebarButton icon={Users} label={t.customers} id="Customers" />
                    <SidebarButton icon={FileText} label={t.bills} id="Bills" />
                    <SidebarButton icon={Package} label={t.stock} id="Items" color="#a78bfa" />
                </nav>

                <div className="p-4 border-t border-[#3A4A6A] space-y-1">
                    <button className="w-full flex items-center text-white text-[11px] opacity-70 hover:opacity-100 py-2 px-3 hover:bg-[#2B3A5A] rounded-lg transition-all">
                        <Download size={14} className="mr-3" /> {t.export}
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center">
                        <button className="mr-4 p-2 text-[#1B2A4A] md:hidden hover:bg-gray-100 rounded-lg transition-colors" onClick={() => setSidebarOpen(true)}>
                            <Menu size={24} />
                        </button>
                        <h1 className="text-lg md:text-xl font-black text-[#1B2A4A] tracking-tight uppercase">
                            {activeTab === 'Dashboard' ? t.dashboard :
                                activeTab === 'Bills' ? t.bills :
                                    activeTab === 'NewEntry' ? t.newEntry :
                                        activeTab === 'RecentEntriesPage' ? t.allEntries :
                                            activeTab === 'Customers' ? t.customers :
                                                activeTab === 'CashInHand' ? t.cashInHand :
                                                    activeTab === 'BankBalance' ? t.bankBalance :
                                                        activeTab === 'Items' ? t.stock : activeTab}
                        </h1>
                    </div>

                    <div className="flex gap-1.5 md:gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {/* New Entry Button */}
                        <button
                            onClick={() => setActiveTab('NewEntry')}
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-full transition-all border ${activeTab === 'NewEntry' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'}`}
                        >
                            <PlusCircle size={14} />
                            <span className="font-bold text-[10px] md:text-xs">New Entry</span>
                        </button>

                        {/* Stock Button */}
                        <button
                            onClick={() => setActiveTab('Items')}
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-full transition-all border ${activeTab === 'Items' ? 'bg-violet-600 text-white border-violet-600' : 'bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-100'}`}
                        >
                            <Package size={14} />
                            <span className="font-bold text-[10px] md:text-xs">Stock</span>
                        </button>

                        {/* Cash Button - नवीन जोडलेले बटण */}
                        <button
                            onClick={() => setActiveTab('CashInHand')}
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-full transition-all border ${activeTab === 'CashInHand' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'}`}
                        >
                            <Wallet size={14} />
                            <span className="font-bold text-[10px] md:text-xs">Cash</span>
                        </button>

                        {/* Bank Button */}
                        <button
                            onClick={() => setActiveTab('BankBalance')}
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-full transition-all border ${activeTab === 'BankBalance' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}
                        >
                            <Landmark size={14} />
                            <span className="font-bold text-[10px] md:text-xs">Bank</span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-4 md:p-8 bg-[#F9FAFE] scrollbar-hide">
                    <div className="max-w-7xl mx-auto min-h-full">
                        {activeTab === 'Dashboard' && <Dashboard />}
                        {activeTab === 'NewEntry' && <NewEntry />}
                        {activeTab === 'RecentEntriesPage' && (
                            <RecentEntriesPage
                                setActiveTab={(tab: string) => setActiveTab(tab as typeof activeTab)}
                            />
                        )}
                        {activeTab === 'CashInHand' && <CashInHand />}
                        {activeTab === 'BankBalance' && <BankBalance />}
                        {activeTab === 'Customers' && <Customers />}
                        {activeTab === 'Bills' && <Bills />}
                        {activeTab === 'Items' && <Items />}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;