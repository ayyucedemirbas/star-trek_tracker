'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Settings, BookOpen, Download, RotateCcw, Volume2, VolumeX, X, CalendarPlus, Calendar } from 'lucide-react';

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================
const RANKS = [
  { id: 0, name: 'Crewman', minStreak: 0, color: '#C0C0C0', glow: 'rgba(192,192,192,0.3)' },
  { id: 1, name: 'Ensign', minStreak: 3, color: '#FFD700', glow: 'rgba(255,215,0,0.4)' },
  { id: 2, name: 'Lieutenant', minStreak: 7, color: '#FFA500', glow: 'rgba(255,165,0,0.5)' },
  { id: 3, name: 'Lieutenant Commander', minStreak: 14, color: '#FF8C00', glow: 'rgba(255,140,0,0.6)' },
  { id: 4, name: 'Commander', minStreak: 21, color: '#FFD700', glow: 'rgba(255,215,0,0.7)' },
  { id: 5, name: 'Captain', minStreak: 30, color: '#FFD700', glow: 'rgba(255,215,0,0.8)' },
  { id: 6, name: 'Commodore', minStreak: 45, color: '#4169E1', glow: 'rgba(65,105,225,0.8)' },
  { id: 7, name: 'Admiral', minStreak: 60, color: '#DC143C', glow: 'rgba(220,20,60,0.9)' },
  { id: 8, name: 'Fleet Admiral', minStreak: 90, color: '#FF00FF', glow: 'rgba(255,0,255,0.9)' }
];

