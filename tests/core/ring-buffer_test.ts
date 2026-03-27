import { assertEquals, assertStrictEquals, assertThrows } from '@std/assert';

import { RingBuffer } from '../../src/core/ring-buffer.ts';

Deno.test('RingBuffer validates capacity', () => {
  assertThrows(() => new RingBuffer(0), RangeError, 'capacity must be a positive integer');
  assertThrows(() => new RingBuffer(-1), RangeError, 'capacity must be a positive integer');
  assertThrows(() => new RingBuffer(1.5), RangeError, 'capacity must be a positive integer');
});

Deno.test('RingBuffer stores values until full without overwriting', () => {
  const buffer = new RingBuffer<number>(3);

  assertStrictEquals(buffer.push(10), undefined);
  assertStrictEquals(buffer.push(20), undefined);

  assertStrictEquals(buffer.size, 2);
  assertStrictEquals(buffer.isFull, false);
  assertStrictEquals(buffer.oldest(), 10);
  assertStrictEquals(buffer.at(0), 10);
  assertStrictEquals(buffer.at(1), 20);
  assertStrictEquals(buffer.at(2), undefined);
  assertEquals(buffer.values(), [10, 20]);
});

Deno.test('RingBuffer overwrites the oldest value when full and preserves order', () => {
  const buffer = new RingBuffer<number>(3);

  buffer.push(10);
  buffer.push(20);
  buffer.push(30);

  assertStrictEquals(buffer.isFull, true);
  assertStrictEquals(buffer.push(40), 10);
  assertStrictEquals(buffer.oldest(), 20);
  assertStrictEquals(buffer.at(0), 20);
  assertStrictEquals(buffer.at(1), 30);
  assertStrictEquals(buffer.at(2), 40);
  assertEquals(buffer.values(), [20, 30, 40]);
});

Deno.test('RingBuffer continues rotating across multiple overwrites', () => {
  const buffer = new RingBuffer<number>(2);

  buffer.push(1);
  buffer.push(2);
  buffer.push(3);
  buffer.push(4);

  assertStrictEquals(buffer.size, 2);
  assertStrictEquals(buffer.oldest(), 3);
  assertEquals(buffer.values(), [3, 4]);
});

Deno.test('RingBuffer returns undefined for empty and out-of-bounds reads', () => {
  const buffer = new RingBuffer<number>(2);

  assertStrictEquals(buffer.oldest(), undefined);
  assertStrictEquals(buffer.at(-1), undefined);
  assertStrictEquals(buffer.at(0), undefined);
  assertEquals(buffer.values(), []);

  buffer.push(5);

  assertStrictEquals(buffer.at(1), undefined);
  assertStrictEquals(buffer.at(99), undefined);
});
