import type { Availability, TaskState } from './progression';
import type { GameTask } from './game';

const currencies = [
  ['5449016a4bdc2d6f028b456f', '₽'],
  ['5696686a4bdc2da3298b456a', '$'],
  ['569668774bdc2da2298b4568', '€'],
] as const;

export function taskRewardLabels(task: GameTask) {
  const amounts = new Map<string, number>();
  for (const reward of task.finishRewards?.items ?? [])
    amounts.set(reward.item, (amounts.get(reward.item) ?? 0) + reward.count);
  const money = currencies
    .filter(([id]) => (amounts.get(id) ?? 0) > 0)
    .map(([id, symbol]) => `${amounts.get(id)!.toLocaleString('ja-JP')} ${symbol}`)
    .join(' / ');
  return {
    experience: `${(task.experience ?? 0).toLocaleString('ja-JP')} XP`,
    money: money || 'お金なし',
  };
}

export function taskGraphStatus(state: TaskState, availability: Availability['state']) {
  if (state === 'complete')
    return { label: '完了', background: '#064e3b', borderColor: '#34d399', opacity: 1 };
  if (state === 'failed')
    return { label: '失敗', background: '#7f1d1d', borderColor: '#f87171', opacity: 1 };
  if (state === 'active' || availability === 'eligible')
    return { label: '受注中', background: '#374151', borderColor: '#9ca3af', opacity: 1 };
  return {
    label: availability === 'blocked' ? '条件未達' : '要確認',
    background: '#374151',
    borderColor: '#9ca3af',
    opacity: 0.4,
  };
}
