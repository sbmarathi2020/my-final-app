import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Package, Plus, Search, X, Edit2, Trash2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

// --- Interfaces ---
interface StockItem {
    id: string;
    item_name: string;
    purchase_price: number;
    sales_price: number;
    current_stock: number;
    unit: string;
}

interface ProductRow {
    productName: string;
    gst: number;
    qty: number;
    unit: string;
    rate: number;
    discount: number;
    amount: number;
}

export default function Items() {
    const [items, setItems] = useState<StockItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [supplierInfo, setSupplierInfo] = useState({
        name: '',
        contact: '',
        company: '',
        address: ''
    });

    const [rows, setRows] = useState<ProductRow[]>([{
        productName: '',
        gst: 0,
        qty: 0,
        unit: 'Nos',
        rate: 0,
        discount: 0,
        amount: 0
    }]);

    useEffect(() => {
        fetchStock();
    }, []);

    const fetchStock = async () => {
        const { data, error } = await supabase.from('items_stock').select('*').order('item_name');
        if (!error && data) setItems(data as StockItem[]);
    };
    const removeRow = (index: number) => {
        if (rows.length > 1) {
            const updatedRows = rows.filter((_, i) => i !== index);
            setRows(updatedRows);
        } else {
            alert("किमान एक ओळ असणे आवश्यक आहे!");
        }
    };

    // --- दुरुस्त केलेले कॅल्क्युलेशन लॉजिक ---
    const handleRowChange = (index: number, field: keyof ProductRow, value: string | number) => {
        const updatedRows = [...rows];

        // विशिष्ट फील्ड अपडेट करणे
        const currentRow = { ...updatedRows[index], [field]: value };

        // आकडेमोड (Calculations)
        const qty = Number(currentRow.qty);
        const rate = Number(currentRow.rate);
        const gst = Number(currentRow.gst);
        const disc = Number(currentRow.discount);

        const basePrice = qty * rate;
        const afterDiscount = basePrice - (basePrice * disc / 100);
        const finalAmount = afterDiscount + (afterDiscount * gst / 100);

        currentRow.amount = finalAmount;
        updatedRows[index] = currentRow;

        setRows(updatedRows);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("हा आयटम कायमचा काढून टाकायचा?")) {
            await supabase.from('items_stock').delete().eq('id', id);
            fetchStock();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            for (const row of rows) {
                // १. आधी तपासा की या नावाचा आयटम आधीच आहे का?
                const { data: existingItem } = await supabase
                    .from('items_stock')
                    .select('id, current_stock')
                    .eq('item_name', row.productName)
                    .single();

                if (existingItem) {
                    // २. जर असेल, तर फक्त स्टॉक अपडेट करा (Upsert सारखे)
                    const newStock = Number(existingItem.current_stock) + Number(row.qty);
                    await supabase
                        .from('items_stock')
                        .update({ current_stock: newStock, purchase_price: row.rate })
                        .eq('id', existingItem.id);
                } else {
                    // ३. नसेल तरच नवीन एन्ट्री करा
                    await supabase
                        .from('items_stock')
                        .insert([{
                            item_name: row.productName,
                            purchase_price: row.rate,
                            sales_price: row.rate * 1.2,
                            current_stock: row.qty,
                            unit: row.unit
                        }]);
                }
            }
            alert("स्टॉक अपडेट झाला!");
            setIsModalOpen(false);
            fetchStock();
        } catch (error: any) {
            alert("त्रुटी: " + error.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#F4F7F9] p-4 font-sans text-[#1B2A4A]">

            {/* --- Stats Section --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-600 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">एकूण आयटम्स</p>
                        <h2 className="text-xl font-black text-blue-900">{items.length}</h2>
                    </div>
                    <Package className="text-blue-100" size={32} />
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">कमी स्टॉक</p>
                        <h2 className="text-xl font-black text-red-600">{items.filter(i => i.current_stock < 5).length}</h2>
                    </div>
                    <ArrowDownCircle className="text-red-100" size={32} />
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">चांगला स्टॉक</p>
                        <h2 className="text-xl font-black text-green-600">{items.filter(i => i.current_stock >= 5).length}</h2>
                    </div>
                    <ArrowUpCircle className="text-green-100" size={32} />
                </div>
            </div>

            {/* --- Main Section --- */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="p-4 bg-[#1B2A4A] flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="आयटम शोधण्यासाठी टाईप करा..."
                            className="pl-10 pr-4 py-2 w-full rounded bg-[#2A3B5A] border-none text-white text-sm focus:ring-2 focus:ring-blue-400 placeholder-gray-400"
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => { setEditingId(null); setIsModalOpen(true); }}
                        className="bg-[#36BA7F] hover:bg-[#2da36e] text-white px-6 py-2 rounded font-bold text-sm flex items-center gap-2 shadow-lg"
                    >
                        <Plus size={18} /> नवीन स्टॉक एन्ट्री
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#EDF2F7] text-[11px] uppercase font-bold text-blue-900 border-b">
                            <tr>
                                <th className="p-4">आयटमचे नाव</th>
                                <th className="p-4">खरेदी किंमत</th>
                                <th className="p-4">विक्री किंमत</th>
                                <th className="p-4 text-center">शिल्लक स्टॉक</th>
                                <th className="p-4">युनिट</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {items.filter(i => i.item_name.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                                <tr key={item.id} className="hover:bg-blue-50 transition-colors group">
                                    <td className="p-4 font-bold text-blue-900">{item.item_name}</td>
                                    <td className="p-4 text-gray-600">₹{item.purchase_price}</td>
                                    <td className="p-4 font-bold text-blue-600">₹{item.sales_price}</td>
                                    <td className={`p-4 text-center font-black ${item.current_stock < 5 ? 'text-red-500' : 'text-gray-700'}`}>{item.current_stock}</td>
                                    <td className="p-4 text-xs text-gray-400 font-medium">{item.unit}</td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                                            <button
                                                onClick={() => { setEditingId(item.id); setIsModalOpen(true); }}
                                                className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="p-2 text-red-500 hover:bg-red-100 rounded">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- Modal --- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-[#1B2A4A]/80 backdrop-blur-sm flex items-center justify-center z-[100] p-2">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl overflow-hidden border-t-8 border-blue-600">
                        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                            <h3 className="font-black text-blue-900 uppercase">
                                {editingId ? 'आयटम दुरुस्त करा' : 'नवीन स्टॉक एन्ट्री / सप्लायर'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[85vh]">
                            {/* Supplier Details */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                                <div className="md:col-span-4 flex justify-between">
                                    <h4 className="text-xs font-black text-blue-800 uppercase">सप्लायरची माहिती</h4>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">सप्लायर नाव</label>
                                    <input type="text" value={supplierInfo.name} onChange={(e) => setSupplierInfo({ ...supplierInfo, name: e.target.value })} className="w-full border rounded p-2 text-sm outline-none focus:border-blue-500" placeholder="नाव" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">संपर्क (Mobile)</label>
                                    <input type="text" value={supplierInfo.contact} onChange={(e) => setSupplierInfo({ ...supplierInfo, contact: e.target.value })} className="w-full border rounded p-2 text-sm outline-none focus:border-blue-500" placeholder="मोबाईल" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">कंपनीचे नाव</label>
                                    <input type="text" value={supplierInfo.company} onChange={(e) => setSupplierInfo({ ...supplierInfo, company: e.target.value })} className="w-full border rounded p-2 text-sm outline-none focus:border-blue-500" placeholder="कंपनी" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">पत्ता</label>
                                    <input type="text" value={supplierInfo.address} onChange={(e) => setSupplierInfo({ ...supplierInfo, address: e.target.value })} className="w-full border rounded p-2 text-sm outline-none focus:border-blue-500" placeholder="शहर/गाव" />
                                </div>
                            </div>

                            {/* Product Table */}
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-[#1B2A4A] text-white text-[10px] uppercase">
                                        <tr>
                                            <th className="p-2 w-12 text-center border-r border-blue-800">No.</th>
                                            <th className="p-2 border-r border-blue-800">Product Name</th>
                                            <th className="p-2 w-20 border-r border-blue-800">GST %</th>
                                            <th className="p-2 w-48 border-r border-blue-800">Qty & Unit</th>
                                            <th className="p-2 w-24 border-r border-blue-800">Rate</th>
                                            <th className="p-2 w-32 border-r border-blue-800">Amount</th>
                                            <th className="p-2 w-12 text-center text-red-400">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-sm">
                                        {rows.map((row, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="p-2 text-center border-r font-bold">{index + 1}</td>
                                                <td className="p-1 border-r">
                                                    <input type="text" value={row.productName} onChange={(e) => handleRowChange(index, 'productName', e.target.value)} className="w-full p-1.5 outline-none" required />
                                                </td>
                                                <td className="p-1 border-r">
                                                    <input type="number" value={row.gst} onChange={(e) => handleRowChange(index, 'gst', Number(e.target.value))} className="w-full p-1.5 text-right outline-none" />
                                                </td>
                                                <td className="p-1 border-r flex gap-1">
                                                    <input type="number" value={row.qty} onChange={(e) => handleRowChange(index, 'qty', Number(e.target.value))} className="w-1/2 p-1.5 text-right outline-none" required />
                                                    <select value={row.unit} onChange={(e) => handleRowChange(index, 'unit', e.target.value)} className="w-1/2 font-bold text-blue-700 outline-none bg-transparent">
                                                        <option value="Nos">नग</option>
                                                        <option value="KG">किलो</option>
                                                    </select>
                                                </td>
                                                <td className="p-1 border-r">
                                                    <input type="number" value={row.rate} onChange={(e) => handleRowChange(index, 'rate', Number(e.target.value))} className="w-full p-1.5 text-right outline-none" required />
                                                </td>
                                                <td className="p-1 bg-blue-50 font-black text-right text-blue-900 border-r">
                                                    ₹ {row.amount.toFixed(2)}
                                                </td>
                                                <td className="p-1 text-center">
                                                    {/* Delete Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeRow(index)}
                                                        className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-between items-center pt-4">
                                <button type="button" onClick={() => setRows([...rows, { productName: '', gst: 0, qty: 0, unit: 'Nos', rate: 0, discount: 0, amount: 0 }])} className="text-blue-600 font-bold text-sm flex items-center gap-1 hover:underline">
                                    <Plus size={16} /> दुसरी ओळ जोडा
                                </button>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 border-2 text-gray-500 rounded font-bold hover:bg-gray-50">रद्द करा</button>
                                    <button type="submit" className="px-10 py-2 bg-[#36BA7F] text-white rounded font-bold shadow-lg hover:bg-[#2da36e]">सेव्ह करा (F8)</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}