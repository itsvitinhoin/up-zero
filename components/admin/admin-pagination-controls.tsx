import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface AdminPaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
  showing?: {
    start: number;
    end: number;
    total: number;
  };
}

export default function AdminPaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 5,
  showing,
}: AdminPaginationControlsProps) {
  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages));
  const sideWindow = Math.floor(maxVisiblePages / 2);

  let visibleStartPage = Math.max(1, safeCurrentPage - sideWindow);
  let visibleEndPage = Math.min(totalPages, visibleStartPage + maxVisiblePages - 1);

  if (visibleEndPage - visibleStartPage + 1 < maxVisiblePages) {
    visibleStartPage = Math.max(1, visibleEndPage - maxVisiblePages + 1);
  }

  const visiblePages = Array.from(
    { length: Math.max(0, visibleEndPage - visibleStartPage + 1) },
    (_, index) => visibleStartPage + index,
  );

  return (
    <div className="flex items-center justify-between rounded-xl border border-border/20 bg-card p-3">
      {showing ? (
        <p className="text-sm text-muted-foreground">
          Mostrando <span className="font-medium text-foreground">{showing.start}</span>-<span className="font-medium text-foreground">{showing.end}</span> de{" "}
          <span className="font-medium text-foreground">{showing.total}</span>
        </p>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => onPageChange(1)}
          aria-label="Primeira página"
          disabled={safeCurrentPage <= 1}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          aria-label="Página anterior"
          disabled={safeCurrentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {visiblePages.map((pageNumber) => (
          <Button
            key={pageNumber}
            variant={pageNumber === safeCurrentPage ? "default" : "outline"}
            size="sm"
            className="cursor-pointer min-w-9"
            onClick={() => onPageChange(pageNumber)}
            disabled={pageNumber === safeCurrentPage}
          >
            {pageNumber}
          </Button>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          aria-label="Próxima página"
          disabled={safeCurrentPage >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => onPageChange(totalPages)}
          aria-label="Última página"
          disabled={safeCurrentPage >= totalPages}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
