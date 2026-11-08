import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Condômino Control – Portaria" },
      {
        name: "description",
        content:
          "Sistema de controle de acesso da portaria: registro de entrada e saída de moradores, visitantes e prestadores.",
      },
      { property: "og:title", content: "Condômino Control – Portaria" },
      {
        property: "og:description",
        content: "Controle de acesso da portaria: entradas e saídas de moradores, visitantes e prestadores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      navigate({ to: data.session ? "/portaria" : "/auth", replace: true });
    });
    return () => {
      ativo = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Carregando" />
    </div>
  );
}
