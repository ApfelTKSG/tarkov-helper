import test from 'node:test';
import assert from 'node:assert/strict';
import { taskGraphStatus } from '../src/domain/task-presentation.ts';

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
