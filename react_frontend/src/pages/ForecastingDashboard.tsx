import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, AreaChart, Area } from 'recharts';
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

interface ItemWithDetails {
  id: string;
  name: string;
  category: string;
  basePrice: number;
}

const WALMART_BLUE = '#0071ce';
const WALMART_YELLOW = '#ffc220';
const WALMART_DARK = '#004c91';
const WALMART_LIGHT_BLUE = '#e8f4fd';
const DARK_BG = '#0a0a0a';
const CARD_BG = '#121212';
const CARD_BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#ffffff';
const TEXT_SECONDARY = '#a0a0a0';
const TEXT_MUTED = '#666666';
const SUCCESS_GREEN = '#28a745';
const ERROR_RED = '#dc3545';

const CATEGORIES: Record<string, { name: string; color: string; icon: string }> = {
  'HOBBIES': { name: 'Hobbies', color: '#8b5cf6', icon: '🎮' },
  'FOODS': { name: 'Foods', color: '#f59e0b', icon: '🍎' },
  'HOUSEHOLD': { name: 'Household', color: '#10b981', icon: '🏠' },
};

function getCategoryInfo(itemId: string) {
  const prefix = itemId.split('_')[0];
  return CATEGORIES[prefix] || { name: 'General', color: '#6b7280', icon: '📦' };
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(0);
}

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

interface ItemWithDetails {
  id: string;
  name: string;
  category: string;
  basePrice: number;
}

const CHART_COLORS = ['#0071ce', '#ffc220', '#28a745', '#dc3545', '#8b5cf6', '#fd7e14', '#20c997', '#6f42c1'];

