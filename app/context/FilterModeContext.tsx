'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface FilterModeContextType {
    kappaMode: boolean;
    setKappaMode: (value: boolean) => void;
    lightkeeperMode: boolean;
    setLightkeeperMode: (value: boolean) => void;
    isLoading: boolean;
}

const FilterModeContext = createContext<FilterModeContextType | undefined>(undefined);

export function FilterModeProvider({ children }: { children: React.ReactNode }) {
    const [kappaMode, setKappaModeState] = useState(false);
    const [lightkeeperMode, setLightkeeperModeState] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Initial load from localStorage
        const savedKappa = localStorage.getItem('tarkov-kappa-mode');
        const savedLightkeeper = localStorage.getItem('tarkov-lightkeeper-mode');

        if (savedKappa) setKappaModeState(savedKappa === 'true');
        if (savedLightkeeper) setLightkeeperModeState(savedLightkeeper === 'true');

        setIsLoading(false);
    }, []);

    const setKappaMode = (value: boolean) => {
        setKappaModeState(value);
        localStorage.setItem('tarkov-kappa-mode', String(value));
    };

    const setLightkeeperMode = (value: boolean) => {
        setLightkeeperModeState(value);
        localStorage.setItem('tarkov-lightkeeper-mode', String(value));
    };

    return (
        <FilterModeContext.Provider
            value={{
                kappaMode,
                setKappaMode,
                lightkeeperMode,
                setLightkeeperMode,
                isLoading
            }}
        >
            {children}
        </FilterModeContext.Provider>
    );
}

export function useFilterMode() {
    const context = useContext(FilterModeContext);
    if (context === undefined) {
        throw new Error('useFilterMode must be used within a FilterModeProvider');
    }
    return context;
}
