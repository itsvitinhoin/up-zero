"use client";

import { useState, useEffect } from "react";
import AdminFiscalPageClient from "@/components/admin/admin-fiscal-page-client";
import { getFiscalNaturesAction, type FiscalOperationNature } from "@/lib/actions/fiscal";

interface FiscalTabProps {
  locale?: string;
  initialNatures: FiscalOperationNature[];
}

export function FiscalTab({ locale: _locale, initialNatures }: FiscalTabProps) {
  const [natures, setNatures] = useState<FiscalOperationNature[]>(initialNatures);
  const [isLoading, setIsLoading] = useState(initialNatures.length === 0);

  useEffect(() => {
    if (initialNatures.length > 0) {
      return;
    }

    let cancelled = false;
    getFiscalNaturesAction().then((data) => {
      if (!cancelled) {
        setNatures(data);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [initialNatures]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Carregando naturezas fiscais...</p>
      </div>
    );
  }

  return <AdminFiscalPageClient initialNatures={natures} />;
}
