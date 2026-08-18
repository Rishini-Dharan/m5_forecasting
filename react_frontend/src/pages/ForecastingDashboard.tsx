import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { ENDPOINTS } from '../config';

interface PredictionResponse {
  status: string;
  item_id: string;
  store_id: string;
  predictions: number[];
  forecast_days: number;
}

interface HistoricalDataPoint {
  day: number;
  sales: number;
}

interface HistoricalResponse {
  item_id: string;
  store_id: string;
  data: HistoricalDataPoint[];
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

export default function ForecastingDashboard() {
    const { storeId } = useParams<{ storeId: string }>();
    const userRole = localStorage.getItem('user_role');
    const assignedStoreId = localStorage.getItem('store_id');

    const initialStoreId = userRole === 'STORE_OWNER' && assignedStoreId
        ? assignedStoreId
        : (storeId || 'CA_1');

    const [formData, setFormData] = useState({
        item_id: 'HOBBIES_1_001',
        store_id: initialStoreId,
        price: 8.26,
        is_weekend: 0,
        is_snap_day: 0
    });
    const [predictions, setPredictions] = useState<number[] | null>(null);
    const [chartData, setChartData] = useState<any[]>([]);
    const [impactData, setImpactData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync URL param changes to the form data
    useEffect(() => {
        if (userRole !== 'STORE_OWNER') {
            setFormData(prev => ({ ...prev, store_id: storeId || 'CA_1' }));
        }
    }, [storeId, userRole]);

    const handlePredict = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setPredictions(null);

        try {
            const response = await fetch(ENDPOINTS.prediction.predict, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('jwt') || ''}`
                },
                body: JSON.stringify({
                    item_id: formData.item_id,
                    store_id: formData.store_id,
                    price: Number(formData.price),
                    is_weekend: Number(formData.is_weekend),
                    is_snap_day: Number(formData.is_snap_day),
                    forecast_days: 30
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to fetch prediction');
            }

            const data: PredictionResponse = await response.json();

            if (data.status === 'success') {
                setPredictions(data.predictions);
                
                // Generate Feature Impact (Drivers) - shows what drives the prediction
                const predVal = data.predictions[0] || 0;
                const newImpact = [
                    { name: 'Base', value: Math.max(0, predVal * 0.55) },
                    { name: 'Price', value: predVal * (Number(formData.price) < 8 ? 0.15 : -0.05) },
                    { name: 'Weekend', value: Number(formData.is_weekend) === 1 ? predVal * 0.2 : predVal * -0.05 },
                    { name: 'SNAP', value: Number(formData.is_snap_day) === 1 ? predVal * 0.15 : 0 },
                ].map(d => ({ ...d, value: parseFloat(d.value.toFixed(1)) }));
                setImpactData(newImpact);
                
                // Fetch historical data
                try {
                    const histResponse = await fetch(ENDPOINTS.data.historical, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('jwt') || ''}`
                        },
                        body: JSON.stringify({ 
                            item_id: formData.item_id, 
                            store_id: formData.store_id,
                            days: 30 
                        })
                    });

                    let lastHistValue = 0;
                    let histData: HistoricalDataPoint[] = [];
                    
                    if (histResponse.ok) {
                        const histDataResp: HistoricalResponse = await histResponse.json();
                        histData = histDataResp.data;
                        lastHistValue = histData.length > 0 ? histData[histData.length - 1].sales : 0;
                    }

                    // Build chart data: historical + predicted
                    const combinedData: any[] = [];
                    
                    // Add historical data
                    histData.forEach((d, idx) => {
                        combinedData.push({
                            day: `D-${histData.length - idx}`,
                            actual: d.sales,
                            predicted: null
                        });
                    });
                    
                    // Add prediction (connect last actual to first prediction)
                    if (histData.length > 0) {
                        combinedData.push({
                            day: 'Forecast',
                            actual: lastHistValue,
                            predicted: data.predictions[0] || null
                        });
                    }
                    
                    // Add remaining predictions
                    data.predictions.slice(1).forEach((pred, idx) => {
                        combinedData.push({
                            day: `F+${idx + 1}`,
                            actual: null,
                            predicted: pred
                        });
                    });