const ICONS = [
  { name: 'Enterprise', emoji: '🚀', color: '#FFD700' },
  { name: 'Transporter', emoji: '⚡', color: '#00BFFF' },
  { name: 'Phaser', emoji: '🔫', color: '#FF4500' },
  { name: "Bat'leth", emoji: '⚔️', color: '#8B0000' }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const getStardate = (date) => {
  if (!date) return 'UNKNOWN';
  const d = new Date(date);
  const year = d.getFullYear();
  const dayOfYear = Math.floor((d - new Date(year, 0, 0)) / 86400000);
  return `${year}.${dayOfYear.toString().padStart(3, '0')}`;
};

const getIconForCalories = (calories, minCal, maxCal) => {
  if (!calories || calories === 0) return null;
  const range = maxCal - minCal;
  const position = Math.max(0, Math.min(1, (calories - minCal) / range));
  if (position <= 0.25) return ICONS[0];
  if (position <= 0.50) return ICONS[1];
  if (position <= 0.75) return ICONS[2];
  return ICONS[3];
};

const calculateRank = (data, minCal, maxCal) => {
  const sortedDates = Object.keys(data).sort();
  let currentStreak = 0;
  let maxStreak = 0;
  sortedDates.forEach(dateStr => {
    const calories = data[dateStr];
    if (calories > 0 && calories <= maxCal) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else if (calories > maxCal) {
      currentStreak = 0;
    }
  });
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (maxStreak >= RANKS[i].minStreak) return RANKS[i];
  }
  return RANKS[0];
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
export default function StarTrekDietTracker() {
  const [initialized, setInitialized] = useState(false);
  const [transporting, setTransporting] = useState(true);
  const [minCalories, setMinCalories] = useState(1200);
  const [maxCalories, setMaxCalories] = useState(2000);
  const [calorieData, setCalorieData] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Modals state
  const [showSettings, setShowSettings] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showManualLog, setShowManualLog] = useState(false);
  
  const [logs, setLogs] = useState({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState('warp');
  const [hoveredDate, setHoveredDate] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [rank, setRank] = useState(RANKS[0]);
  const [showRankUp, setShowRankUp] = useState(false);
  
  // Manual Log State
  const [manualDate, setManualDate] = useState('');
  const [manualCal, setManualCal] = useState('');
  const [manualLogText, setManualLogText] = useState('');

  // Hydration fix state
  const [transporterStars, setTransporterStars] = useState([]);
  const [bgStars, setBgStars] = useState([]);
  const [bgDust, setBgDust] = useState([]);

  // ============================================================================
  // AUDIO SYNTHESIZER (No MP3s needed)
  // ============================================================================
  const audioContextRef = useRef(null);

  const playTone = (freq, type = 'sine', duration = 0.1, delay = 0) => {
    if (!soundEnabled) return;
    
    // Initialize AudioContext if it doesn't exist (browsers require user gesture first)
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    
    // Resume context if suspended
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    
    // Envelope for nice "beep" sound
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  };

  const playSound = (action) => {
    switch (action) {
      case 'click': // Standard UI click
        playTone(1200, 'sine', 0.05); // High pitch LCARS beep
        break;
      case 'grid': // Grid click
        playTone(800, 'sine', 0.1); 
        playTone(1200, 'sine', 0.05, 0.05); 
        break;
      case 'open': // Modal open
        playTone(2000, 'sine', 0.05); 
        break;
      case 'success': // Data saved
        playTone(800, 'sine', 0.1);
        playTone(1000, 'sine', 0.1, 0.1);
        playTone(1500, 'sine', 0.2, 0.2);
        break;
      case 'alert': // Reset/Warning
        playTone(200, 'sawtooth', 0.3);
        playTone(150, 'sawtooth', 0.3, 0.2);
        break;
      case 'rankup': // Fanfare
        [440, 554, 659, 880].forEach((freq, i) => playTone(freq, 'sine', 0.2, i * 0.15));
        break;
    }
  };

  // Load from storage and generate random stars
  useEffect(() => {
    // 1. Generate Random Stars (Client Side Only)
    setTransporterStars([...Array(50)].map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 2}s`,
      animationDuration: `${1 + Math.random()}s`
    })));

    setBgStars([...Array(100)].map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      opacity: Math.random() * 0.5 + 0.3,
      animationDuration: `${2 + Math.random() * 3}s`
    })));

    setBgDust([...Array(200)].map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      opacity: Math.random() * 0.7 + 0.3,
      animationDuration: `${2 + Math.random() * 3}s`,
      boxShadow: `0 0 ${Math.random() * 3}px rgba(255,255,255,0.8)`
    })));

    // 2. Load Data
    const stored = localStorage.getItem('starTrekDietData');
    if (stored) {
      const parsed = JSON.parse(stored);
      setMinCalories(parsed.minCalories || 1200);
      setMaxCalories(parsed.maxCalories || 2000);
      setCalorieData(parsed.calorieData || {});
      setLogs(parsed.logs || {});
      setInitialized(true);
      const newRank = calculateRank(parsed.calorieData || {}, parsed.minCalories || 1200, parsed.maxCalories || 2000);
      setRank(newRank);
    }
    setTimeout(() => setTransporting(false), 2000);
  }, []);

  // Save to storage
  useEffect(() => {
    if (initialized) {
      localStorage.setItem('starTrekDietData', JSON.stringify({
        minCalories,
        maxCalories,
        calorieData,
        logs
      }));
      const newRank = calculateRank(calorieData, minCalories, maxCalories);
      if (newRank.id > rank.id) {
        playSound('rankup'); // Play fanfare on rank up
        setRank(newRank);
        setShowRankUp(true);
        setTimeout(() => setShowRankUp(false), 4000);
      }
    }
  }, [calorieData, logs, initialized, minCalories, maxCalories]);

  const generateDates = () => {
    const dates = [];
    // Force start date to November 27, 2025
    const startDate = new Date('2025-11-27T00:00:00');
    
    // Generate 365 days going FORWARD from that date
    for (let i = 0; i < 365; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    return dates;
  };
  const dates = generateDates();

  const handleInitialize = () => {
    playSound('success');
    setInitialized(true);
  };

  const handleDayClick = (date) => {
    playSound('grid');
    setSelectedDate(date);
  };

  const handleCalorieUpdate = (dateStr, calories) => {
    setCalorieData(prev => ({
      ...prev,
      [dateStr]: parseInt(calories) || 0
    }));
  };

  const handleLogUpdate = (dateStr, log) => {
    setLogs(prev => ({
      ...prev,
      [dateStr]: log
    }));
  };

  const handleManualSubmit = () => {
    if (!manualDate) return;
    
    if (manualCal) {
      handleCalorieUpdate(manualDate, manualCal);
    }
    
    if (manualLogText) {
      handleLogUpdate(manualDate, manualLogText);
    }
    
    playSound('success');
    setManualDate('');
    setManualCal('');
    setManualLogText('');
    setShowManualLog(false);
  };

  const handleExport = () => {
    playSound('click');
    const dataStr = JSON.stringify({ minCalories, maxCalories, calorieData, logs }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `starfleet-data-${getStardate(new Date())}.json`;
    a.click();
  };

  const handleReset = () => {
    playSound('alert');
    if (confirm('TEMPORAL RESET DETECTED. All data will be erased and protocol re-initialized. Proceed?')) {
      setCalorieData({});
      setLogs({});
      setRank(RANKS[0]);
      localStorage.removeItem('starTrekDietData');
      setInitialized(false);
    }
  };

  if (transporting) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⚡</div>
          <div className="text-blue-400 text-2xl font-mono animate-pulse">
            ENERGIZING...
          </div>
          <div className="mt-4 text-blue-300 text-sm font-mono">
            Materializing User Interface
          </div>
        </div>
        <div className="absolute inset-0 pointer-events-none">
          {transporterStars.map((style, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-blue-400 rounded-full animate-ping"
              style={style}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="min-h-screen bg-black text-orange-400 p-4 md:p-8 font-mono relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          {bgDust.map((style, i) => (
            <div
              key={i}
              className="absolute w-px h-px bg-white rounded-full"
              style={{
                ...style,
                animation: `twinkle ${style.animationDuration} infinite`
              }}
            />
          ))}
        </div>

        <div className="absolute inset-0 pointer-events-none opacity-10">
          <div className="h-full w-full" style={{
            backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(255, 165, 0, .2) 25%, rgba(255, 165, 0, .2) 26%, transparent 27%, transparent 74%, rgba(255, 165, 0, .2) 75%, rgba(255, 165, 0, .2) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 165, 0, .2) 25%, rgba(255, 165, 0, .2) 26%, transparent 27%, transparent 74%, rgba(255, 165, 0, .2) 75%, rgba(255, 165, 0, .2) 76%, transparent 77%, transparent)',
            backgroundSize: '50px 50px'
          }} />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-8 animate-pulse">
            <div className="text-8xl mb-4">🖖</div>
            <div className="h-1 w-32 bg-gradient-to-r from-transparent via-orange-500 to-transparent mx-auto" />
          </div>

          <div className="relative">
            <div className="absolute -top-2 -left-2 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-lg animate-pulse" />
            <div className="absolute -top-2 -right-2 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-lg animate-pulse" />
            <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-lg animate-pulse" />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-lg animate-pulse" />

            <div className="border-4 border-orange-500 rounded-3xl p-8 md:p-12 bg-gradient-to-br from-orange-900/30 via-blue-900/30 to-purple-900/30 backdrop-blur-sm relative overflow-hidden"
              style={{ boxShadow: '0 0 50px rgba(255,165,0,0.3), inset 0 0 50px rgba(0,0,0,0.5)' }}>

              <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="h-full w-full animate-scan" style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,165,0,0.3) 2px, rgba(255,165,0,0.3) 4px)'
                }} />
              </div>

              <div className="text-center mb-10 relative">
                <div className="inline-block relative">
                  <h1 className="text-5xl md:text-6xl font-bold mb-3 tracking-wider relative"
                    style={{
                       textShadow: '0 0 20px rgba(255,165,0,0.8), 0 0 40px rgba(255,165,0,0.5)',
                      background: 'linear-gradient(45deg, #FF8C00, #FFD700, #FF8C00)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundSize: '200% auto',
                      animation: 'gradient 3s linear infinite'
                    }}>
                    STARFLEET MEDICAL
                  </h1>
                  <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
                </div>

                <h2 className="text-xl md:text-2xl mt-4 text-blue-400 tracking-widest"
                   style={{ textShadow: '0 0 10px rgba(0,191,255,0.6)' }}>
                  DIETARY MONITORING SYSTEM v2.01
                </h2>

                <div className="mt-4 text-sm text-yellow-400 animate-pulse">
                  ⚡ BIOMETRIC CALIBRATION REQUIRED ⚡
                </div>
              </div>

              <div className="space-y-8 mb-10">
                <div className="relative">
                  <div className="absolute -left-4 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                  <label className="block text-lg md:text-xl mb-3 text-orange-400 tracking-wide"
                    style={{ textShadow: '0 0 10px rgba(255,165,0,0.5)' }}>
                    MINIMUM DAILY CALORIES
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={minCalories}
                      onChange={(e) => setMinCalories(parseInt(e.target.value) || 0)}
                      className="w-full bg-black/80 border-2 border-orange-500 rounded-xl p-4 text-orange-400 text-2xl text-center font-bold tracking-wider focus:border-yellow-400 focus:outline-none transition-all"
                      style={{
                         boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8), 0 0 20px rgba(255,165,0,0.2)',
                        textShadow: '0 0 10px rgba(255,165,0,0.5)'
                      }}
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-blue-400 text-sm">CAL</div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -left-4 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-orange-500 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
                  <label className="block text-lg md:text-xl mb-3 text-orange-400 tracking-wide"
                    style={{ textShadow: '0 0 10px rgba(255,165,0,0.5)' }}>
                    MAXIMUM DAILY CALORIES
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={maxCalories}
                      onChange={(e) => setMaxCalories(parseInt(e.target.value) || 0)}
                      className="w-full bg-black/80 border-2 border-orange-500 rounded-xl p-4 text-orange-400 text-2xl text-center font-bold tracking-wider focus:border-yellow-400 focus:outline-none transition-all"
                      style={{
                         boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8), 0 0 20px rgba(255,165,0,0.2)',
                        textShadow: '0 0 10px rgba(255,165,0,0.5)'
                      }}
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-blue-400 text-sm">CAL</div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleInitialize}
                className="w-full bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 hover:from-orange-500 hover:via-yellow-500 hover:to-orange-500 text-black font-bold py-5 rounded-xl text-2xl transition-all transform hover:scale-105 hover:shadow-2xl relative overflow-hidden group"
                style={{
                   boxShadow: '0 0 30px rgba(255,165,0,0.6), inset 0 0 20px rgba(0,0,0,0.3)',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                }}
              >
                <span className="relative z-10 tracking-widest">⚡ INITIALIZE SYSTEM ⚡</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000" />
              </button>

              <div className="mt-10 pt-8 border-t-2 border-orange-500/30 text-center space-y-3">
                <div className="flex items-center justify-center gap-3 text-blue-400 text-lg"
                   style={{ textShadow: '0 0 10px rgba(0,191,255,0.5)' }}>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  <p>STARDATE: {getStardate(new Date())}</p>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                </div>
                <p className="text-yellow-400 tracking-widest text-sm animate-pulse">
                  UNITED FEDERATION OF PLANETS
                </p>
                <div className="flex justify-center gap-2 mt-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-1 h-1 bg-orange-500 rounded-full animate-pulse"
                       style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-8 text-4xl opacity-50">
            <div className="animate-pulse">🚀</div>
            <div className="animate-pulse" style={{ animationDelay: '0.3s' }}>⭐</div>
            <div className="animate-pulse" style={{ animationDelay: '0.6s' }}>🛸</div>
          </div>
        </div>

        <style jsx>{`
          @keyframes scan {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100%); }
          }
          @keyframes gradient {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          .animate-scan {
            animation: scan 8s linear infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-mono ${theme === 'warp' ? 'bg-black' : 'bg-yellow-900/10'}`}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {bgStars.map((style, i) => (
          <div
            key={i}
            className="absolute w-px h-px bg-white rounded-full"
            style={{
              ...style,
              animation: `twinkle ${style.animationDuration} infinite`
            }}
          />
        ))}
      </div>

      {showRankUp && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-black border-4 border-yellow-400 rounded-lg p-8 animate-pulse">
            <div className="text-4xl text-yellow-400 font-bold text-center mb-4">
              RANK PROMOTION
            </div>
            <div className="text-2xl text-blue-400 text-center">
              Congratulations, {rank.name}
            </div>
            <div className="text-center text-orange-400 mt-2">
              Your performance exceeds Starfleet expectations.
            </div>
            <div className="text-6xl text-center mt-4 animate-bounce">
              {rank.id >= 5 ? '⭐' : '🏅'}
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 p-4 md:p-8">
        <div className="max-w-7xl mx-auto mb-8">
          <div className="bg-gradient-to-r from-orange-500/20 to-blue-500/20 border-4 border-orange-500 rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-orange-400">LCARS MEDICAL TRACKER</h1>
                <p className="text-blue-400 text-sm mt-1">Stardate: {getStardate(new Date())}</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-yellow-400 font-bold text-xl" style={{ textShadow: `0 0 10px ${rank.glow}` }}>
                    {rank.name}
                  </div>
                  <div className="text-xs text-orange-400">Current Rank</div>
                </div>

                <button
                  onClick={() => {
                    setSoundEnabled(!soundEnabled);
                    if (!soundEnabled) playSound('click'); // Play sound immediately if turning on
                  }}
                  className="p-3 bg-orange-500/20 border-2 border-orange-500 rounded-lg hover:bg-orange-500/40 transition-colors"
                >
                  {soundEnabled ? <Volume2 className="text-orange-400" /> : <VolumeX className="text-orange-400" />}
                </button>

                <button
                  onClick={() => {
                    playSound('open');
                    setShowSettings(!showSettings);
                  }}
                  className="p-3 bg-orange-500/20 border-2 border-orange-500 rounded-lg hover:bg-orange-500/40 transition-colors"
                >
                  <Settings className="text-orange-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mb-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <button
            onClick={() => {
              playSound('open');
              setShowManualLog(!showManualLog);
            }}
            className="bg-orange-500/20 border-2 border-orange-500 rounded-lg p-4 hover:bg-orange-500/40 transition-all transform hover:scale-105"
          >
            <CalendarPlus className="text-orange-400 mx-auto mb-2" />
            <div className="text-orange-400 text-sm">Manual Log</div>
          </button>
          
          <button
            onClick={() => {
              playSound('open');
              setShowLog(!showLog);
            }}
            className="bg-blue-500/20 border-2 border-blue-500 rounded-lg p-4 hover:bg-blue-500/40 transition-all transform hover:scale-105"
          >
            <BookOpen className="text-blue-400 mx-auto mb-2" />
            <div className="text-blue-400 text-sm">Captain's Log</div>
          </button>

          <button
            onClick={handleExport}
            className="bg-green-500/20 border-2 border-green-500 rounded-lg p-4 hover:bg-green-500/40 transition-all transform hover:scale-105"
          >
            <Download className="text-green-400 mx-auto mb-2" />
            <div className="text-green-400 text-sm">Transmit Data</div>
          </button>

          <button
            onClick={handleReset}
            className="bg-red-500/20 border-2 border-red-500 rounded-lg p-4 hover:bg-red-500/40 transition-all transform hover:scale-105"
          >
            <RotateCcw className="text-red-400 mx-auto mb-2" />
            <div className="text-red-400 text-sm">Temporal Reset</div>
          </button>

          <button
            onClick={() => {
              playSound('click');
              setTheme(theme === 'warp' ? 'holodeck' : 'warp');
            }}
            className="bg-purple-500/20 border-2 border-purple-500 rounded-lg p-4 hover:bg-purple-500/40 transition-all transform hover:scale-105"
          >
            <Calendar className="text-purple-400 mx-auto mb-2" />
            <div className="text-purple-400 text-sm">{theme === 'warp' ? 'Holodeck' : 'Warp'} Mode</div>
          </button>
        </div>

        <div className="max-w-7xl mx-auto mb-8">
          <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-2 border-blue-500 rounded-2xl p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-400">
                  {Object.keys(calorieData).filter(d => calorieData[d] > 0).length}
                </div>
                <div className="text-sm text-orange-400">Days Logged</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-400">
                  {Object.keys(calorieData).filter(d => calorieData[d] <= maxCalories && calorieData[d] > 0).length}
                </div>
                <div className="text-sm text-orange-400">On Target</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-yellow-400">
                  {minCalories} - {maxCalories}
                </div>
                <div className="text-sm text-orange-400">Target Range</div>
              </div>
              <div>
                <div className="text-3xl font-bold" style={{ color: rank.color, textShadow: `0 0 15px ${rank.glow}` }}>
                  {rank.name}
                </div>
                <div className="text-sm text-orange-400">Federation Rank</div>
              </div>
            </div>
          </div>
        </div>

        {/* GRID LAYOUT */}
        <div className="max-w-7xl mx-auto mb-8">
          <div className="bg-black/80 border-4 border-orange-500 rounded-3xl p-6 overflow-x-auto">
            <div className="min-w-[2000px] inline-grid gap-2" style={{ gridTemplateColumns: `repeat(52, minmax(0, 1fr))` }}>
              {dates.map((date, idx) => {
                const dateStr = date.toISOString().split('T')[0];
                const calories = calorieData[dateStr] || 0;
                const icon = getIconForCalories(calories, minCalories, maxCalories);

                return (
                  <div
                    key={idx}
                    onClick={() => handleDayClick(date)}
                    onMouseEnter={(e) => {
                      setHoveredDate(date);
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                    }}
                    onMouseLeave={() => setHoveredDate(null)}
                    className={`relative w-full aspect-square rounded cursor-pointer transition-transform duration-200 hover:scale-125 hover:z-50 ring-inset ${calories > 0 || icon ? 'ring-2' : 'ring-1 ring-gray-800'}`}
                    style={{
                      '--tw-ring-color': icon ? icon.color : (calories > 0 ? '#333' : '#333'),
                      backgroundColor: calories > 0 ? `${icon?.color}20` : '#111',
                      boxShadow: icon ? `0 0 10px ${icon.color}40` : 'none',
                      zIndex: hoveredDate === date ? 50 : 0
                    }}
                  >
                    {icon && (
                      <div className="absolute inset-0 flex items-center justify-center text-lg md:text-xl animate-pulse pointer-events-none">
                        {icon.emoji}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {hoveredDate && (() => {
          const dateStr = hoveredDate.toISOString().split('T')[0];
          const calories = calorieData[dateStr] || 0;
          const icon = getIconForCalories(calories, minCalories, maxCalories);

          let left = tooltipPos.x;
          let top = tooltipPos.y - 10;
          let transform = 'translate(-50%, -100%)';

          if (tooltipPos.y < 120) {
            top = tooltipPos.y + 50;
            transform = 'translate(-50%, 0)';
          }

          if (tooltipPos.x < 150) {
            left = tooltipPos.x + 10;
            transform = top < 120 ? 'translate(0, 0)' : 'translate(0, -100%)';
          }

          if (window.innerWidth - tooltipPos.x < 150) {
            left = tooltipPos.x - 10;
            transform = top < 120 ? 'translate(-100%, 0)' : 'translate(-100%, -100%)';
          }

          return (
            <div
              className="fixed bg-black border-2 border-orange-500 rounded-lg p-3 whitespace-nowrap z-50 pointer-events-none shadow-2xl"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                transform
              }}
            >
              <div className="text-orange-400 font-bold">{dateStr}</div>
              <div className="text-blue-400 text-sm">Stardate: {getStardate(hoveredDate)}</div>
              <div className="text-yellow-400">{calories || 0} cal</div>
              {icon && <div className="text-green-400 text-sm">{icon.name}</div>}
            </div>
          );
        })()}

        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-orange-900/40 to-red-900/40 border-2 border-orange-500 rounded-2xl p-6">
            <h3 className="text-orange-400 font-bold text-xl mb-4">ICON CLASSIFICATION</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ICONS.map((icon, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-black/40 rounded-lg p-3">
                  <div className="text-3xl">{icon.emoji}</div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: icon.color }}>{icon.name}</div>
                    <div className="text-xs text-blue-400">Tier {idx + 1}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedDate && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-orange-900/80 to-blue-900/80 border-4 border-orange-500 rounded-3xl p-8 max-w-md w-full relative">
            <button 
              onClick={() => {
                playSound('click');
                setSelectedDate(null);
              }}
              className="absolute top-4 right-4 text-orange-500 hover:text-orange-300"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold text-orange-400 mb-4">
              DIAGNOSTIC SCAN
            </h2>
            <p className="text-blue-400 mb-4">Stardate: {getStardate(selectedDate)}</p>

            <div className="mb-4">
              <label className="block text-orange-400 mb-2">Caloric Intake</label>
              <input
                type="number"
                value={calorieData[selectedDate.toISOString().split('T')[0]] || ''}
                onChange={(e) => handleCalorieUpdate(selectedDate.toISOString().split('T')[0], e.target.value)}
                className="w-full bg-black border-2 border-orange-500 rounded-lg p-3 text-orange-400"
                placeholder="Enter calories"
              />
            </div>

            <div className="mb-6">
              <label className="block text-orange-400 mb-2">Captain's Log Entry</label>
              <textarea
                value={logs[selectedDate.toISOString().split('T')[0]] || ''}
                onChange={(e) => handleLogUpdate(selectedDate.toISOString().split('T')[0], e.target.value)}
                className="w-full bg-black border-2 border-orange-500 rounded-lg p-3 text-orange-400 h-24"
                placeholder="Personal notes..."
              />
            </div>

            <button
              onClick={() => {
                playSound('success');
                setSelectedDate(null);
              }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold py-3 rounded-lg transition-all transform hover:scale-105"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {showManualLog && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-orange-900/80 to-blue-900/80 border-4 border-orange-500 rounded-3xl p-8 max-w-md w-full relative">
            <button 
              onClick={() => {
                playSound('click');
                setShowManualLog(false);
              }}
              className="absolute top-4 right-4 text-orange-500 hover:text-orange-300"
            >
              <X size={24} />
            </button>
            
            <h2 className="text-2xl font-bold text-orange-400 mb-4">
              MANUAL ENTRY
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-orange-400 mb-2">Select Earth Date</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full bg-black border-2 border-orange-500 rounded-lg p-3 text-orange-400 scheme-dark"
                />
                {manualDate && (
                  <div className="text-blue-400 text-sm mt-2 text-right">
                    STARDATE COMPUTED: {getStardate(new Date(manualDate))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-orange-400 mb-2">Caloric Intake</label>
                <input
                  type="number"
                  value={manualCal}
                  onChange={(e) => setManualCal(e.target.value)}
                  placeholder="0"
                  className="w-full bg-black border-2 border-orange-500 rounded-lg p-3 text-orange-400"
                />
              </div>

              <div>
                <label className="block text-orange-400 mb-2">Log Entry (Optional)</label>
                <textarea
                  value={manualLogText}
                  onChange={(e) => setManualLogText(e.target.value)}
                  className="w-full bg-black border-2 border-orange-500 rounded-lg p-3 text-orange-400 h-24"
                  placeholder="Supplemental entry..."
                />
              </div>
            </div>

            <button
              onClick={handleManualSubmit}
              disabled={!manualDate}
              className="w-full mt-8 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-3 rounded-lg transition-all"
            >
              UPLOAD DATA
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-orange-900/80 to-blue-900/80 border-4 border-orange-500 rounded-3xl p-8 max-w-md w-full relative">
            <button 
              onClick={() => {
                playSound('click');
                setShowSettings(false);
              }}
              className="absolute top-4 right-4 text-orange-500 hover:text-orange-300"
            >
              <X size={24} />
            </button>
            
            <h2 className="text-2xl font-bold text-orange-400 mb-4">
              SYSTEM CONFIGURATION
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-orange-400 mb-2">Minimum Daily Calories</label>
                <input
                  type="number"
                  value={minCalories}
                  onChange={(e) => setMinCalories(parseInt(e.target.value) || 0)}
                  className="w-full bg-black border-2 border-orange-500 rounded-lg p-3 text-orange-400"
                />
              </div>

              <div>
                <label className="block text-orange-400 mb-2">Maximum Daily Calories</label>
                <input
                  type="number"
                  value={maxCalories}
                  onChange={(e) => setMaxCalories(parseInt(e.target.value) || 0)}
                  className="w-full bg-black border-2 border-orange-500 rounded-lg p-3 text-orange-400"
                />
              </div>
            </div>

            <button
              onClick={() => {
                playSound('success');
                setShowSettings(false);
              }}
              className="w-full mt-8 bg-orange-500 hover:bg-orange-600 text-black font-bold py-3 rounded-lg transition-all"
            >
              SAVE PARAMETERS
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}