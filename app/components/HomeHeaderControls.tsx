'use client';

import { useFilterMode } from '../context/FilterModeContext';

export default function HomeHeaderControls() {
    const { kappaMode, setKappaMode, lightkeeperMode, setLightkeeperMode } = useFilterMode();

    return (
        <div className="flex flex-col gap-2">
            {/* Kappa Mode Switch */}
            <div className="flex items-center gap-2 bg-gray-700/50 p-2 rounded-lg border border-gray-600">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-sm font-bold text-orange-400 w-16 text-right">κ Mode</span>
                    <div className="relative">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={kappaMode}
                            onChange={(e) => setKappaMode(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </div>
                </label>
            </div>

            {/* Lightkeeper Mode Switch */}
            <div className="flex items-center gap-2 bg-gray-700/50 p-2 rounded-lg border border-gray-600">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-sm font-bold text-cyan-400 w-16 text-right">LK Mode</span>
                    <div className="relative">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={lightkeeperMode}
                            onChange={(e) => setLightkeeperMode(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                    </div>
                </label>
            </div>
        </div>
    );
}
