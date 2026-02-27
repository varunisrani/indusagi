import { describe, expect, it } from "vitest";
import { EventStream } from "../../../src/ai/utils/event-stream.js";

describe("EventStream", () => {
  it("stores bounded history", () => {
    const stream = new EventStream<number, number>((n) => n === 3, (n) => n, { historyLimit: 2 });
    stream.push(1);
    stream.push(2);
    stream.push(3);
    expect(stream.getHistory()).toEqual([2, 3]);
  });

  it("maps and filters", async () => {
    const streamForFilter = new EventStream<number, number>((n) => n === 3, (n) => n);
    streamForFilter.push(1);
    streamForFilter.push(2);
    streamForFilter.push(3);

    const values: number[] = [];
    for await (const v of streamForFilter.filter((n) => n % 2 === 1)) {
      values.push(v);
    }
    expect(values).toEqual([1, 3]);

    const streamForMap = new EventStream<number, number>((n) => n === 3, (n) => n);
    streamForMap.push(1);
    streamForMap.push(2);
    streamForMap.push(3);

    const mapped: string[] = [];
    for await (const v of streamForMap.map((n) => `n=${n}`)) {
      mapped.push(v);
    }
    expect(mapped).toEqual(["n=1", "n=2", "n=3"]);
  });

  it("supports timeout for result", async () => {
    const stream = new EventStream<number, number>((n) => n === 1, (n) => n);
    await expect(stream.resultWithTimeout(5)).rejects.toThrow(/timed out/i);
  });
});
