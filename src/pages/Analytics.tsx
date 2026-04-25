import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';
import {
  Calendar, TrendingUp, Users, Clock,
  Download, Activity, Globe, Info, Filter, ArrowUpRight, Zap, ChevronRight, BarChart3, ShieldCheck
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STRIPE_CHART_COLORS = ['#635bff', '#00d4ff', '#ff9c00', '#f66', '#00d924', '#4f566b'];
const api = axios.create({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/90 backdrop-blur-md border border-stripe-border rounded-xl shadow-stripe-lg px-5 py-4 text-[13px] font-sans min-w-[160px]">
      <p className="font-bold text-stripe-dark mb-3 flex items-center gap-2">
         <div className="w-2 h-2 rounded-full bg-stripe-blurple" />
         {label}
      </p>
      <div className="space-y-2">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
               <span className="text-stripe-slate font-semibold">{entry.name}</span>
            </div>
            <span className="font-bold text-stripe-dark">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [countriesList, setCountriesList] = useState<any[]>([]);
  const [filters, setFilters] = useState<any>({ range: '30d', countries: [] });

  const fetchData = async () => {
    try {
      const cRes = await api.get('/api/countries');
      setCountriesList(Array.isArray(cRes.data) ? cRes.data : []);
    } catch { setCountriesList([]); }
  };

  const fetchAnalytics = async () => {
    if (!data) setLoading(true);
    try {
      const params: any = { range: filters.range };
      if (filters.countries.length > 0) params.countries = filters.countries.join(',');
      const res = await api.get('/api/analytics', { params });
      setData(res.data);
    } catch { toast.error('Failed to load analytics engine'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchAnalytics(); }, [filters]);

  const toggleCountry = (code: string) => {
    setFilters((prev: any) => ({
      ...prev, countries: prev.countries.includes(code) ? prev.countries.filter((c: string) => c !== code) : [...prev.countries, code]
    }));
  };

  if (loading && !data) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="relative">
         <div className="w-14 h-14 border-4 border-stripe-blurple/20 border-t-stripe-blurple rounded-full animate-spin" />
         <BarChart3 className="absolute inset-0 m-auto w-5 h-5 text-stripe-blurple" />
      </div>
    </div>
  );

  const kpis = [
    { label: 'Platform Volume', value: data?.kpis?.totalCases ?? 0, trend: '+12%', sub: 'Total requests', icon: Activity },
    { label: 'Settled Value', value: `${(data?.kpis?.totalRefundAmountKWD ?? 0).toLocaleString()} KWD`, trend: '+5.2%', sub: 'Gross instructions', icon: Zap },
    { label: 'MTTS (Mean Time)', value: `${data?.kpis?.avgResolutionTime?.toFixed(1) ?? '0.0'}d`, trend: '-0.4d', sub: 'Resolution velocity', icon: Clock },
    { label: 'Health Index', value: `99.8%`, trend: 'Stable', sub: 'System reliability', icon: ShieldCheck },
  ];

  const axisStyle = { fontSize: 11, fontWeight: 700, fill: '#697386', fontFamily: 'Inter', letterSpacing: '0.05em' };

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-8">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
           <div className="flex items-center gap-2 text-[12px] font-bold text-stripe-light-slate uppercase tracking-widest mb-3">
              <BarChart3 className="w-3.5 h-3.5 text-stripe-blurple" />
              <span>Infrastructure</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-stripe-blurple">Analytics</span>
           </div>
           <h1 className="stripe-h1">Platform Performance</h1>
           <p className="text-[16px] text-stripe-slate">Real-time reporting on refund velocity, liquidity impact, and regional governance.</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <Select value={filters.range} onValueChange={val => setFilters((p: any) => ({ ...p, range: val }))}>
            <SelectTrigger className="w-[200px] h-11 bg-white border-stripe-border font-bold text-[14px] shadow-stripe-sm focus:ring-4 focus:ring-stripe-blurple/10 transition-all">
              <Calendar className="w-4 h-4 mr-2 text-stripe-slate" /><SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl p-1 shadow-stripe-lg border-stripe-border">
              <SelectItem value="7d" className="rounded-lg py-2.5">Current cycle (7d)</SelectItem>
              <SelectItem value="30d" className="rounded-lg py-2.5">Monthly audit (30d)</SelectItem>
            </SelectContent>
          </Select>
          <button className="stripe-button stripe-button-secondary">
            <Download className="w-4 h-4" /> 
            <span>Export dataset</span>
          </button>
        </motion.div>
      </div>

      {/* Market Filtration Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-6 mb-12 overflow-x-auto pb-4 scrollbar-none border-b border-stripe-border"
      >
        <span className="text-[11px] font-bold text-stripe-light-slate uppercase tracking-[0.2em] flex items-center shrink-0">
          <Globe className="w-4 h-4 mr-3 text-stripe-blurple"/> Market Segments:
        </span>
        <div className="flex gap-2.5">
          {countriesList.map(c => (
            <button 
              key={c.code} 
              onClick={() => toggleCountry(c.code)}
              className={cn(
                "px-5 py-2 rounded-xl text-[13px] font-bold border transition-all duration-300",
                filters.countries.includes(c.code)
                  ? "bg-stripe-blurple text-white border-stripe-blurple shadow-stripe-md scale-105"
                  : "bg-white text-stripe-slate border-stripe-border hover:border-stripe-dark hover:text-stripe-dark shadow-stripe-sm"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </motion.div>

      {/* KPI Section - Elite Stripe Style */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
        {kpis.map((kpi, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="stripe-surface p-8 group hover:border-stripe-blurple transition-all relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 w-24 h-24 bg-stripe-blurple/[0.02] rounded-bl-full transition-transform group-hover:scale-110" />
             <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="w-10 h-10 bg-gray-50 border border-stripe-border rounded-xl flex items-center justify-center text-stripe-blurple shadow-sm group-hover:bg-white group-hover:shadow-stripe-md transition-all">
                   <kpi.icon className="w-5 h-5" />
                </div>
                <div className={cn(
                   "flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full",
                   kpi.trend.startsWith('+') ? "bg-stripe-green/10 text-stripe-green" : 
                   kpi.trend.startsWith('-') ? "bg-stripe-blurple/10 text-stripe-blurple" : "bg-gray-100 text-stripe-slate"
                )}>
                   {kpi.trend}
                   <TrendingUp className="w-3 h-3" />
                </div>
             </div>
             <h3 className="text-[32px] font-bold text-stripe-dark tracking-tighter leading-none mb-3">{kpi.value}</h3>
             <p className="text-[14px] text-stripe-light-slate font-bold uppercase tracking-wider">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      {/* High-Fidelity Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
        <motion.div 
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="stripe-surface p-10"
        >
          <div className="flex items-center justify-between mb-12">
             <div className="space-y-1">
                <h3 className="text-[18px] font-bold text-stripe-dark">Refund Velocity</h3>
                <p className="text-[13px] text-stripe-light-slate font-medium">Daily instruction count and processing flow.</p>
             </div>
             <div className="flex items-center gap-6 text-[12px] font-bold text-stripe-slate">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-stripe-blurple shadow-sm" /> Transaction Volume</div>
             </div>
          </div>
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.charts?.volumeChart || []}>
                <defs>
                   <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#635bff" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#635bff" stopOpacity={0}/>
                   </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#e6ebf1" />
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} dy={15} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} dx={-15} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#635bff', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  name="Instructions"
                  stroke="#635bff" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorVolume)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#635bff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="stripe-surface p-10"
        >
          <div className="space-y-1 mb-12">
             <h3 className="text-[18px] font-bold text-stripe-dark">Liquidity Distribution</h3>
             <p className="text-[13px] text-stripe-light-slate font-medium">Settled gross value across operational cycles.</p>
          </div>
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.charts?.valueChart || []}>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#e6ebf1" />
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} dy={15} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} dx={-15} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,91,255,0.03)' }} />
                <Bar dataKey="amount" name="Value (KWD)" fill="#635bff" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="stripe-surface p-10"
        >
          <h3 className="text-[16px] font-bold text-stripe-dark mb-10">Lifecycle Segments</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={data?.charts?.statusDist || []} 
                  innerRadius={75} 
                  outerRadius={105} 
                  paddingAngle={6} 
                  dataKey="_count" 
                  nameKey="status" 
                  stroke="none"
                >
                  {(data?.charts?.statusDist || []).map((_: any, i: number) => <Cell key={i} fill={STRIPE_CHART_COLORS[i % STRIPE_CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '13px', paddingTop: '40px', color: '#697386', fontWeight: 700, letterSpacing: '0.02em' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="stripe-surface lg:col-span-2 overflow-hidden flex flex-col"
        >
           <div className="px-10 py-6 border-b border-stripe-border bg-gray-50/30 flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-stripe-dark">Internal Performance Matrix</h3>
              <div className="text-[11px] font-bold text-stripe-light-slate uppercase tracking-widest">Efficiency Ranking</div>
           </div>
           <div className="flex-1 overflow-x-auto">
             <table className="stripe-table">
               <thead>
                 <tr>
                   <th>Administrative Node</th>
                   <th>Instructions Handled</th>
                   <th className="text-right">Settlement Velocity</th>
                 </tr>
               </thead>
               <tbody>
                 {(data?.agentPerformance || []).map((a: any, i: number) => (
                   <tr key={i} className="group">
                     <td>
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-stripe-blurple/5 border border-stripe-blurple/10 flex items-center justify-center text-stripe-blurple font-bold text-[11px] group-hover:scale-110 transition-transform">
                              {a.name?.charAt(0)}
                           </div>
                           <span className="font-bold text-stripe-dark">{a.name}</span>
                        </div>
                     </td>
                     <td><span className="text-stripe-slate font-bold">{a.total} resources</span></td>
                     <td className="text-right">
                        <div className="flex items-center justify-end gap-2 text-stripe-blurple font-bold font-mono">
                           {a.avgResTime?.toFixed(1) ?? '0.0'} days
                           <div className="w-1.5 h-1.5 rounded-full bg-stripe-green" />
                        </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </motion.div>
      </div>
    </div>
  );
}
