'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  FileText, 
  RefreshCw, 
  FolderOpen, 
  Shield, 
  Zap, 
  CheckSquare, 
  ArrowRight 
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const handleGetStarted = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      router.push(`/signup?email=${encodeURIComponent(email.trim())}`);
    } else {
      router.push('/signup');
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9f7] text-[#1a1c1b] flex flex-col justify-between selection:bg-black/10 selection:text-black">
      {/* TopAppBar */}
      <nav className="w-full sticky top-0 z-50 bg-[#f9f9f7]/85 backdrop-blur-md border-b border-[#e8e8e6]">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 cursor-pointer group">
            <img 
              alt="Echo Logo" 
              className="w-8 h-8 object-contain transition-transform group-hover:scale-105 duration-200" 
              src="/logo.png"
            />
            <span className="font-outfit text-xl font-bold tracking-tight text-black">Echo</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a className="text-sm font-medium text-[#4c4546] hover:text-black transition-colors" href="#features">Product</a>
            <a className="text-sm font-medium text-[#4c4546] hover:text-black transition-colors" href="#kanban">Workflows</a>
            <a className="text-sm font-medium text-[#4c4546] hover:text-black transition-colors" href="#cta">Pricing</a>
            <a className="text-sm font-medium text-[#4c4546] hover:text-black transition-colors" href="#cta">Resources</a>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="hidden md:block text-sm font-medium text-[#4c4546] hover:text-black px-4 py-2 transition-colors"
            >
              Log in
            </Link>
            <Link 
              href="/signup" 
              className="bg-black text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-all duration-200 hover:bg-[#1a1c1b] shadow-sm hover:shadow active:scale-[0.98]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 flex-1 w-full">
        {/* Hero Section */}
        <section className="py-20 md:py-32 flex flex-col items-center text-center max-w-4xl mx-auto">
          <h1 className="font-outfit text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6 text-black">
            The workspace where your team's thoughts align.
          </h1>
          <p className="text-lg md:text-xl text-[#4c4546] max-w-2xl mb-10 leading-relaxed">
            Echo connects your notes, documents, and project workflows in a single, minimalist environment designed for focus.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link 
              href="/signup" 
              className="bg-black text-white font-medium text-sm px-8 py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#1a1c1b] transition-all shadow-sm active:scale-[0.98]"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link 
              href="/login" 
              className="border border-[#cfc4c5] bg-transparent text-[#1a1c1b] font-medium text-sm px-8 py-4 rounded-xl hover:bg-[#f4f4f2] transition-all flex items-center justify-center"
            >
              Log in
            </Link>
          </div>
        </section>

        {/* Product Preview */}
        <section className="mb-24 relative">
          <div className="w-full bg-white border border-[#e8e8e6] rounded-2xl shadow-xl overflow-hidden p-1">
            <div className="bg-[#f4f4f2] border border-[#cfc4c5] rounded-xl overflow-hidden shadow-inner">
              {/* Fake Window Controls */}
              <div className="flex items-center gap-1.5 p-4 border-b border-[#cfc4c5]">
                <div className="w-3 h-3 rounded-full bg-red-500/30"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/30"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/30"></div>
              </div>
              
              {/* Interactive Mock UI that resembles our app */}
              <div className="flex h-[480px] bg-[#f9f9f7] text-[#1a1c1b] overflow-hidden font-outfit">
                {/* Mock Sidebar */}
                <div className="w-48 bg-[#f4f4f2] border-r border-[#cfc4c5]/40 p-4 flex flex-col justify-between hidden md:flex select-none text-left">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-1 font-bold text-xs text-black">
                      <img src="/logo.png" className="h-4.5 w-4.5 object-contain" alt="Echo logo" />
                      <span>Echo Workspace</span>
                    </div>
                    
                    {/* Workspace selector mock */}
                    <div className="bg-white border border-[#cfc4c5]/50 rounded-lg p-2 flex items-center justify-between text-[9px] font-bold text-[#4c4546] shadow-sm">
                      <span>Engineering Team</span>
                      <span>▼</span>
                    </div>

                    {/* Navigation list mock */}
                    <div className="space-y-1 text-[11px] font-semibold">
                      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#e2e3e1] rounded-lg text-black font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                        <span>Workspace Docs</span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 text-[#4c4546] hover:bg-[#e2e3e1]/40 rounded-lg transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <span>Tasks Board</span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 text-[#4c4546] hover:bg-[#e2e3e1]/40 rounded-lg transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <span>Projects</span>
                      </div>
                    </div>
                  </div>

                  {/* User Profile Card */}
                  <div className="flex items-center gap-2 p-1.5 border-t border-[#cfc4c5]/30 text-[10px] font-bold text-[#4c4546]">
                    <div className="w-5 h-5 rounded-full bg-[#e2e3e1] flex items-center justify-center font-bold text-black border border-[#cfc4c5]/40">A</div>
                    <div className="flex-1 truncate">alex@echo.sh</div>
                  </div>
                </div>

                {/* Mock Dashboard/Editor Content */}
                <div className="flex-1 flex flex-col bg-[#f9f9f7] p-6 overflow-y-auto text-left relative">
                  {/* Mock Editor Topbar */}
                  <div className="flex items-center justify-between pb-4 border-b border-[#cfc4c5]/30 mb-5">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-bold text-black flex items-center gap-1.5">
                        <span>Q3 Strategy Proposal</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-black text-white rounded font-bold uppercase tracking-wider">DOC</span>
                      </h3>
                      <p className="text-[10px] text-slate-400">Created by Alex Carter • Last updated today</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-bold flex items-center justify-center uppercase">A</div>
                      <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-800 text-[8px] font-bold flex items-center justify-center uppercase">M</div>
                      <button className="px-2.5 py-1 bg-black text-white text-[10px] font-semibold rounded-lg shadow-sm">Export</button>
                    </div>
                  </div>

                  {/* Mock Document Bento grid & Editor canvas side by side */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
                    <div className="lg:col-span-2 border border-[#cfc4c5]/60 bg-white rounded-xl p-4 space-y-3 shadow-sm">
                      <h4 className="text-xs font-bold text-black">Draft Specification</h4>
                      <div className="space-y-2">
                        <p className="text-[11px] text-[#4c4546] leading-relaxed">
                          Welcome to the collaborative strategy document. Here are the core metrics for this quarter:
                        </p>
                        <div className="p-2.5 bg-[#f4f4f2] rounded-lg border border-[#cfc4c5]/30 font-mono text-[9px] text-[#4c4546]">
                          // Core OKRs:<br/>
                          - Increase performance metrics by 35%<br/>
                          - Automate PDF creation pipelines with clean downloads
                        </div>
                        <p className="text-[11px] text-[#4c4546] leading-relaxed">
                          Please add comments on the sidebar directly if you notice alignment issues or style discrepancies.
                        </p>
                      </div>
                    </div>

                    {/* Mock Sidebar stats & graph */}
                    <div className="space-y-4">
                      {/* Stats Card */}
                      <div className="border border-[#cfc4c5]/60 bg-[#f4f4f2]/40 rounded-xl p-4 space-y-2">
                        <span className="text-[8px] font-bold uppercase tracking-widest text-[#4c4546] block">Workspace Performance</span>
                        <div className="flex items-end gap-1.5 h-16 pt-2">
                          <div className="w-full bg-slate-300 rounded-t-sm h-[30%]"></div>
                          <div className="w-full bg-slate-300 rounded-t-sm h-[45%]"></div>
                          <div className="w-full bg-slate-400 rounded-t-sm h-[60%]"></div>
                          <div className="w-full bg-black rounded-t-sm h-[90%]"></div>
                          <div className="w-full bg-slate-300 rounded-t-sm h-[75%]"></div>
                        </div>
                        <span className="text-[9px] text-black font-semibold block text-center">92% Engagement Increase</span>
                      </div>

                      {/* Project Checklist */}
                      <div className="border border-[#cfc4c5]/60 bg-white rounded-xl p-4 space-y-2 text-[10px] shadow-sm">
                        <span className="font-bold text-black">Action Checklist</span>
                        <div className="space-y-1.5 text-[#4c4546] font-medium">
                          <div className="flex items-center gap-1.5 text-black">
                            <span className="text-green-600 font-bold">✓</span>
                            <span className="line-through">Fix PDF download CORS</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span>☐</span>
                            <span>Refactor login and signup forms</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span>☐</span>
                            <span>Add logout exit warning alert</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
          {/* Decorative shadow */}
          <div className="absolute -z-10 bottom-0 left-1/2 -translate-x-1/2 w-[90%] h-1/2 bg-[#dadad8]/30 blur-3xl rounded-full"></div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-12 mb-24 scroll-mt-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="p-6 border border-[#cfc4c5] rounded-2xl flex flex-col gap-4 hover:bg-white hover:border-black/30 transition-all duration-300 group shadow-sm hover:shadow-md">
              <div className="w-10 h-10 bg-[#e8e8e6] rounded-xl flex items-center justify-center text-[#1a1c1b] group-hover:bg-black group-hover:text-white transition-all duration-300">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-outfit text-lg font-bold text-black">Seamless Docs</h3>
              <p className="text-sm text-[#4c4546] leading-relaxed">
                Write, edit, and collaborate in real-time with an editor that stays out of your way.
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="p-6 border border-[#cfc4c5] rounded-2xl flex flex-col gap-4 hover:bg-white hover:border-black/30 transition-all duration-300 group shadow-sm hover:shadow-md">
              <div className="w-10 h-10 bg-[#e8e8e6] rounded-xl flex items-center justify-center text-[#1a1c1b] group-hover:bg-black group-hover:text-white transition-all duration-300">
                <RefreshCw className="h-5 w-5" />
              </div>
              <h3 className="font-outfit text-lg font-bold text-black">Real-time Sync</h3>
              <p className="text-sm text-[#4c4546] leading-relaxed">
                Changes reflect instantly across all devices. Work from anywhere, anytime.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="p-6 border border-[#cfc4c5] rounded-2xl flex flex-col gap-4 hover:bg-white hover:border-black/30 transition-all duration-300 group shadow-sm hover:shadow-md">
              <div className="w-10 h-10 bg-[#e8e8e6] rounded-xl flex items-center justify-center text-[#1a1c1b] group-hover:bg-black group-hover:text-white transition-all duration-300">
                <FolderOpen className="h-5 w-5" />
              </div>
              <h3 className="font-outfit text-lg font-bold text-black">Organized Projects</h3>
              <p className="text-sm text-[#4c4546] leading-relaxed">
                Hierarchical organization that makes sense. Find exactly what you need in seconds.
              </p>
            </div>
            
            {/* Feature 4 */}
            <div className="p-6 border border-[#cfc4c5] rounded-2xl flex flex-col gap-4 hover:bg-white hover:border-black/30 transition-all duration-300 group shadow-sm hover:shadow-md">
              <div className="w-10 h-10 bg-[#e8e8e6] rounded-xl flex items-center justify-center text-[#1a1c1b] group-hover:bg-black group-hover:text-white transition-all duration-300">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="font-outfit text-lg font-bold text-black">Enterprise Security</h3>
              <p className="text-sm text-[#4c4546] leading-relaxed">
                Bank-grade encryption and granular permissions to keep your data safe and private.
              </p>
            </div>
          </div>
        </section>

        {/* Kanban Board Spotlight */}
        <section id="kanban" className="py-12 mb-24 scroll-mt-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center bg-[#f4f4f2] border border-[#e8e8e6] rounded-3xl p-8 md:p-12 overflow-hidden relative">
            <div className="z-10 max-w-xl">
              <div className="inline-flex items-center gap-1.5 bg-black text-white px-3 py-1 rounded-full mb-6">
                <Zap className="h-3.5 w-3.5 fill-white animate-pulse" />
                <span className="font-outfit text-[11px] font-bold uppercase tracking-wider">Plan & Track</span>
              </div>
              <h2 className="font-outfit text-3xl md:text-4xl font-bold tracking-tight text-black mb-4">
                Plan workflows with Kanban Boards
              </h2>
              <p className="text-base md:text-lg text-[#4c4546] mb-8 leading-relaxed">
                Echo's task management is directly integrated into your project. Drag tasks, update statuses, assign team members, and set priorities without ever leaving your workspace.
              </p>
              <Link 
                href="/signup" 
                className="font-outfit text-sm text-black hover:opacity-85 font-semibold flex items-center gap-1 group transition-colors"
              >
                Explore task boards
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            <div className="relative w-full min-h-[220px] flex items-center justify-center">
              <div className="w-full max-w-sm bg-white border border-[#cfc4c5] rounded-2xl p-6 shadow-lg rotate-2 transform hover:rotate-0 transition-transform duration-500 text-left font-outfit">
                <div className="flex items-center justify-between border-b border-[#f4f4f2] pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
                    <span className="text-xs font-bold uppercase tracking-wider text-black">In Progress</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-[#f4f4f2] rounded-full text-[#4c4546]">High</span>
                </div>
                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-black">Implement collaborative text syncing engine</h4>
                  <div className="flex items-center justify-between pt-2 border-t border-[#f4f4f2]">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-black text-white flex items-center justify-center text-[9px] font-bold uppercase">B</div>
                      <span className="text-[10px] text-[#4c4546]">Barsha</span>
                    </div>
                    <span className="text-[9px] bg-black text-white px-2 py-0.5 rounded font-semibold">Todo → Progress</span>
                  </div>
                </div>
              </div>
              {/* Decorative light blur */}
              <div className="absolute -z-10 w-48 h-48 bg-black/5 blur-3xl rounded-full"></div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section id="cta" className="py-24 mb-16 flex flex-col items-center text-center max-w-3xl mx-auto scroll-mt-20">
          <h2 className="font-outfit text-3xl md:text-5xl font-bold tracking-tight text-black mb-6">
            Start building your workspace today.
          </h2>
          <p className="text-base md:text-lg text-[#4c4546] mb-10 max-w-xl leading-relaxed">
            Join thousands of teams who rely on Echo for their daily operations. No credit card required.
          </p>
          
          <div className="w-full max-w-md">
            <form onSubmit={handleGetStarted} className="flex flex-col sm:flex-row gap-2">
              <input 
                className="flex-1 bg-white border border-[#cfc4c5] rounded-xl px-4 py-3.5 focus:border-black focus:ring-1 focus:ring-black/10 outline-none transition-all text-sm" 
                placeholder="Enter your work email" 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button 
                className="bg-black text-white font-medium text-sm px-6 py-3.5 rounded-xl whitespace-nowrap hover:bg-[#1a1c1b] transition-all shadow-sm active:scale-[0.98]" 
                type="submit"
              >
                Get Started
              </button>
            </form>
            <p className="text-xs text-[#4c4546] mt-4 font-normal">
              Free forever for personal use. Plans for teams start at $8/mo.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-16 bg-white border-t border-[#e8e8e6] mt-12">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="md:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <img 
                alt="Echo Logo" 
                className="w-6 h-6 object-contain" 
                src="/logo.png"
              />
              <span className="font-outfit text-lg font-bold text-black">Echo</span>
            </div>
            <p className="text-xs text-[#4c4546] max-w-xs leading-relaxed">
              © {new Date().getFullYear()} Echo Workspace Inc. Built for deep work.
            </p>
          </div>
          
          <div className="flex flex-col gap-3 text-left">
            <h4 className="font-outfit text-xs font-bold uppercase tracking-wider text-black">Product</h4>
            <ul className="flex flex-col gap-2">
              <li><Link className="text-xs text-[#4c4546] hover:text-black transition-colors" href="/signup">Features</Link></li>
              <li><Link className="text-xs text-[#4c4546] hover:text-black transition-colors" href="/signup">Pricing</Link></li>
              <li><Link className="text-xs text-[#4c4546] hover:text-black transition-colors" href="/signup">Mobile App</Link></li>
            </ul>
          </div>
          
          <div className="flex flex-col gap-3 text-left">
            <h4 className="font-outfit text-xs font-bold uppercase tracking-wider text-black">Solutions</h4>
            <ul className="flex flex-col gap-2">
              <li><Link className="text-xs text-[#4c4546] hover:text-black transition-colors" href="/signup">Engineering</Link></li>
              <li><Link className="text-xs text-[#4c4546] hover:text-black transition-colors" href="/signup">Design</Link></li>
              <li><Link className="text-xs text-[#4c4546] hover:text-black transition-colors" href="/signup">Product</Link></li>
            </ul>
          </div>
          
          <div className="flex flex-col gap-3 text-left">
            <h4 className="font-outfit text-xs font-bold uppercase tracking-wider text-black">Company</h4>
            <ul className="flex flex-col gap-2">
              <li><Link className="text-xs text-[#4c4546] hover:text-black transition-colors" href="/signup">About</Link></li>
              <li><Link className="text-xs text-[#4c4546] hover:text-black transition-colors" href="/signup">Careers</Link></li>
              <li><Link className="text-xs text-[#4c4546] hover:text-black transition-colors" href="/signup">Privacy</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
