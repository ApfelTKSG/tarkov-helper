'use client';

import { useEffect } from 'react';

interface TraderTaskSyncProps {
  traderName: string;
  taskIds: string[];
}

// トレーダーのタスクIDをlocalStorageに保存するコンポーネント
export default function TraderTaskSync({ traderName, taskIds }: TraderTaskSyncProps) {
  useEffect(() => {
    localStorage.setItem(`tarkov-trader-tasks-${traderName}`, JSON.stringify(taskIds));
  }, [traderName, taskIds]);

  return null;
}
