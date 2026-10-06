import type { Availability, TaskState } from './progression';

export function taskGraphStatus(state: TaskState, availability: Availability['state']) {
  if (state === 'complete') return { label: '完了', background: '#064e3b', borderColor: '#34d399' };
  if (state === 'failed') return { label: '失敗', background: '#1e293b', borderColor: '#f87171' };
  if (availability === 'eligible')
    return { label: '', background: '#064e3b', borderColor: '#34d399' };
  return {
    label: availability === 'blocked' ? '条件未達' : '要確認',
    background: '#1e293b',
    borderColor: availability === 'blocked' ? '#f87171' : '#fbbf24',
  };
}
