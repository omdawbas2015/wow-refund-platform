import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  ChevronDown,
  X,
  Plus,
  Edit2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const api = axios.create({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

const chartData = [
  { time: '12:00 AM', volume: 0 },
  { time: '1:00 AM', volume: 120 },
  { time: '2:00 AM', volume: 80 },
  { time: '3:00 AM', volume: 200 },
  { time: '4:00 AM', volume: 150 },
  { time: '5:00 AM', volume: 300 },
  { time: '6:00 AM', volume: 400 },
  { time: '7:00 AM', volume: 350 },
  { time: '8:00 AM', volume: 500 },
  { time: '9:00 AM', volume: 450 },
  { time: '10:00 AM', volume: 600 },
  { time: '11:00 AM', volume: 800 },
  { time: '12:00 PM', volume: 750 },
  { time: '1:00 PM', volume: 900 },
  { time: '2:00 PM', volume: 850 },
];

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/api/dashboard').then(res => res.data)
  });

  const stats = useMemo(() => {
    if (!dashboardData?.stats) return [];
    return dashboardData.stats;
  }, [dashboardData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-5 h-5 border-2 border-stripe-blurple/20 border-t-stripe-blurple rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto py-10 px-8">
      
      {/* Page Layout: Main (Left) + Sidebar (Right) */}
      <div className="flex flex-col lg:flex-row gap-12">
        
        {/* Main Content Column */}
        <div className="flex-1">
          <h1 className="text-[28px] font-bold text-stripe-dark mb-8">Today</h1>

          {/* Top Stats */}
          <div className="flex items-start gap-16 mb-24">
            <div>
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-stripe-slate cursor-pointer hover:text-stripe-dark transition-colors mb-2">
                Gross volume <ChevronDown className="w-3.5 h-3.5" />
              </div>
              <div className="text-[28px] font-bold text-stripe-dark leading-none mb-1">
                $0.00
              </div>
              <div className="text-[12px] text-stripe-light-slate">
                3:05 AM
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-stripe-slate cursor-pointer hover:text-stripe-dark transition-colors mb-2">
                Yesterday <ChevronDown className="w-3.5 h-3.5" />
              </div>
              <div className="text-[14px] font-medium text-stripe-slate leading-none mt-2">
                $0.00
              </div>
            </div>
          </div>

          {/* Real Recharts AreaChart for Gross Volume */}
          <div className="w-full h-[240px] mb-8 relative border-b border-stripe-border">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#635bff" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#635bff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e8ee" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e3e8ee', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '13px', fontWeight: 500, color: '#1a1f36' }}
                  itemStyle={{ color: '#635bff' }}
                  cursor={{ stroke: '#c1c9d2', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="volume" 
                  stroke="#635bff" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorVolume)" 
                  activeDot={{ r: 4, strokeWidth: 0, fill: '#635bff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="absolute -bottom-6 left-0 text-[11px] font-medium text-stripe-light-slate">12:00 AM</div>
            <div className="absolute -bottom-6 right-0 text-[11px] font-medium text-stripe-light-slate">11:00 PM</div>
          </div>

          {/* Balances & Payouts */}
          <div className="grid grid-cols-2 gap-8 mb-16 pt-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-medium text-stripe-dark">USD balance</span>
                <span className="text-[13px] font-medium text-stripe-blurple cursor-pointer hover:text-[#5851df]">View</span>
              </div>
              <div className="text-[24px] font-bold text-stripe-dark">
                $0.00
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-medium text-stripe-dark">Payouts</span>
                <span className="text-[13px] font-medium text-stripe-blurple cursor-pointer hover:text-[#5851df]">View</span>
              </div>
              <div className="text-[24px] font-bold text-stripe-slate">
                —
              </div>
            </div>
          </div>

          {/* Your Overview Section */}
          <div>
            <h2 className="text-[20px] font-bold text-stripe-dark mb-4">Your overview</h2>
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="flex items-center h-7 px-2.5 rounded-md border border-stripe-border bg-white hover:bg-gray-50 cursor-pointer text-[12px] font-medium text-stripe-slate transition-colors gap-1.5">
                  <span className="text-stripe-light-slate">Date range</span>
                  Last 7 days <ChevronDown className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center h-7 px-2.5 rounded-md border border-stripe-border bg-white hover:bg-gray-50 cursor-pointer text-[12px] font-medium text-stripe-slate transition-colors gap-1.5">
                  Daily <ChevronDown className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center h-7 px-2.5 rounded-md border border-stripe-border bg-white hover:bg-gray-50 cursor-pointer text-[12px] font-medium text-stripe-blurple transition-colors gap-1.5">
                  <X className="w-3 h-3 text-stripe-light-slate" /> Compare <span className="ml-1">Previous period</span> <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-stripe-border bg-white hover:bg-gray-50 text-[12px] font-medium text-stripe-slate transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
                <button className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-stripe-border bg-white hover:bg-gray-50 text-[12px] font-medium text-stripe-slate transition-colors">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Sidebar Column (Recommendations, API Keys) */}
        <div className="w-[320px] shrink-0 space-y-6 pt-16">
          
          {/* Recommendations Card */}
          <div className="bg-[#f6f9fc] rounded-xl p-5 relative border border-transparent">
            <button className="absolute top-4 right-4 text-stripe-light-slate hover:text-stripe-slate transition-colors">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-[13px] font-bold text-stripe-dark mb-2">Recommendations</h3>
            
            <div className="mb-4">
              <p className="text-[13px] text-stripe-slate leading-relaxed mb-1">
                Offer subscriptions to drive predictable recurring revenue streams.
              </p>
              <a href="#" className="text-[13px] font-medium text-stripe-blurple hover:text-[#5851df] transition-colors">
                Create a subscription
              </a>
            </div>

            <div>
              <p className="text-[13px] text-stripe-slate leading-relaxed mb-1">
                Use payment links to share payment pages with customers.
              </p>
              <a href="#" className="text-[13px] font-medium text-stripe-blurple hover:text-[#5851df] transition-colors">
                Create a payment link
              </a>
            </div>
          </div>

          {/* API Keys Card */}
          <div className="bg-[#f6f9fc] rounded-xl p-5 border border-transparent">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-bold text-stripe-dark">API keys</h3>
              <a href="#" className="text-[13px] font-medium text-stripe-blurple hover:text-[#5851df] transition-colors">
                View docs
              </a>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-stripe-slate">Publishable key</span>
                <span className="text-[13px] font-mono text-stripe-slate">pk_test_51T8eq...</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-stripe-slate">Secret key</span>
                <span className="text-[13px] font-mono text-stripe-slate">sk_test_51T8eq...</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
