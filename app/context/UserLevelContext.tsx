
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UserLevelContextType {
    userLevel: number;
    setUserLevel: (level: number) => void;
}

const UserLevelContext = createContext<UserLevelContextType | undefined>(undefined);

export function UserLevelProvider({ children }: { children: ReactNode }) {
    // デフォルトはレベル1、または保存された値
    const [userLevel, setUserLevel] = useState<number>(1);

    // 初期ロード
    useEffect(() => {
        const savedLevel = localStorage.getItem('tarkov-user-level');
        if (savedLevel) {
            setUserLevel(parseInt(savedLevel, 10));
        }
    }, []);

    // 変更時に保存
    const updateUserLevel = (level: number) => {
        setUserLevel(level);
        localStorage.setItem('tarkov-user-level', level.toString());
    };

    return (
        <UserLevelContext.Provider value={{ userLevel, setUserLevel: updateUserLevel }}>
            {children}
        </UserLevelContext.Provider>
    );
}

export function useUserLevel() {
    const context = useContext(UserLevelContext);
    if (context === undefined) {
        throw new Error('useUserLevel must be used within a UserLevelProvider');
    }
    return context;
}