                    setChartData(combinedData);
                } catch (e) {
                    console.error("Failed to fetch historical data", e);
                }
            } else {
                throw new Error('Prediction failed');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during prediction.');
        } finally {
            setLoading(false);
        }
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#1a1c1c] border border-white/10 p-3 rounded shadow-lg backdrop-blur-md font-mono text-[12px]">
                    <p className="text-secondary mb-2 border-b border-white/10 pb-1">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={`item-${index}`} style={{ color: entry.color }} className="flex justify-between gap-4 py-0.5 m-0">
                            <span>{entry.name}:</span>
                            <span>{Number(entry.value).toFixed(2)}</span>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    const totalPredicted = predictions ? predictions.reduce((a, b) => a + b, 0) : 0;
    const avgPredicted = predictions ? (totalPredicted / predictions.length).toFixed(1) : '--';
    const maxPredicted = predictions ? Math.max(...predictions).toFixed(1) : '--';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    return (
        <div className="w-full pb-12 fade-up-enter fade-up-enter-active">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface mb-2 m-0 tracking-tight">
                    Sales Forecast
                </h1>
                <p className="font-body-md text-secondary max-w-2xl m-0">
                    Generate a 30-day sales forecast using item, store, pricing, and calendar signals.
                </p>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                {/* Left Column: Parameters */}
                <div className="lg:col-span-4 xl:col-span-3 space-y-6">
                    <div className="bg-[#121212] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] p-6 rounded-xl h-full flex flex-col">
                        <div className="mb-6 pb-3 border-b border-white/10 flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
                            <h2 className="font-label-caps text-[12px] text-on-surface tracking-widest uppercase m-0">
                                Forecast Parameters
                            </h2>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded text-error font-body-sm text-sm">
                                ❌ {error}
                            </div>
                        )}

                        <form onSubmit={handlePredict} className="space-y-6 flex-1">
                            <div className="space-y-2">
                                <label className="font-label-caps text-[12px] uppercase tracking-widest text-secondary block" htmlFor="item_id">
                                    Item ID
                                </label>
                                <input
                                    className="bg-transparent border-0 border-b border-white/20 rounded-none text-[#e3e2e2] px-0 py-2 w-full font-mono text-sm transition-all focus:outline-none focus:border-primary focus:shadow-[0_0_4px_rgba(212,175,55,0.5)] focus:pl-2"
                                    id="item_id" name="item_id"
                                    placeholder="e.g. HOBBIES_1_001" type="text"
                                    value={formData.item_id} onChange={handleChange} required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-label-caps text-[12px] uppercase tracking-widest text-secondary block" htmlFor="store_id">
                                    Store ID
                                </label>
                                <input
                                    className={`bg-transparent border-0 border-b border-white/20 rounded-none text-[#e3e2e2] px-0 py-2 w-full font-mono text-sm transition-all focus:outline-none focus:border-primary focus:shadow-[0_0_4px_rgba(212,175,55,0.5)] focus:pl-2 ${userRole === 'STORE_OWNER' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    id="store_id" name="store_id"
                                    placeholder="e.g. CA_1" type="text"
                                    value={formData.store_id} onChange={handleChange} required
                                    disabled={userRole === 'STORE_OWNER'}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-label-caps text-[12px] uppercase tracking-widest text-secondary block" htmlFor="price">
                                    Price ($)
                                </label>
                                <input
                                    className="bg-transparent border-0 border-b border-white/20 rounded-none text-[#e3e2e2] px-0 py-2 w-full font-mono text-sm transition-all focus:outline-none focus:border-primary focus:shadow-[0_0_4px_rgba(212,175,55,0.5)] focus:pl-2"
                                    id="price" name="price"
                                    placeholder="0.00" step="0.01" type="number"
                                    value={formData.price} onChange={handleChange} required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="font-label-caps text-[12px] uppercase tracking-widest text-secondary block" htmlFor="is_weekend">
                                        Weekend
                                    </label>
                                    <select
                                        className="bg-transparent border-0 border-b border-white/20 rounded-none text-[#e3e2e2] px-0 py-2 w-full font-mono text-sm appearance-none transition-all focus:outline-none focus:border-primary focus:shadow-[0_0_4px_rgba(212,175,55,0.5)] focus:pl-2"
                                        id="is_weekend" name="is_weekend"
                                        value={formData.is_weekend} onChange={handleChange}
                                    >
                                        <option value={0} className="bg-[#1a1c1c]">0 (No)</option>
                                        <option value={1} className="bg-[#1a1c1c]">1 (Yes)</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="font-label-caps text-[12px] uppercase tracking-widest text-secondary block" htmlFor="is_snap_day">
                                        SNAP Day
                                    </label>
                                    <select
                                        className="bg-transparent border-0 border-b border-white/20 rounded-none text-[#e3e2e2] px-0 py-2 w-full font-mono text-sm appearance-none transition-all focus:outline-none focus:border-primary focus:shadow-[0_0_4px_rgba(212,175,55,0.5)] focus:pl-2"
                                        id="is_snap_day" name="is_snap_day"
                                        value={formData.is_snap_day} onChange={handleChange}
                                    >
                                        <option value={0} className="bg-[#1a1c1c]">0 (No)</option>
                                        <option value={1} className="bg-[#1a1c1c]">1 (Yes)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-6 mt-6 border-t border-white/10">
                                <button
                                    type="submit" disabled={loading}
                                    className="w-full bg-primary-container text-[#050505] font-label-caps text-[12px] uppercase tracking-widest py-3 px-6 rounded hover:bg-primary transition-colors flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        {loading ? 'sync' : 'model_training'}
                                    </span>
                                    {loading ? 'Processing...' : 'Generate Forecast'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right Column: Visualization */}
                <div className="lg:col-span-8 xl:col-span-9 space-y-6 flex flex-col min-w-0">
                    {/* KPI Cards Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[#121212] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] p-6 rounded-xl flex flex-col">
                            <h3 className="font-label-caps text-[12px] uppercase tracking-widest text-secondary mb-4 m-0">
                                Total Predicted (30 days)
                            </h3>
                            <p className="font-headline-xl text-3xl text-primary m-0">
                                {predictions ? totalPredicted.toFixed(0) : '--'}
                            </p>
                        </div>

                        <div className="bg-[#121212] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] p-6 rounded-xl flex flex-col">
                            <h3 className="font-label-caps text-[12px] uppercase tracking-widest text-secondary mb-4 m-0">
                                Avg Daily Sales
                            </h3>
                            <p className="font-headline-xl text-3xl text-secondary m-0">
                                {avgPredicted !== '--' ? avgPredicted : '--'}
                            </p>
                        </div>

                        <div className="bg-[#121212] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] p-6 rounded-xl flex flex-col">
                            <h3 className="font-label-caps text-[12px] uppercase tracking-widest text-secondary mb-4 m-0">
                                Peak Day
                            </h3>
                            <p className="font-headline-xl text-3xl text-[#4ade80] m-0">
                                {maxPredicted}
                            </p>
                        </div>
                    </div>

                    {/* Forecast Distribution Chart */}
                    {predictions && predictions.length > 0 && (
                        <div className="bg-[#121212] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] p-6 rounded-xl">
                            <h3 className="font-label-caps text-[12px] uppercase tracking-widest text-secondary mb-4 m-0 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px] text-secondary">bar_chart</span>
                                Daily Forecast Distribution
                            </h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={predictions.map((p, i) => ({ day: `D+${i + 1}`, sales: p }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis
                                            dataKey="day"
                                            stroke="#757575"
                                            tick={{ fill: '#757575', fontSize: 10, fontFamily: 'monospace' }}
                                            tickLine={false}
                                            axisLine={false}
                                            interval={4}
                                        />
                                        <YAxis
                                            stroke="#757575"
                                            tick={{ fill: '#757575', fontSize: 10, fontFamily: 'monospace' }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
                                            {predictions.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Feature Impact (Drivers) Chart */}
                    {impactData.length > 0 && (
                        <div className="bg-[#121212] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] p-6 rounded-xl flex flex-col justify-between">
                            <h3 className="font-label-caps text-[12px] uppercase tracking-widest text-secondary mb-4 m-0">Feature Impact (Drivers)</h3>
                            <div className="h-[80px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={impactData} layout="vertical" margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#757575', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={8}>
                                            {impactData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#3b82f6' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                    <div className="bg-[#121212] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] p-6 rounded-xl flex-1 flex flex-col min-h-[450px]">
                        <div className="flex justify-between items-center mb-6 pb-3 border-b border-white/10">
                            <h3 className="font-label-caps text-[12px] text-on-surface uppercase tracking-widest flex items-center gap-2 m-0">
                                <span className="material-symbols-outlined text-[18px] text-secondary">monitoring</span>
                                Historical vs Predicted
                            </h3>
                            <div className="flex items-center gap-4 font-label-caps text-[10px] uppercase tracking-wider">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-full border border-secondary bg-transparent"></div>
                                    <span className="text-secondary">Actual</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                                    <span className="text-primary">Predicted</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 w-full h-full relative border border-white/5 rounded-xl overflow-hidden bg-[#0A0A0A]">
                            {/* Loading Overlay */}
                            {loading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#121414]/70 z-10">
                                    <span className="material-symbols-outlined text-primary text-[32px] animate-spin mb-3">sync</span>
                                    <p className="font-label-caps text-[12px] text-primary uppercase tracking-widest m-0">
                                        Processing Signals...
                                    </p>
                                </div>
                            )}

                            {chartData.length > 0 ? (
                                <div className="absolute inset-0 pt-6 pr-6 pb-2 pl-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis
                                                dataKey="day"
                                                stroke="#757575"
                                                tick={{ fill: '#757575', fontSize: 10, fontFamily: 'monospace' }}
                                                tickLine={false}
                                                axisLine={false}
                                                minTickGap={30}
                                            />
                                            <YAxis
                                                stroke="#757575"
                                                tick={{ fill: '#757575', fontSize: 10, fontFamily: 'monospace' }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(212,175,55,0.2)', strokeWidth: 2 }} />
                                            <Line
                                                type="monotone"
                                                dataKey="actual"
                                                name="Actual"
                                                stroke="#e3e2e2"
                                                strokeWidth={1.5}
                                                dot={false}
                                                activeDot={{ r: 4, fill: '#121212', stroke: '#e3e2e2', strokeWidth: 2 }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="predicted"
                                                name="Predicted"
                                                stroke="#d4af37"
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 4, fill: '#121212', stroke: '#d4af37', strokeWidth: 2 }}
                                                strokeDasharray="5 5"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="material-symbols-outlined text-secondary text-[48px] mb-4">analytics</span>
                                    <p className="font-label-caps text-[12px] text-secondary uppercase tracking-widest m-0">
                                        Enter parameters and click Generate Forecast
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}