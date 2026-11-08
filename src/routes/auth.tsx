import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Condômino Control – Portaria" },
      { name: "description", content: "Acesse o painel da portaria com seu e-mail e senha." },
      { property: "og:title", content: "Entrar — Condômino Control – Portaria" },
      { property: "og:description", content: "Acesse o painel da portaria com seu e-mail e senha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const credenciaisSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido").max(255, "E-mail muito longo"),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres").max(72, "Senha muito longa"),
});

function mensagemErroAuth(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (m.includes("user already registered")) return "Este e-mail já possui uma conta. Tente entrar.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
  return "Não foi possível concluir. Tente novamente.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [verificandoSessao, setVerificandoSessao] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/portaria", replace: true });
      } else {
        setVerificandoSessao(false);
      }
    });
  }, [navigate]);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);

    const parsed = credenciaisSchema.safeParse({ email, senha });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Verifique os campos.");
      return;
    }

    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.senha,
        });
        if (error) {
          setErro(mensagemErroAuth(error.message));
          return;
        }
        navigate({ to: "/portaria" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.senha,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) {
          setErro(mensagemErroAuth(error.message));
          return;
        }
        if (data.session) {
          navigate({ to: "/portaria" });
        } else {
          setAviso("Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirme para poder entrar.");
          setModo("entrar");
          setSenha("");
        }
      }
    } finally {
      setCarregando(false);
    }
  }

  if (verificandoSessao) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Carregando" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Condômino Control – Portaria</CardTitle>
          <CardDescription>
            {modo === "entrar"
              ? "Entre com seu e-mail e senha para acessar o painel."
              : "Crie sua conta para acessar o painel da portaria."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={aoEnviar} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={carregando}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                placeholder="Mínimo de 6 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={carregando}
                required
              />
            </div>

            {erro && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {erro}
              </p>
            )}
            {aviso && (
              <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-sm font-medium text-success">
                {aviso}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={carregando}>
              {carregando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {modo === "entrar" ? "Entrar" : "Criar conta"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setModo(modo === "entrar" ? "criar" : "entrar");
                setErro(null);
                setAviso(null);
              }}
              className="w-full text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {modo === "entrar" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
