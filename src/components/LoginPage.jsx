import React, { useState } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import bgImage from '../assets/orbital-login-bg.jpg';

export default function LoginPage({ onLogin }) {
  const [emailOrUser, setEmailOrUser] = useState('operator@saksham.space');
  const [password, setPassword] = useState('••••••••••••');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      if (onLogin) {
        onLogin({
          email: emailOrUser || 'operator@saksham.space',
          role: 'Flight Dynamics Engineer'
        });
      }
    }, 350);
  };

  const handleSsoClick = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      if (onLogin) {
        onLogin({
          email: 'sso.operator@esa-space.int',
          role: 'Flight Dynamics Director'
        });
      }
    }, 300);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none font-sans bg-[#010915] flex items-center justify-center lg:justify-end lg:pr-[9%] xl:pr-[11.7%] p-4">
      
      {/* 1. Exact 100% Background Image with Earth, Orbital Arcs & Clean SAKSHAM Branding */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-100"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundColor: '#010915'
        }}
      />

      {/* 2. Deep Space Subtle Edge Vignette */}
      <div className="absolute inset-0 pointer-events-none z-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.5)]" />

      {/* 3. Mobile/Tablet Responsive Brand Header (Visible on small screens where image is cropped) */}
      <div className="absolute top-6 left-6 z-10 flex lg:hidden items-center space-x-3 pointer-events-none">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-400/80 flex items-center justify-center text-cyan-400 bg-cyan-950/40 backdrop-blur-md shadow-lg shadow-cyan-500/20">
          <div className="w-4 h-4 rounded-full border border-cyan-300 relative">
            <div className="absolute -inset-1 border border-cyan-400 rounded-full rotate-45" />
          </div>
        </div>
        <div>
          <div className="text-xl font-extrabold tracking-[0.2em] font-sans">
            <span className="text-white">SAK</span>
            <span className="text-[#00d2ff]">SHAM</span>
          </div>
          <div className="text-[9px] font-semibold text-slate-300 tracking-[0.25em] uppercase">
            Safer Orbits. A Clearer Tomorrow.
          </div>
        </div>
      </div>

      {/* 4. The Exact White Login Card */}
      <div className="relative z-10 max-w-[420px] w-full bg-white rounded-3xl p-8 sm:p-9 shadow-2xl shadow-black/70 text-slate-900 animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
        
        {/* Card Header */}
        <div className="mb-6 text-left">
          <h1 className="text-2xl sm:text-[28px] font-extrabold text-[#0B1528] tracking-tight font-sans">
            Welcome Back
          </h1>
          <p className="text-xs text-[#708099] font-medium mt-1 font-sans">
            Sign in to access SAKSHAM
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          
          {/* Input 1: Email or Username */}
          <div className="space-y-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#708099]">
                <User className="w-[18px] h-[18px]" />
              </div>
              <input
                type="text"
                required
                value={emailOrUser}
                onChange={(e) => setEmailOrUser(e.target.value)}
                placeholder="Email or Username"
                className="w-full bg-white border border-[#E2E8F0] focus:border-[#00c0ff] focus:ring-2 focus:ring-[#00c0ff]/20 rounded-xl px-4 py-3 pl-11 text-xs sm:text-sm text-[#0B1528] placeholder-[#94A3B8] font-sans transition-all outline-none"
              />
            </div>
          </div>

          {/* Input 2: Password */}
          <div className="space-y-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#708099]">
                <Lock className="w-[18px] h-[18px]" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-white border border-[#E2E8F0] focus:border-[#00c0ff] focus:ring-2 focus:ring-[#00c0ff]/20 rounded-xl px-4 py-3 pl-11 pr-11 text-xs sm:text-sm text-[#0B1528] placeholder-[#94A3B8] font-sans transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#708099] hover:text-[#0B1528] transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
          </div>

          {/* Remember me & Forgot password row */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-white border-[#CBD5E1] text-[#00c0ff] focus:ring-[#00c0ff]/30 accent-[#00c0ff] cursor-pointer"
              />
              <span className="text-xs font-medium text-[#475569]">Remember me</span>
            </label>

            <button
              type="button"
              onClick={handleSubmit}
              className="text-xs font-semibold text-[#00a8ff] hover:text-[#0088cc] transition-colors cursor-pointer"
            >
              Forgot password?
            </button>
          </div>

          {/* Sign In Primary Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#00d2ff] to-[#007aff] hover:from-[#00c2ef] hover:to-[#006eef] shadow-md shadow-[#00b4d8]/25 transition-all flex items-center justify-center space-x-2 active:scale-[0.99] disabled:opacity-80 cursor-pointer"
            >
              <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Divider with "OR" */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E2E8F0]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider font-sans">
                OR
              </span>
            </div>
          </div>

          {/* Use SSO Secondary Button */}
          <div>
            <button
              type="button"
              onClick={handleSsoClick}
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl font-semibold text-xs text-[#334155] bg-white hover:bg-slate-50 border border-[#CBD5E1] transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-2xs hover:border-slate-400"
            >
              <ShieldCheck className="w-4 h-4 text-[#475569]" />
              <span>Use SSO</span>
            </button>
          </div>

        </form>

      </div>

    </div>
  );
}