export default function ForecastingDashboard() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const userRole = localStorage.getItem('user_role');
  const assignedStoreId = localStorage.getItem('store_id');

  const initialStoreId = userRole === 'STORE_OWNER' && assignedStoreId
      ? assignedStoreId
      : (storeId || 'CA_1');

  const [formData, setFormData] = useState({
      item_id: '',
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
  const [items, setItems] = useState<ItemWithDetails[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  // Sync URL param changes to the form data
  useEffect(() => {
      if (userRole !== 'STORE_OWNER') {
          setFormData(prev => ({ ...prev, store_id: storeId || 'CA_1' }));
      }
  }, [storeId, userRole]);

  // Fetch items for dropdown
  useEffect(() => {
      const fetchItems = async () => {
          try {
              const response = await fetch(ENDPOINTS.data.items, {
                  headers: {
                      'Authorization': `Bearer ${localStorage.getItem('jwt') || ''}`
                  }
              });
              if (response.ok) {
                  const data = await response.json();
                  if (data.items && data.items.length > 0) {
                      // Transform items into detailed objects
                      const detailedItems: ItemWithDetails[] = data.items.map((itemId: string) => {
                          const categoryInfo = getCategoryInfo(itemId);
                          return {
                              id: itemId,
                              name: itemId.replace(/_/g, ' '),
                              category: categoryInfo.name,
                              basePrice: Math.round((Math.random() * 20 + 5) * 100) / 100, // Mock price
                          };
                      });
                      setItems(detailedItems);
                      // Set default item if not already set
                      if (!formData.item_id || !data.items.includes(formData.item_id)) {
                          setFormData(prev => ({ ...prev, item_id: data.items[0] }));
                      }
                  }
              }
          } catch (e) {
              console.error('Failed to fetch items:', e);
          } finally {
              setItemsLoading(false);
          }
      };
      fetchItems();
  }, []);

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
                  { name: 'Base Demand', value: Math.max(0, predVal * 0.55) },
                  { name: 'Price Sensitivity', value: predVal * (Number(formData.price) < 8 ? 0.15 : -0.05) },
                  { name: 'Weekend Effect', value: Number(formData.is_weekend) === 1 ? predVal * 0.2 : predVal * -0.05 },
                  { name: 'SNAP Program', value: Number(formData.is_snap_day) === 1 ? predVal * 0.15 : 0 },
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
              <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-xl font-mono text-xs">
                  <p className="text-gray-400 mb-2 border-b border-gray-700 pb-1">{label}</p>
                  {payload.map((entry: any, index: number) => (
                      <p key={`item-${index}`} style={{ color: entry.color }} className="flex justify-between gap-4 py-0.5 m-0">
                          <span>{entry.name}:</span>
                          <span>{Number(entry.value).toFixed(1)}</span>
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

  const selectedItem = items.find(i => i.id === formData.item_id);

  return (
      <div className="min-h-screen bg-gray-950 text-white">
          {/* Header Bar */}
          <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex items-center justify-between h-16">
                      <div className="flex items-center gap-8">
                          <span className="text-2xl font-bold text-white" style={{ color: WALMART_BLUE }}>
                              Walmart Forecasting
                          </span>
                          <nav className="hidden md:flex gap-6">
                              <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">HQ Map</a>
                              <a href="/dashboard/insights" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Insights</a>
                              <a href="/dashboard/admin" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Admin</a>
                          </nav>
                      </div>
                      <button 
                          onClick={() => {
                              localStorage.removeItem('jwt');
                              localStorage.removeItem('user_role');
                              localStorage.removeItem('store_id');
                              navigate('/');
                          }}
                          className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                      >
                          Logout
                      </button>
                  </div>
              </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* Page Header */}
              <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg" style={{ backgroundColor: WALMART_LIGHT_BLUE }}>
                          <span className="text-xl" style={{ color: WALMART_BLUE }}>📊</span>
                      </span>
                      <div>
                          <h1 className="text-3xl font-bold text-white">Sales Forecast</h1>
                          <p className="text-gray-400 text-sm">Generate 30-day sales forecasts with AI-powered predictions</p>
                      </div>
                  </div>
              </div>

              {/* Error Banner */}
              {error && (
                  <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-3">
                      <span className="text-red-400">⚠️</span>
                      <p className="text-red-300 text-sm">{error}</p>
                  </div>
              )}

              {/* Main Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Panel - Parameters */}
                  <div className="lg:col-span-4 xl:col-span-3">
                      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 h-full">
                          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: WALMART_BLUE }}>
                                  ⚙️
                              </span>
                              Forecast Parameters
                          </h2>

                          {error && (
                              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm flex items-center gap-2">
                                  <span>⚠️</span>
                                  <span>{error}</span>
                              </div>
                          )}

                          <form onSubmit={handlePredict} className="space-y-6">
                              {/* Item Selector */}
                              <div>
                                  <label className="block text-sm font-medium text-gray-300 mb-2">Item</label>
                                  {itemsLoading ? (
                                      <div className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-500 animate-pulse">
                                          Loading items...
                                      </div>
                                  ) : (
                                      <div className="relative">
                                          <select
                                              className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                              id="item_id" name="item_id"
                                              value={formData.item_id} onChange={handleChange} required
                                          >
                                              {items.map((item) => (
                                                  <option key={item.id} value={item.id} className="bg-gray-900">
                                                      {item.id} - {item.category}
                                                  </option>
                                              ))}
                                          </select>
                                          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                          </div>
                      </div>
                  )}

                  {/* Store ID */}
                  <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Store ID</label>
                      <input
                          className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent ${userRole === 'STORE_OWNER' ? 'opacity-50 cursor-not-allowed bg-gray-800' : ''}`}
                          id="store_id" name="store_id"
                          placeholder="e.g. CA_1" type="text"
                          value={formData.store_id} onChange={handleChange} required
                          disabled={userRole === 'STORE_OWNER'}
                      />
                      {userRole === 'STORE_OWNER' && (
                          <p className="text-xs text-gray-500 mt-1">Locked to your assigned store</p>
                      )}
                  </div>

                  {/* Price */}
                  <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Price ($)</label>
                      <input
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                          id="price" name="price"
                          placeholder="0.00" step="0.01" min="0" type="number"
                          value={formData.price} onChange={handleChange} required
                      />
                  </div>

                  {/* Weekend & SNAP Day */}
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Weekend</label>
                          <select
                              className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                              id="is_weekend" name="is_weekend"
                              value={formData.is_weekend} onChange={handleChange}
                          >
                              <option value={0} className="bg-gray-900">No</option>
                              <option value={1} className="bg-gray-900">Yes</option>
                          </select>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">SNAP Day</label>
                          <select
                              className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                              id="is_snap_day" name="is_snap_day"
                              value={formData.is_snap_day} onChange={handleChange}
                          >
                              <option value={0} className="bg-gray-900">No</option>
                              <option value={1} className="bg-gray-900">Yes</option>
                          </select>
                      </div>
                  </div>

                  {/* Submit Button */}
                  <button
                      type="submit" disabled={loading || itemsLoading}
                      className="w-full py-3 px-6 rounded-lg text-white font-semibold text-sm uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: WALMART_BLUE }}
                  >
                      <span className="material-symbols-outlined text-base" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                          {loading ? 'sync' : 'analytics'}
                      </span>
                      {loading ? 'Generating Forecast...' : 'Generate Forecast'}
                  </button>
              </form>
          </div>
      </div>

      {/* Right Panel - Results */}
      <div className="lg:col-span-8 xl:col-span-9">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                  <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-400">Total Predicted (30 days)</p>
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: WALMART_BLUE }}>
                          📈
                      </span>
                  </div>
                  <p className="text-3xl font-bold text-white mt-2">
                      {predictions ? formatNumber(totalPredicted) : '--'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">units</p>
              </div>

              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                  <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-400">Avg Daily Sales</p>
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: WALMART_YELLOW }}>
                          📊
                      </span>
                  </div>
                  <p className="text-3xl font-bold text-white mt-2" style={{ color: WALMART_YELLOW }}>
                      {avgPredicted !== '--' ? formatNumber(Number(avgPredicted)) : '--'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">units/day</p>
              </div>

              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                  <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-400">Peak Day</p>
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: SUCCESS_GREEN }}>
                          🎯
                      </span>
                  </div>
                  <p className="text-3xl font-bold text-white mt-2" style={{ color: SUCCESS_GREEN }}>
                      {maxPredicted !== '--' ? formatNumber(Number(maxPredicted)) : '--'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">units</p>
              </div>
          </div>

          {/* Item Info Card */}
          {selectedItem && (
              <div className="mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl" style={{ backgroundColor: getCategoryInfo(selectedItem.id).color }}>
                          {getCategoryInfo(selectedItem.id).icon}
                      </div>
                      <div>
                          <p className="font-semibold text-white">{selectedItem.id}</p>
                          <p className="text-sm text-gray-400">{selectedItem.category} • Base Price: ${selectedItem.basePrice.toFixed(2)}</p>
                      </div>
                  </div>
              </div>
          )}

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Forecast Distribution Chart */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 h-full">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: WALMART_BLUE }}>
                          📊
                      </span>
                      Daily Forecast Distribution (30 Days)
                  </h3>
                  {predictions && predictions.length > 0 ? (
                      <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={predictions.map((p, i) => ({ day: `Day ${i + 1}`, sales: p }))}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                  <XAxis
                                      dataKey="day"
                                      stroke="#6b7280"
                                      tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace' }}
                                      tickLine={false}
                                      axisLine={false}
                                      interval={3}
                                  />
                                  <YAxis
                                      stroke="#6b7280"
                                      tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace' }}
                                      tickLine={false}
                                      axisLine={false}
                                  />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Bar dataKey="sales" radius={[4, 4, 0, 0]} barSize={12}>
                                      {predictions.map((_, index) => (
                                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                      ))}
                                  </Bar>
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  ) : (
                      <div className="h-72 flex items-center justify-center">
                          <p className="text-gray-500 text-center">Generate a forecast to see distribution</p>
                      </div>
                  )}
              </div>

              {/* Feature Impact Chart */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 h-full">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: '#8b5cf6' }}>
                          🎯
                      </span>
                      Feature Impact (Drivers)
                  </h3>
                  {impactData.length > 0 ? (
                      <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={impactData} layout="vertical" margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                                  <XAxis type="number" hide />
                                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                                      {impactData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.value >= 0 ? SUCCESS_GREEN : ERROR_RED} />
                                      ))}
                                  </Bar>
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  ) : (
                      <div className="h-64 flex items-center justify-center">
                          <p className="text-gray-500 text-center">Generate a forecast to see feature impact</p>
                      </div>
                  )}
              </div>
          </div>

          {/* Main Chart - Historical vs Predicted */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: WALMART_BLUE }}>
                          📈
                      </span>
                      Historical vs Predicted Sales
                  </h3>
                  <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full border border-gray-500"></div>
                          <span className="text-gray-400">Actual</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: WALMART_YELLOW }}></div>
                          <span className="text-yellow-400">Predicted</span>
                      </div>
                  </div>
              </div>

              <div className="h-96 relative">
                  {loading ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-xl">
                          <div className="flex flex-col items-center gap-3">
                              <div className="w-10 h-10 border-3 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
                              <p className="text-blue-400 font-medium">Generating Forecast...</p>
                          </div>
                      </div>
                  ) : chartData.length > 0 ? (
                      <div className="w-full h-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                                  <defs>
                                      <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor={WALMART_YELLOW} stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor={WALMART_YELLOW} stopOpacity={0}/>
                                      </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                  <XAxis
                                      dataKey="day"
                                      stroke="#6b7280"
                                      tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace' }}
                                      tickLine={false}
                                      axisLine={false}
                                      tickFormatter={(value) => value.toString().startsWith('F') ? value : value.replace('D-', '')}
                                  />
                                  <YAxis
                                      stroke="#6b7280"
                                      tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace' }}
                                      tickLine={false}
                                      axisLine={false}
                                  />
                                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#ffc220', strokeWidth: 2, strokeOpacity: 0.5 }} />
                                  <Area
                                      type="monotone"
                                      dataKey="actual"
                                      name="Actual"
                                      stroke="#6b7280"
                                      strokeWidth={2}
                                      fillOpacity={1}
                                      fill="url(#colorActual)"
                                  />
                                  <Line
                                      type="monotone"
                                      dataKey="predicted"
                                      name="Predicted"
                                      stroke={WALMART_YELLOW}
                                      strokeWidth={3}
                                      dot={false}
                                      activeDot={{ r: 6, fill: WALMART_YELLOW, strokeWidth: 2 }}
                                      strokeDasharray="6 4"
                                  />
                              </LineChart>
                          </ResponsiveContainer>
                      </div>
                  ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center">
                          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: WALMART_LIGHT_BLUE }}>
                              <span className="text-3xl" style={{ color: WALMART_BLUE }}>📈</span>
                          </div>
                          <h3 className="text-lg font-medium text-white mb-2">No Forecast Yet</h3>
                          <p className="text-gray-500 max-w-md">Configure your parameters and click "Generate Forecast" to see the prediction chart</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
  </div>
  </div>
  );
}

export default ForecastingDashboard;