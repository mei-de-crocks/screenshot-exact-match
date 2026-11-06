import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  LogIn,
  LogOut,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/portaria")({
  head: () => ({
    meta: [
      { title: "Painel da Portaria — Portaria Condominial" },
      { name: "description", content: "Registre entradas e saídas de moradores, visitantes e prestadores." },
    ],
  }),
  component: PortariaPage,
});

type Morador = Tables<"moradores"> & { apartamentos: { bloco: string; numero: string } | null };
type EstadoMorador = Tables<"estado_moradores">;
type Registro = Tables<"registros_acesso"> & {
  moradores: { nome: string } | null;
  apartamentos: { bloco: string; numero: string } | null;
};
type VisitanteDentro = Tables<"visitantes_dentro"> & {
  apartamentos: { bloco: string; numero: string } | null;
};

type RegistroPayload = {
  p_tipo_pessoa: "MORADOR" | "VISITANTE" | "PRESTADOR";
  p_morador_id?: string;
  p_nome_visitante?: string;
  p_documento_visitante?: string;
  p_apartamento_destino_id?: string;
  p_tipo_fluxo: "ENTRADA" | "SAIDA";
  p_observacao?: string;
  p_confirmar_excecao?: boolean;
};

const ROTULO_TIPO_MORADOR: Record<string, string> = {
  PROPRIETARIO: "Proprietário",
  INQUILINO: "Inquilino",
  DEPENDENTE: "Dependente",
};

const ROTULO_TIPO_PESSOA: Record<string, string> = {
  MORADOR: "Morador",
  VISITANTE: "Visitante",
  PRESTADOR: "Prestador",
};

function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatarHora(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "dd/MM 'às' HH:mm", { locale: ptBR });
}

function PortariaPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ---- Sessão e perfil ----
  const { data: usuario, isLoading: carregandoUsuario } = useQuery({
    queryKey: ["usuario"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
    staleTime: Infinity,
  });

  const { data: perfil, isLoading: carregandoPerfil } = useQuery({
    queryKey: ["perfil", usuario?.id],
    enabled: !!usuario,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis")
        .select("*")
        .eq("user_id", usuario!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const papel = perfil?.papel ?? null;
  const podeOperar = papel === "PORTEIRO" || papel === "SINDICO";

  // ---- Dados de apoio ----
  const { data: apartamentos = [] } = useQuery({
    queryKey: ["apartamentos"],
    enabled: podeOperar,
    queryFn: async () => {
      const { data, error } = await supabase.from("apartamentos").select("*").order("bloco").order("numero");
      if (error) throw error;
      return data;
    },
  });

  const { data: estados = [], refetch: refetchEstados } = useQuery({
    queryKey: ["estado_moradores"],
    enabled: podeOperar,
    queryFn: async () => {
      const { data, error } = await supabase.from("estado_moradores").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: registros = [], refetch: refetchRegistros } = useQuery({
    queryKey: ["ultimos_registros"],
    enabled: podeOperar,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_acesso")
        .select("*, moradores(nome), apartamentos(bloco, numero)")
        .order("data_hora", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as Registro[];
    },
  });

  const { data: perfisLista = [] } = useQuery({
    queryKey: ["perfis_emails"],
    enabled: podeOperar,
    queryFn: async () => {
      const { data, error } = await supabase.from("perfis").select("user_id, email");
      if (error) throw error;
      return data;
    },
  });

  const { data: visitantesDentro = [], refetch: refetchVisitantes } = useQuery({
    queryKey: ["visitantes_dentro"],
    enabled: podeOperar,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitantes_dentro")
        .select("*, apartamentos(bloco, numero)")
        .order("entrada_em", { ascending: false });
      if (error) throw error;
      return data as VisitanteDentro[];
    },
  });

  const mapaEstado = useMemo(() => {
    const m = new Map<string, EstadoMorador>();
    for (const e of estados) if (e.morador_id) m.set(e.morador_id, e);
    return m;
  }, [estados]);

  const mapaEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of perfisLista) if (p.email) m.set(p.user_id, p.email);
    return m;
  }, [perfisLista]);

  // ---- Busca de morador ----
  const [termo, setTermo] = useState("");
  const [termoBusca, setTermoBusca] = useState("");
  const inputBuscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(termo.trim()), 300);
    return () => clearTimeout(t);
  }, [termo]);

  const { data: resultados = [], isFetching: buscando } = useQuery({
    queryKey: ["busca_moradores", termoBusca],
    enabled: podeOperar && termoBusca.length >= 2,
    queryFn: async () => {
      const seguro = termoBusca.replace(/[(),.]/g, " ");
      const digitos = termoBusca.replace(/\D/g, "");
      const filtros = [`nome.ilike.%${seguro}%`];
      if (digitos.length >= 2) filtros.push(`cpf.ilike.%${digitos}%`);
      const { data, error } = await supabase
        .from("moradores")
        .select("*, apartamentos(bloco, numero)")
        .or(filtros.join(","))
        .order("nome")
        .limit(8);
      if (error) throw error;
      return data as Morador[];
    },
  });

  const [moradorSel, setMoradorSel] = useState<Morador | null>(null);
  const estadoSel = moradorSel ? mapaEstado.get(moradorSel.id) : undefined;

  // ---- Registro de acesso (sempre via RPC registrar_acesso) ----
  const [registrando, setRegistrando] = useState(false);
  const [excecao, setExcecao] = useState<{ mensagem: string; payload: RegistroPayload } | null>(null);

  async function executarRegistro(payload: RegistroPayload) {
    setRegistrando(true);
    try {
      const { data, error } = await supabase.rpc("registrar_acesso", payload);
      if (error) {
        toast.error(error.message || "Não foi possível registrar. Tente novamente.");
        return;
      }
      const r = data as { sucesso?: boolean; inconsistencia?: boolean; mensagem?: string } | null;
      if (r?.inconsistencia) {
        setExcecao({ mensagem: r.mensagem ?? "Inconsistência detectada.", payload });
        return;
      }
      if (r?.sucesso) {
        toast.success(
          payload.p_tipo_fluxo === "ENTRADA" ? "Entrada registrada com sucesso." : "Saída registrada com sucesso.",
        );
        setMoradorSel(null);
        setTermo("");
        setTermoBusca("");
        await Promise.all([refetchEstados(), refetchRegistros(), refetchVisitantes()]);
        inputBuscaRef.current?.focus();
      }
    } finally {
      setRegistrando(false);
    }
  }

  function registrarMorador(fluxo: "ENTRADA" | "SAIDA") {
    if (!moradorSel) return;
    void executarRegistro({
      p_tipo_pessoa: "MORADOR",
      p_morador_id: moradorSel.id,
      p_tipo_fluxo: fluxo,
    });
  }

  // ---- Visitante / Prestador ----
  const [formVisitanteAberto, setFormVisitanteAberto] = useState(false);
  const [vTipo, setVTipo] = useState<"VISITANTE" | "PRESTADOR">("VISITANTE");
  const [vNome, setVNome] = useState("");
  const [vDocumento, setVDocumento] = useState("");
  const [vApartamento, setVApartamento] = useState("");
  const [vObservacao, setVObservacao] = useState("");
  const [erroVisitante, setErroVisitante] = useState<string | null>(null);

  function enviarVisitante(e: FormEvent) {
    e.preventDefault();
    setErroVisitante(null);
    if (vNome.trim().length < 2) {
      setErroVisitante("Informe o nome completo.");
      return;
    }
    if (vDocumento.trim().length < 3) {
      setErroVisitante("Informe o documento (RG ou CPF).");
      return;
    }
    if (!vApartamento) {
      setErroVisitante("Selecione o apartamento de destino.");
      return;
    }
    void executarRegistro({
      p_tipo_pessoa: vTipo,
      p_nome_visitante: vNome.trim(),
      p_documento_visitante: vDocumento.trim(),
      p_apartamento_destino_id: vApartamento,
      p_tipo_fluxo: "ENTRADA",
      p_observacao: vObservacao.trim() || undefined,
    }).then(() => {
      setVNome("");
      setVDocumento("");
      setVApartamento("");
      setVObservacao("");
      setFormVisitanteAberto(false);
    });
  }

  function saidaVisitante(v: VisitanteDentro) {
    if (!v.documento_visitante || !v.nome_visitante) return;
    void executarRegistro({
      p_tipo_pessoa: (v.tipo_pessoa as "VISITANTE" | "PRESTADOR") ?? "VISITANTE",
      p_nome_visitante: v.nome_visitante,
      p_documento_visitante: v.documento_visitante,
      p_apartamento_destino_id: v.apartamento_destino_id ?? undefined,
      p_tipo_fluxo: "SAIDA",
    });
  }

  // ---- Sair ----
  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // ---- Estados de carregamento / sem papel ----
  if (carregandoUsuario || carregandoPerfil) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Carregando" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">Portaria Condominial</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {perfil && (
              <div className="flex items-center gap-2 text-sm">
                <span className="hidden text-muted-foreground sm:inline">{perfil.email}</span>
                {papel && (
                  <Badge variant="secondary">{papel === "SINDICO" ? "Síndico" : "Porteiro"}</Badge>
                )}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={sair}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {!podeOperar ? (
          <Card className="mx-auto mt-10 max-w-md text-center">
            <CardHeader>
              <CardTitle>Aguardando liberação do síndico</CardTitle>
              <CardDescription>
                Sua conta foi criada, mas ainda não tem um perfil de acesso. Peça ao síndico para liberar seu
                cadastro como porteiro.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            {/* Busca de morador */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Buscar morador
                </CardTitle>
                <CardDescription>Digite o nome ou o CPF (com ou sem pontuação).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input
                    ref={inputBuscaRef}
                    autoFocus
                    value={termo}
                    onChange={(e) => {
                      setTermo(e.target.value);
                      setMoradorSel(null);
                    }}
                    placeholder="Nome ou CPF do morador…"
                    className="h-14 text-lg"
                    aria-label="Buscar morador por nome ou CPF"
                  />
                  {buscando && (
                    <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>

                {!moradorSel && termoBusca.length >= 2 && !buscando && resultados.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum morador encontrado para essa busca.</p>
                )}

                {!moradorSel && resultados.length > 0 && (
                  <ul className="divide-y rounded-md border">
                    {resultados.map((m) => {
                      const est = mapaEstado.get(m.id);
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setMoradorSel(m);
                              setTermo(m.nome);
                            }}
                            className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-accent"
                          >
                            <span className="font-medium">{m.nome}</span>
                            <span className="text-sm text-muted-foreground">
                              Bloco {m.apartamentos?.bloco} · Apto {m.apartamentos?.numero}
                            </span>
                            <span className="ml-auto flex gap-2">
                              <Badge variant="outline">{ROTULO_TIPO_MORADOR[m.tipo_morador] ?? m.tipo_morador}</Badge>
                              {est?.estado === "DENTRO" ? (
                                <Badge className="bg-success text-success-foreground">Dentro</Badge>
                              ) : (
                                <Badge variant="destructive">Fora</Badge>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Card do morador selecionado */}
                {moradorSel && (
                  <div className="space-y-4 rounded-lg border bg-card p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xl font-semibold">{moradorSel.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          Bloco {moradorSel.apartamentos?.bloco} · Apartamento {moradorSel.apartamentos?.numero} ·{" "}
                          {ROTULO_TIPO_MORADOR[moradorSel.tipo_morador] ?? moradorSel.tipo_morador} · CPF{" "}
                          {formatarCpf(moradorSel.cpf)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant={moradorSel.status === "ATIVO" ? "secondary" : "destructive"}
                          className={moradorSel.status === "ATIVO" ? "bg-success/15 text-success" : undefined}
                        >
                          Cadastro {moradorSel.status === "ATIVO" ? "ativo" : moradorSel.status === "INATIVO" ? "inativo" : "bloqueado"}
                        </Badge>
                        {estadoSel?.estado === "DENTRO" ? (
                          <Badge className="bg-success text-success-foreground">Dentro</Badge>
                        ) : (
                          <Badge variant="destructive">Fora</Badge>
                        )}
                      </div>
                    </div>

                    {moradorSel.status !== "ATIVO" && (
                      <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                        Morador com cadastro {moradorSel.status === "INATIVO" ? "inativo" : "bloqueado"}: não é
                        possível registrar entrada ou saída. Procure o síndico.
                      </p>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Button
                        size="lg"
                        className="h-16 bg-success text-lg text-success-foreground hover:bg-success/90"
                        disabled={moradorSel.status !== "ATIVO" || registrando}
                        onClick={() => registrarMorador("ENTRADA")}
                      >
                        <LogIn className="mr-2 h-6 w-6" />
                        Registrar Entrada
                      </Button>
                      <Button
                        size="lg"
                        variant="destructive"
                        className="h-16 text-lg"
                        disabled={moradorSel.status !== "ATIVO" || registrando}
                        onClick={() => registrarMorador("SAIDA")}
                      >
                        <LogOut className="mr-2 h-6 w-6" />
                        Registrar Saída
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Visitantes e prestadores */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Visitantes e prestadores
                      </CardTitle>
                      <CardDescription>No condomínio agora: {visitantesDentro.length}</CardDescription>
                    </div>
                    <Button onClick={() => setFormVisitanteAberto((v) => !v)} variant={formVisitanteAberto ? "outline" : "default"}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      {formVisitanteAberto ? "Fechar" : "+ Visitante / Prestador"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formVisitanteAberto && (
                    <form onSubmit={enviarVisitante} className="space-y-3 rounded-lg border bg-muted/40 p-4" noValidate>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="v-tipo">Tipo</Label>
                          <Select value={vTipo} onValueChange={(v) => setVTipo(v as "VISITANTE" | "PRESTADOR")}>
                            <SelectTrigger id="v-tipo">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="VISITANTE">Visitante</SelectItem>
                              <SelectItem value="PRESTADOR">Prestador de serviço</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="v-apto">Apartamento de destino</Label>
                          <Select value={vApartamento} onValueChange={setVApartamento}>
                            <SelectTrigger id="v-apto">
                              <SelectValue placeholder="Selecione…" />
                            </SelectTrigger>
                            <SelectContent>
                              {apartamentos.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  Bloco {a.bloco} · Apto {a.numero}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="v-nome">Nome completo</Label>
                        <Input id="v-nome" value={vNome} onChange={(e) => setVNome(e.target.value)} maxLength={120} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="v-doc">Documento (RG ou CPF)</Label>
                        <Input id="v-doc" value={vDocumento} onChange={(e) => setVDocumento(e.target.value)} maxLength={20} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="v-obs">Observação (opcional)</Label>
                        <Textarea id="v-obs" value={vObservacao} onChange={(e) => setVObservacao(e.target.value)} maxLength={300} rows={2} />
                      </div>
                      {erroVisitante && (
                        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                          {erroVisitante}
                        </p>
                      )}
                      <Button type="submit" className="w-full bg-success text-success-foreground hover:bg-success/90" disabled={registrando}>
                        {registrando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registrar entrada
                      </Button>
                    </form>
                  )}

                  {visitantesDentro.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum visitante ou prestador no condomínio no momento.</p>
                  ) : (
                    <ul className="divide-y rounded-md border">
                      {visitantesDentro.map((v) => (
                        <li key={`${v.documento_visitante}-${v.entrada_em}`} className="flex flex-wrap items-center gap-2 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{v.nome_visitante}</p>
                            <p className="text-sm text-muted-foreground">
                              {ROTULO_TIPO_PESSOA[v.tipo_pessoa ?? ""] ?? v.tipo_pessoa} · Bloco {v.apartamentos?.bloco} · Apto{" "}
                              {v.apartamentos?.numero} · entrou {formatarHora(v.entrada_em)}
                            </p>
                          </div>
                          <Button variant="destructive" size="sm" disabled={registrando} onClick={() => saidaVisitante(v)}>
                            Registrar saída
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Últimas movimentações */}
              <Card>
                <CardHeader>
                  <CardTitle>Últimas movimentações</CardTitle>
                  <CardDescription>Os 10 registros mais recentes.</CardDescription>
                </CardHeader>
                <CardContent>
                  {registros.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ainda não há registros.</p>
                  ) : (
                    <ul className="divide-y rounded-md border">
                      {registros.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                          <Badge
                            className={
                              r.tipo_fluxo === "ENTRADA" ? "bg-success text-success-foreground" : undefined
                            }
                            variant={r.tipo_fluxo === "ENTRADA" ? "default" : "destructive"}
                          >
                            {r.tipo_fluxo === "ENTRADA" ? "Entrada" : "Saída"}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">
                              {r.tipo_pessoa === "MORADOR" ? r.moradores?.nome : r.nome_visitante}
                              <span className="ml-2 text-sm font-normal text-muted-foreground">
                                {ROTULO_TIPO_PESSOA[r.tipo_pessoa] ?? r.tipo_pessoa}
                              </span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {r.apartamentos ? `Bloco ${r.apartamentos.bloco} · Apto ${r.apartamentos.numero} · ` : ""}
                              {formatarHora(r.data_hora)}
                              {r.registrado_por && (
                                <> · por {mapaEmail.get(r.registrado_por) ?? (r.registrado_por === usuario?.id ? "você" : "—")}</>
                              )}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>

      {/* Diálogo de exceção (dupla entrada / dupla saída) */}
      <AlertDialog open={!!excecao} onOpenChange={(aberto) => !aberto && setExcecao(null)}>
        <AlertDialogContent className="border-destructive">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Atenção: inconsistência detectada</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground">
              {excecao?.mensagem}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setExcecao(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (excecao) {
                  void executarRegistro({ ...excecao.payload, p_confirmar_excecao: true });
                }
                setExcecao(null);
              }}
            >
              Confirmar exceção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
