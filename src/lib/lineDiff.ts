export type DiffLine = {
  type: 'ctx' | 'add' | 'del';
  text: string;
  oldNo?: number;
  newNo?: number;
};

/** Простой построчный diff для карточек правок */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.replace(/\r\n/g, '\n').split('\n');
  const b = after.replace(/\r\n/g, '\n').split('\n');
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'ctx', text: a[i], oldNo: i + 1, newNo: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i], oldNo: i + 1 });
      i++;
    } else {
      out.push({ type: 'add', text: b[j], newNo: j + 1 });
      j++;
    }
  }
  while (i < n) {
    out.push({ type: 'del', text: a[i], oldNo: i + 1 });
    i++;
  }
  while (j < m) {
    out.push({ type: 'add', text: b[j], newNo: j + 1 });
    j++;
  }
  return out;
}

/** Сжимает длинный diff: контекст вокруг изменений */
export function compactDiff(lines: DiffLine[], ctx = 2): DiffLine[] {
  if (lines.length <= 80) return lines;
  const keep = new Set<number>();
  lines.forEach((l, idx) => {
    if (l.type !== 'ctx') {
      for (let k = Math.max(0, idx - ctx); k <= Math.min(lines.length - 1, idx + ctx); k++) {
        keep.add(k);
      }
    }
  });
  if (!keep.size) return lines.slice(0, 40);
  const out: DiffLine[] = [];
  let last = -2;
  for (const idx of [...keep].sort((x, y) => x - y)) {
    if (last >= 0 && idx > last + 1) {
      out.push({ type: 'ctx', text: '…' });
    }
    out.push(lines[idx]);
    last = idx;
  }
  return out;
}
