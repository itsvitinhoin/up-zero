import { useMemo } from "react";

interface PaginationMetaParams {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  currentPageItemCount?: number;
}

export function usePaginationMeta({
  currentPage,
  pageSize,
  totalItems,
  currentPageItemCount,
}: PaginationMetaParams) {
  return useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
    const pageStartIndex = (safeCurrentPage - 1) * pageSize;
    const pageStart = totalItems === 0 ? 0 : pageStartIndex + 1;

    const derivedPageCount = Math.max(
      0,
      Math.min(pageSize, totalItems - pageStartIndex),
    );

    const effectivePageCount = Math.max(
      0,
      currentPageItemCount ?? derivedPageCount,
    );

    const pageEnd =
      totalItems === 0 ? 0 : pageStart + Math.max(0, effectivePageCount - 1);

    return {
      totalPages,
      safeCurrentPage,
      pageStartIndex,
      pageStart,
      pageEnd,
      totalItems,
    };
  }, [currentPage, pageSize, totalItems, currentPageItemCount]);
}

interface PaginatedListParams<T> {
  items: T[];
  currentPage: number;
  pageSize: number;
}

export function usePaginatedList<T>({
  items,
  currentPage,
  pageSize,
}: PaginatedListParams<T>) {
  const meta = usePaginationMeta({
    currentPage,
    pageSize,
    totalItems: items.length,
  });

  const paginatedItems = useMemo(
    () => items.slice(meta.pageStartIndex, meta.pageStartIndex + pageSize),
    [items, meta.pageStartIndex, pageSize],
  );

  const pageEnd =
    meta.totalItems === 0 ? 0 : meta.pageStart + Math.max(0, paginatedItems.length - 1);

  return {
    ...meta,
    pageEnd,
    paginatedItems,
  };
}
