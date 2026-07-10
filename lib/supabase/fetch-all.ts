/**
 * Fetch every row a PostgREST query would return, paging past the server's
 * default 1,000-row response cap.
 *
 * Supabase/PostgREST caps un-ranged `select()` responses at 1,000 rows. Any
 * page that pulls a whole table into JS to count or sort it (e.g. counting a
 * customer's loads across ~1,900 shipments) silently truncates once the table
 * crosses that threshold, making totals wrong. Pass a factory that builds the
 * query fresh each call — builders are single-use — and this pages through
 * `.range()` windows until the table is exhausted.
 *
 *   const ships = await fetchAll(() =>
 *     supabase.from("shipments").select("exhibitor_id, show_id, pickup_date"),
 *   );
 */
export async function fetchAll<Row>(
  makeQuery: () => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<Row[]> {
  const all: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    // `.range()` narrows this call's window; the factory rebuilds the query so
    // each page starts from a clean builder.
    const query = makeQuery() as PromiseLike<{ data: Row[] | null; error: { message: string } | null }> & {
      range: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
    };
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}
