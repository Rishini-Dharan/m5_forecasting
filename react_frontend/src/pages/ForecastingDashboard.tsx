import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { API_BASE_URL } from '../config';

export default function ForecastingDashboard() {
    const [formData, setFormData] = useState({
        item_id: 'HOBBIES_1_001',
        store_id: 'CA_1',
        price: 8.26,
        is_weekend: 0,
        is_snap_day: 0
    });
    const [prediction, setPrediction] = useState<number | null>(null);
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    const handlePredict = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setPrediction(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/predict`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    item_id: formData.item_id,
                    store_id: formData.store_id,
                    price: Number(formData.price),
                    is_weekend: Number(formData.is_weekend),
                    is_snap_day: Number(formData.is_snap_day)
                })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch prediction');
            }

            const data = await response.json();
            
            let newChartData: any[] = [];
            
            // 2. Fetch Historical Data
            try {
                const histResponse = await fetch(`${API_BASE_URL}/api/data/historical`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ item_id: formData.item_id, store_id: formData.store_id })
                });
                
                if (histResponse.ok) {
                    const histData = await histResponse.json();
                    newChartData = histData.map((d: any) => ({
                        day: `Day ${d.day}`,
                        actual: d.sales,
                        predicted: null
                    }));
                }
            } catch (e) {
                console.error("Failed to fetch historical data", e);
            }
            
            if (data.status === 'success') {
                const predVal = data.predicted_sales;
                setPrediction(predVal);
                
                // If we have history, link the prediction so the line continues
                if (newChartData.length > 0) {
                    const lastIdx = newChartData.length - 1;
                    newChartData[lastIdx].predicted = newChartData[lastIdx].actual; // overlap point
                    
                    const lastDayNum = parseInt(newChartData[lastIdx].day.replace('Day ', ''));
                    newChartData.push({
                        day: `Day ${lastDayNum + 1}`,
                        actual: null,
                        predicted: predVal
                    });
                }
                setChartData(newChartData);
            } else {
                throw new Error(data.model || 'Unknown error');
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
                <div style={{ backgroundColor: 'rgba(10,10,10,0.9)', padding: '12px', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
                    <p style={{ color: '#fff', margin: '0 0 5px 0', fontWeight: 'bold' }}>{label}</p>
                    {payload.map((p: any, idx: number) => (
                        <p key={idx} style={{ color: p.color, margin: '2px 0', fontSize: '14px' }}>
                            {p.name}: {Number(p.value).toFixed(2)}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ width: '100%', paddingBottom: '50px' }}>
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ color: 'var(--accent-gold)', marginBottom: '8px' }}>Sales Forecasting</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Predict M5 future demand using LightGBM</p>
            </div>
            
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(300px, 350px) 1fr',
                gap: '32px',
                alignItems: 'start'
            }}>
                {/* Left Sidebar: Controls */}
                <div className="glass-panel animate-fade-in" style={{ padding: '32px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.25rem' }}>Parameters</h3>
                    
                    <form onSubmit={handlePredict} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label className="input-label">Item ID</label>
                            <input name="item_id" value={formData.item_id} onChange={handleChange} className="input-field" required />
                        </div>
                        
                        <div>
                            <label className="input-label">Store ID</label>
                            <input name="store_id" value={formData.store_id} onChange={handleChange} className="input-field" required />
                        </div>
                        
                        <div>
                            <label className="input-label">Price ($)</label>
                            <input type="number" step="0.01" name="price" value={formData.price} onChange={handleChange} className="input-field" required />
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label className="input-label">Weekend?</label>
                                <select name="is_weekend" value={formData.is_weekend} onChange={handleChange} className="input-field">
                                    <option value={0}>No (0)</option>
                                    <option value={1}>Yes (1)</option>
                                </select>
                            </div>
                            <div>
                                <label className="input-label">SNAP Day?</label>
                                <select name="is_snap_day" value={formData.is_snap_day} onChange={handleChange} className="input-field">
                                    <option value={0}>No (0)</option>
                                    <option value={1}>Yes (1)</option>
                                </select>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="btn-primary"
                            disabled={loading}
                            style={{ marginTop: '16px' }}
                        >
                            {loading ? 'Predicting...' : 'Generate Forecast →'}
                        </button>
                    </form>

                    {error && (
                        <div style={{ 
                            marginTop: '24px', 
                            padding: '12px 16px', 
                            backgroundColor: 'rgba(255, 107, 107, 0.1)', 
                            color: '#ff6b6b', 
                            borderRadius: 'var(--radius-sm)', 
                            border: '1px solid rgba(255, 107, 107, 0.3)',
                            fontSize: '14px'
                        }}>
                            ❌ {error}
                        </div>
                    )}
                </div>

                {/* Right Area: KPI and Chart */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {prediction !== null && (
                        <div className="glass-panel animate-fade-in" style={{ 
                            padding: '32px', 
                            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(20, 20, 20, 0.8) 100%)',
                            borderColor: 'var(--border-gold-strong)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <p style={{ color: 'var(--accent-gold)', margin: '0 0 4px 0', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600' }}>
                                    Predicted Unit Sales
                                </p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>For the next day</p>
                            </div>
                            <h2 style={{ color: '#ffffff', margin: 0, fontSize: '3.5rem', fontWeight: '700', letterSpacing: '-0.02em' }}>
                                {prediction.toFixed(2)}
                            </h2>
                        </div>
                    )}

                    {/* Chart Section */}
                    {chartData.length > 0 && (
                        <div className="glass-panel animate-fade-in" style={{
                            padding: '32px',
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <h3 style={{ marginTop: 0, marginBottom: '32px', fontSize: '1.25rem' }}>30-Day Historical Trend & Forecast</h3>
                            <div style={{ width: '100%', height: '400px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 10, right: 30, left: -20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="day" stroke="#757575" tick={{fill: '#757575', fontSize: 12}} tickMargin={12} minTickGap={20} axisLine={false} tickLine={false} />
                                        <YAxis stroke="#757575" tick={{fill: '#757575', fontSize: 12}} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line 
                                            type="monotone" 
                                            dataKey="actual" 
                                            name="Actual Sales" 
                                            stroke="#8884d8" 
                                            strokeWidth={3}
                                            dot={{ r: 4, fill: '#8884d8', strokeWidth: 0 }}
                                            activeDot={{ r: 6 }} 
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="predicted" 
                                            name="Predicted Forecast" 
                                            stroke="var(--accent-gold)" 
                                            strokeWidth={3} 
                                            strokeDasharray="5 5"
                                            dot={{ r: 6, fill: 'var(--accent-gold)', strokeWidth: 2, stroke: '#000' }}
                                            activeDot={{ r: 8 }} 
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
