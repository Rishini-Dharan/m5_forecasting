import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ShaderBackground from '../components/ShaderBackground';

export default function LandingPage() {
    const navigate = useNavigate();
    const fadeUpRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Trigger fade up animation on mount
        const el = fadeUpRef.current;
        if (el) {
            const timer = setTimeout(() => {
                el.classList.add('fade-up-enter-active');
                el.classList.remove('fade-up-enter');
            }, 100);
            return () => clearTimeout(timer);
        }
    }, []);

    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden font-body-md text-body-md antialiased selection:bg-primary-container selection:text-on-primary-container">
            {/* Top Navigation */}
            <header className="bg-background/80 backdrop-blur-xl docked full-width top-0 border-b border-white/10 flat no shadows fixed left-0 w-full z-50 flex justify-between items-center px-lg py-sm max-w-[1440px] mx-auto">
                <a className="font-headline-md text-headline-md font-bold text-primary flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                    M5 Forecasting Engine
                </a>
                <nav className="hidden md:flex gap-lg">
                    <a className="text-on-surface-variant hover:text-primary transition-all duration-300 font-body-sm text-body-sm uppercase tracking-widest cursor-pointer" onClick={() => navigate('/dashboard')}>Workspace</a>
                </nav>
                <div className="flex gap-md items-center hidden md:flex">
                    <button 
                        className="text-on-surface-variant hover:text-primary transition-all duration-300 font-body-sm text-body-sm uppercase tracking-widest cursor-pointer bg-transparent border-none" 
                        onClick={() => navigate('/login')}
                    >
                        Log In
                    </button>
                    <button 
                        className="bg-primary-container text-on-primary-container px-lg py-xs rounded-full font-label-caps text-label-caps hover:bg-primary transition-colors duration-300 border-none cursor-pointer" 
                        onClick={() => navigate('/signup')}
                    >
                        Sign Up
                    </button>
                </div>
            </header>

            {/* Main Content Area with Shader Background */}
            <main className="flex-grow relative flex flex-col justify-center items-center px-4 w-full h-screen z-10 pt-huge pb-giant mt-[72px]">
                {/* Shader Background */}
                <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen pointer-events-none">
                    <ShaderBackground />
                </div>

                {/* Hero Content */}
                <div ref={fadeUpRef} className="relative z-10 flex flex-col items-center text-center max-w-4xl w-full mx-auto fade-up-enter">
                    {/* Enterprise Badge */}
                    <div className="inline-flex items-center gap-xs px-md py-xxs border gold-border rounded-full bg-surface-dim/50 backdrop-blur-md mb-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                        <span className="font-label-caps text-label-caps text-primary tracking-widest">ENTERPRISE GRADE</span>
                    </div>

                    {/* Main Title */}
                    <h1 className="font-display-lg text-display-lg text-on-surface mb-lg tracking-tight md:text-[64px] leading-[1.1]">
                        Precision Intelligence <br className="hidden md:block"/>
                        for <span className="text-primary-container italic font-light">Retail Demand</span>
                    </h1>

                    {/* Supporting Description */}
                    <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mb-xxl md:text-[20px] leading-relaxed">
                        Predict retail demand with intelligent forecasting built for precision, speed, and scale. Engineered for the high-stakes decisions that define market leaders.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-md items-center justify-center w-full sm:w-auto">
                        <button 
                            className="w-full sm:w-auto bg-[#D4AF37] text-[#050505] px-xl py-sm rounded-lg font-label-caps text-label-caps hover:bg-[#ffe088] transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] border-none cursor-pointer"
                            onClick={() => navigate('/signup')}
                        >
                            Sign Up
                        </button>
                        <button 
                            className="w-full sm:w-auto border border-[rgba(212,175,55,0.15)] text-[#F5F3EE] px-xl py-sm rounded-lg font-label-caps text-label-caps hover:border-[rgba(212,175,55,0.5)] hover:text-primary-container transition-all duration-300 bg-[rgba(20,20,20,0.5)] backdrop-blur-md cursor-pointer"
                            onClick={() => navigate('/login')}
                        >
                            Log In
                        </button>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-surface-dim w-full py-xl px-lg flex flex-col md:flex-row justify-between items-center max-w-[1440px] mx-auto border-t border-white/5 flat no shadows z-10 relative">
                <div className="font-headline-md text-headline-md text-primary mb-md md:mb-0">
                    M5 Forecasting Engine
                </div>
                <div className="font-body-sm text-body-sm text-on-surface-variant mb-md md:mb-0">
                    © 2024 M5 Forecasting Engine. Precision Intelligence for Enterprise.
                </div>
            </footer>
        </div>
    );
}
