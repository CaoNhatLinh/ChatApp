// Compare canonical CQL timeuuid order, including messages created in the same millisecond.
export function compareMessageIds(left: string, right: string): number | null {
  const key = (id: string) => {
    if (!/^[\da-f]{8}-[\da-f]{4}-1[\da-f]{3}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) return null;
    const [low, mid, high, clock, node] = id.split('-');
    return [BigInt(`0x${high.slice(1)}${mid}${low}`), BigInt.asIntN(64, BigInt(`0x${clock}${node}`) ^ 0x0080808080808080n)];
  };
  const a = key(left), b = key(right);
  if (!a || !b) return null;
  return a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1;
}
