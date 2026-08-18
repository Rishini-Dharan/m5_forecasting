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
        <div className="min-h-screen flex flex-col relative overflow-hidden font-body-md text-body-md antialiased selection:bg-primary-container selection:text-on-primary-container bg-background text-on-surface">
            {/* Top Navigation */}
            <header className="bg-background/80 backdrop-blur-xl fixed top-0 left-0 right-0 z-50 border-b border-white/10">
                <div className="max-w-[1440px] mx-auto px-8 py-4 flex justify-between items-center">
                    <a className="font-headline-md text-[24px] font-bold text-primary flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        M5 Forecasting Engine
                    </a>
                    <nav className="hidden md:flex gap-8">
                        <a className="text-on-surface-variant hover:text-primary transition-all duration-300 font-body-sm uppercase tracking-widest cursor-pointer" onClick={() => navigate('/login')}>
                            Workspace
                        </a>
                    </nav>
                    <div className="flex gap-4 items-center hidden md:flex">
                        <button 
                            className="bg-primary-container text-on-primary-container px-6 py-2 rounded-full font-label-caps text-sm hover:bg-primary transition-colors duration-300 border-none cursor-pointer" 
                            onClick={() => navigate('/login')}
                        >
                            Log In
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area with Shader Background */}
            <main className="flex-grow relative flex flex-col justify-center items-center px-4 w-full h-screen z-10 pt-32 pb-20 mt-[72px]">
                {/* Shader Background */}
                <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen pointer-events-none">
                    <ShaderBackground />
                </div>

                {/* Hero Content */}
                <div ref={fadeUpRef} className="relative z-10 flex flex-col items-center text-center max-w-4xl w-full mx-auto fade-up-enter">
                    {/* Enterprise Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1 border border-[rgba(212,175,55,0.15)] rounded-full bg-surface-dim/50 backdrop-blur-md mb-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                        <span className="font-label-caps text-xs text-primary tracking-widest">ENTERPRISE GRADE</span>
                    </div>

                    {/* Main Title */}
                    <h1 className="font-display-lg text-4xl md:text-6xl lg:text-7xl text-on-surface mb-6 tracking-tight leading-[1.1]">
                        Precision Intelligence <br className="hidden md:block"/>
                        for <span className="text-primary-container italic font-light">Retail Demand</span>
                    </h1>

                    {/* Supporting Description */}
                    <p className="font-body-lg text-lg md:text-xl text-on-surface-variant max-w-2xl mb-12 leading-relaxed">
                        Predict retail demand with intelligent forecasting built for precision, speed, and scale. Engineered for the high-stakes decisions that define market leaders.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full sm:w-auto">
                        <button 
                            className="w-full sm:w-auto bg-[#D4AF37] text-[#050505] px-8 py-3 rounded-lg font-label-caps text-sm uppercase tracking-widest hover:bg-[#ffe088] transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] border-none cursor-pointer"
                            onClick={() => navigate('/login')}
                        >
                            Log In
                        </button>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-surface-dim w-full py-8 px-8 flex flex-col md:flex-row justify-between items-center max-w-[1440px] mx-auto border-t border-white/5">
                <div className="font-headline-md text-[24px] text-primary mb-4 md:mb-0">
                    M5 Forecasting Engine
                </div>
                <div className="font-body-sm text-sm text-on-surface-variant mb-4 md:mb-0">
                    © 2024 M5 Forecasting Engine. Precision Intelligence for Enterprise.
                </div>
            </footer>
        </div>
    );
}