'use client';

import { useFilterMode } from '../context/FilterModeContext';
import { useUserLevel } from '../context/UserLevelContext';

export default function HomeHeaderControls() {
    const { kappaMode, setKappaMode, lightkeeperMode, setLightkeeperMode } = useFilterMode();
    const { userLevel, setUserLevel } = useUserLevel();

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

            {/* User Level Input */}
            <div className="flex items-center gap-2 bg-gray-700/50 p-2 rounded-lg border border-gray-600">
                <label className="flex items-center gap-2 select-none w-full">
                    <span className="text-sm font-bold text-gray-300 w-12 text-right">Lv.</span>
                    <input
                        type="number"
                        min="1"
                        max="79"
                        value={userLevel}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) setUserLevel(val);
                        }}
                        className="w-16 bg-gray-800 text-white font-bold text-center border border-gray-600 rounded focus:outline-none focus:border-yellow-500"
                    />
                </label>
            </div>
        </div>
    );
}
