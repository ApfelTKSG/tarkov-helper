import test from 'node:test';
import assert from 'node:assert/strict';
import { taskGraphStatus, taskRewardLabels } from '../src/domain/task-presentation.ts';

test('completion cash rewards keep currencies separate and ignore non-currency items', () => {
  assert.deepEqual(
    taskRewardLabels({
      experience: 12000,
      finishRewards: {
        items: [
          { item: '5449016a4bdc2d6f028b456f', count: 80000 },
          { item: '5449016a4bdc2d6f028b456f', count: 10000 },
          { item: '5696686a4bdc2da3298b456a', count: 1000 },
          { item: '569668774bdc2da2298b4568', count: 500 },
          { item: 'weapon', count: 3 },
        ],
      },
      failureOutcome: { items: [{ item: '5449016a4bdc2d6f028b456f', count: 999 }] },
    }),
    { experience: '12,000 XP', money: '90,000 ₽ / 1,000 $ / 500 €' },
  );
  assert.deepEqual(taskRewardLabels({}), { experience: '0 XP', money: 'お金なし' });
});

test('eligible active and unstarted tasks are green with no availability or acceptance caption', () => {
  for (const state of ['active', 'unstarted']) {
    assert.deepEqual(taskGraphStatus(state, 'eligible'), {
      label: '',
      background: '#064e3b',
      borderColor: '#34d399',
    });
    assert.equal(taskGraphStatus(state, 'blocked').label, '条件未達');
    assert.equal(taskGraphStatus(state, 'unknown').label, '要確認');
  }
});
test('recorded complete and failed states remain visible independent of current gates', () => {
  assert.equal(taskGraphStatus('complete', 'blocked').label, '完了');
  assert.equal(taskGraphStatus('complete', 'blocked').borderColor, '#34d399');
  assert.equal(taskGraphStatus('failed', 'eligible').label, '失敗');
});
