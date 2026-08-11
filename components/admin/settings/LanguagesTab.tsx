"use client";

import { Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LanguagesTab() {
  return (
    <Card id="languages" className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Idiomas
        </CardTitle>
        <CardDescription>
          Configurações de idioma do painel e da loja.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Este módulo de idiomas está disponível e pode ser expandido com opções avançadas.
        </p>
      </CardContent>
    </Card>
  );
}
