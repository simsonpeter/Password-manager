export interface NameCandidate {
  id: string;
  name: string;
  businessName?: string;
}

export interface SimilarName {
  id: string;
  name: string;
  reason: "exact" | "similar";
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function levenshtein(left: string, right: string): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix: number[][] = [];
  for (let row = 0; row < rows; row += 1) {
    const line: number[] = [];
    for (let col = 0; col < cols; col += 1) {
      if (row === 0) line.push(col);
      else if (col === 0) line.push(row);
      else line.push(0);
    }
    matrix.push(line);
  }
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      const current = matrix[row];
      const previous = matrix[row - 1];
      if (!current || !previous) continue;
      const deletion = (previous[col] ?? 0) + 1;
      const insertion = (current[col - 1] ?? 0) + 1;
      const substitution = (previous[col - 1] ?? 0) + cost;
      current[col] = Math.min(deletion, insertion, substitution);
    }
  }
  return matrix[left.length]?.[right.length] ?? Math.max(left.length, right.length);
}

export function findSimilarClients(
  name: string,
  clients: NameCandidate[],
  excludeId?: string,
): SimilarName[] {
  const normalized = normalizeName(name);
  if (!normalized) return [];
  const matches: SimilarName[] = [];
  for (const client of clients) {
    if (excludeId && client.id === excludeId) continue;
    const candidates = [client.name, client.businessName ?? ""].map(normalizeName).filter(Boolean);
    for (const candidate of candidates) {
      if (candidate === normalized) {
        matches.push({ id: client.id, name: client.name, reason: "exact" });
        break;
      }
      const longest = Math.max(candidate.length, normalized.length);
      if (longest < 5) continue;
      const distance = levenshtein(candidate, normalized);
      if (distance / longest <= 0.2) {
        matches.push({ id: client.id, name: client.name, reason: "similar" });
        break;
      }
    }
  }
  return matches;
}
