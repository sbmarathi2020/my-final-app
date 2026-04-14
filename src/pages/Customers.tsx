import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserPlus, Users, Loader2, MapPin, Phone, Trash2, Edit, X } from 'lucide-react';
import { db, type Customer } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

const Customers = () => {
    const customers = useLiveQuery(() => db.customers.toArray()) || [];

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false);

    // एडिट करण्यासाठी स्टेट
    const [editingId, setEditingId] = useState<number | null>(null);
    
    useEffect(() => {
        syncCustomers();
    }, []);

    const syncCustomers = async () => {
        try {
            const { data, error } = await supabase.from('customers').select('*').order('name');
            if (error) throw error;
            if (data) {
                await db.customers.clear();
                await db.customers.bulkAdd(data);
            }
        } catch (err) {
            console.error('Sync Error:', err);
        }
    };

    // एडिट मोड सुरू करणे
    const startEdit = (c: Customer) => {
        setEditingId(c.id || null);
        // setSupabaseId काढल्यामुळे ती ओळ येथे लागणार नाही
        setName(c.name);
        setPhone(c.phone || '');
        setAddress(c.address || '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // एडिट मोड रद्द करणे
    const cancelEdit = () => {
        setEditingId(null);
        setName('');
        setPhone('');
        setAddress('');
    };

    const handleSave = async () => {
        if (!name.trim()) {
            alert("कृपया ग्राहकाचे नाव टाका!");
            return;
        }

        setLoading(true);
        try {
            const { data: authData } = await supabase.auth.getUser();
            const user = authData?.user;
            if (!user) throw new Error("लॉगिन सत्र संपले आहे.");

            const customerPayload = {
                user_id: user.id,
                name: name.trim(),
                phone: phone.trim(),
                address: address.trim()
            };

            if (editingId) {
                // १. अपडेट (Update) लॉजिक
                const { error: upError } = await supabase
                    .from('customers')
                    .update(customerPayload)
                    .eq('id', editingId); // जर id UUID असेल तर

                if (upError) throw upError;

                await db.customers.update(editingId, customerPayload);
                alert("माहिती अपडेट झाली!");
            } else {
                // २. नवीन भरती (Insert) लॉजिक
                const { data: supabaseData, error: insError } = await supabase
                    .from('customers')
                    .insert([customerPayload])
                    .select();

                if (insError) throw insError;

                if (supabaseData && supabaseData[0]) {
                    await db.customers.add(supabaseData[0]);
                }
                alert("ग्राहक यशस्वीरित्या जोडला!");
            }

            cancelEdit();
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            alert("त्रुटी: " + errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const deleteCustomer = async (id: number) => {
        if (!confirm("हा ग्राहक डिलीट करायचा का?")) return;

        try {
            // Supabase मध्ये ID string असू शकतो, म्हणून String(id) वापरले आहे
            await supabase.from('customers').delete().eq('id', String(id));
            await db.customers.delete(id);
        } catch (error) {
            console.error("Delete Error:", error);
            alert("डिलीट करताना त्रुटी आली.");
        }
    };

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-blue-50/30">
                    <h2 className="text-xl font-black flex items-center gap-2 text-blue-900">
                        <Users className="text-blue-600" /> ग्राहक व्यवस्थापन
                    </h2>
                    <span className="text-[10px] font-black bg-blue-600 text-white px-3 py-1 rounded-full uppercase">
                        एकूण: {customers.length}
                    </span>
                </div>

                {/* इनपुट फॉर्म */}
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">नाव</label>
                            <input
                                type="text"
                                placeholder="ग्राहकाचे नाव *"
                                className="w-full border border-gray-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">मोबाईल</label>
                            <input
                                type="tel"
                                placeholder="मोबाईल नंबर"
                                className="w-full border border-gray-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">पत्ता</label>
                            <input
                                type="text"
                                placeholder="पत्ता"
                                className="w-full border border-gray-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className={`flex-1 ${editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : (editingId ? <Edit size={18} /> : <UserPlus size={18} />)}
                            {editingId ? 'बदल जतन करा' : 'नवीन ग्राहक नोंदवा'}
                        </button>

                        {editingId && (
                            <button
                                onClick={cancelEdit}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 rounded-xl transition-all"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                </div>

                {/* ग्राहक यादी */}
                <div className="p-6 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customers.map((c: Customer) => (
                            <div key={c.id || Math.random()} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center group hover:border-blue-200 transition-all">
                                <div className="space-y-1">
                                    <h3 className="font-bold text-gray-800">{c.name}</h3>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                        {c.phone && <p className="text-[11px] text-gray-500 flex items-center gap-1"><Phone size={10} /> {c.phone}</p>}
                                        {c.address && <p className="text-[11px] text-gray-500 flex items-center gap-1"><MapPin size={10} /> {c.address}</p>}
                                    </div>
                                </div>

                                <div className="flex gap-1">
                                    <button
                                        onClick={() => startEdit(c)}
                                        className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="एडिट करा"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            // id number किंवा string असू शकतो, तो योग्यरित्या पास करा
                                            if (c.id !== undefined) deleteCustomer(Number(c.id));
                                        }}
                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="डिलीट करा"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {customers.length === 0 && (
                        <div className="text-center py-10 text-gray-400 text-sm italic">
                            अद्याप कोणतेही ग्राहक जोडलेले नाहीत.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Customers;