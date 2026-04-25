import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Lock } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      toast.success('Authentication successful');
      navigate('/');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white overflow-hidden relative">
      {/* Background Mesh Gradient (Stripe Style) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
         <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-stripe-blurple/5 blur-[120px]" />
         <div className="absolute top-[30%] -right-[20%] w-[60%] h-[60%] rounded-full bg-cyan-400/5 blur-[120px]" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 relative z-10">
        <div className="w-full max-w-[440px]">
          {/* Brand Header */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-14 h-14 bg-stripe-blurple rounded-xl flex items-center justify-center text-white shadow-stripe-lg mb-6">
               <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-[28px] font-bold text-stripe-dark tracking-tight">Sign in to your account</h1>
            <p className="text-[15px] text-stripe-slate mt-2">Enter your work credentials to access the portal.</p>
          </div>

          {/* Login Card */}
          <div className="stripe-card p-10 shadow-stripe-lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-stripe-dark">Email address</label>
                <input
                  type="email"
                  required
                  className="stripe-input h-11"
                  placeholder="name@organization.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                   <label className="text-[13px] font-semibold text-stripe-dark">Password</label>
                   <button type="button" className="text-[13px] font-bold text-stripe-blurple hover:text-stripe-blurple-light">Forgot password?</button>
                </div>
                <div className="relative">
                   <input
                     type="password"
                     required
                     className="stripe-input h-11"
                     placeholder="••••••••"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                   />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="stripe-btn-primary w-full h-11 text-[15px]"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Footer Info */}
          <div className="mt-10 flex items-center justify-center gap-6 text-[13px] font-medium text-stripe-light-slate">
             <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Secure authentication
             </div>
             <div className="w-1 h-1 rounded-full bg-gray-300" />
             <a href="#" className="hover:text-stripe-dark transition-colors">Privacy Policy</a>
             <div className="w-1 h-1 rounded-full bg-gray-300" />
             <a href="#" className="hover:text-stripe-dark transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>

      {/* Global Footer Branding */}
      <div className="p-8 flex justify-center border-t border-stripe-border relative z-10 bg-white">
         <div className="flex items-center gap-2 grayscale opacity-40">
            <div className="w-5 h-5 bg-stripe-dark rounded-sm flex items-center justify-center text-[10px] font-bold text-white">W</div>
            <span className="text-[14px] font-bold text-stripe-dark tracking-tight">WOW ENTERPRISE</span>
         </div>
      </div>
    </div>
  );
}
