import { assertEquals, assertStrictEquals, assertThrows } from '@std/assert';

import { RingBuffer } from '../../src/core/ring-buffer.ts';
import { CLOSES } from '../fixtures/daily-closes.ts';

Deno.test('RingBuffer validates capacity before allocating storage', () => {
  for (const capacity of [0, -1, 20.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assertThrows(() => new RingBuffer(capacity), RangeError);
  }
});

Deno.test('RingBuffer stores close observations until its window is full', () => {
  const buffer = new RingBuffer<number>(3);
  const firstCloses = CLOSES.slice(0, 3);

  assertStrictEquals(buffer.push(firstCloses[0]!), undefined);
  assertStrictEquals(buffer.push(firstCloses[1]!), undefined);

  assertStrictEquals(buffer.size, 2);
  assertStrictEquals(buffer.isFull, false);
  assertStrictEquals(buffer.oldest(), firstCloses[0]);
  assertStrictEquals(buffer.at(0), firstCloses[0]);
  assertStrictEquals(buffer.at(1), firstCloses[1]);
  assertStrictEquals(buffer.at(2), undefined);
  assertEquals(buffer.values(), firstCloses.slice(0, 2));
});

Deno.test('RingBuffer replaces the oldest close and preserves chronological order', () => {
  const buffer = new RingBuffer<number>(3);
  const closes = CLOSES.slice(0, 4);

  for (const close of closes.slice(0, 3)) {
    buffer.push(close);
  }

  assertStrictEquals(buffer.isFull, true);
  assertStrictEquals(buffer.push(closes[3]!), closes[0]);
  assertStrictEquals(buffer.oldest(), closes[1]);
  assertStrictEquals(buffer.at(0), closes[1]);
  assertStrictEquals(buffer.at(1), closes[2]);
  assertStrictEquals(buffer.at(2), closes[3]);
  assertEquals(buffer.values(), closes.slice(1));
});

Deno.test('RingBuffer keeps rotating over successive market observations', () => {
  const buffer = new RingBuffer<number>(2);
  const closes = CLOSES.slice(0, 5);

  for (const close of closes) {
    buffer.push(close);
  }

  assertStrictEquals(buffer.size, 2);
  assertStrictEquals(buffer.oldest(), closes[3]);
  assertEquals(buffer.values(), closes.slice(-2));
});

Deno.test('RingBuffer returns undefined for empty and out-of-window reads', () => {
  const buffer = new RingBuffer<number>(2);

  assertStrictEquals(buffer.oldest(), undefined);
  assertStrictEquals(buffer.at(-1), undefined);
  assertStrictEquals(buffer.at(0), undefined);
  assertEquals(buffer.values(), []);

  buffer.push(CLOSES[0]!);

  assertStrictEquals(buffer.at(1), undefined);
  assertStrictEquals(buffer.at(99), undefined);
});
