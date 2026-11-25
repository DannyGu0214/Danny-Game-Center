import assert from 'node:assert/strict';
import test from 'node:test';
import { createState, MAX_STEP, SPIN_SPEED, step } from '../src/sim/rules.ts';

test('회전은 시간에 비례하고, 긴 멈춤은 잘라내며, 한 바퀴 안에 머물러요', () => {
  assert.equal(step(createState(), 0.05).angle, SPIN_SPEED * 0.05);
  assert.equal(step(createState(), 10).angle, SPIN_SPEED * MAX_STEP);
  assert.equal(step(createState(), -1).angle, 0);

  const wrapped = step({ angle: Math.PI * 2 - 0.01 }, MAX_STEP).angle;
  assert.ok(wrapped >= 0 && wrapped < SPIN_SPEED * MAX_STEP);
});
