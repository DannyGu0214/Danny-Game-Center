// @types/node를 설치하지 않아서(승인한 패키지 목록 밖), 시험에서 쓰는 만큼만 타입을 선언해요.
// 다른 node API를 쓰려면 여기에 더하거나 @types/node 설치를 승인받아요.
declare module 'node:test' {
  export default function test(name: string, fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  const assert: {
    equal<T>(actual: T, expected: T, message?: string): void;
    ok(value: unknown, message?: string): asserts value;
  };
  export default assert;
}
