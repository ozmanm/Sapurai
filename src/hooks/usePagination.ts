import { useState, useMemo, useEffect } from 'react';

export default function usePagination<T>(items: T[], perPage: number) {
  var [page, setPage] = useState(1);
  var totalPages = Math.max(1, Math.ceil(items.length / perPage));
  var safePage = Math.min(page, totalPages);

  // Reset to page 1 when items change (filter applied)
  useEffect(function () {
    setPage(1);
  }, [items.length]);

  var paginated = useMemo(function () {
    var start = (safePage - 1) * perPage;
    return items.slice(start, start + perPage);
  }, [items, safePage, perPage]);

  return { page: safePage, setPage: setPage, totalPages: totalPages, paginated: paginated, total: items.length };
}
