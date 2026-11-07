import { z } from "zod";

export const digits = (value: string) => value.replace(/\D/g, "");
export function cpfValido(value: string): boolean {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const size of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i);
    const remainder = (sum * 10) % 11;
    if ((remainder === 10 ? 0 : remainder) !== Number(cpf[size])) return false;
  }
  return true;
}
export function deveValidarCpf(cpf: string, original?: string) {
  return original === undefined || digits(cpf) !== digits(original);
}
export function podeAlterarPapel(proprio: boolean, papel: string | null) {
  return !proprio || papel === "SINDICO";
}
export const podeAcessarSindico = (papel: string | null | undefined) => papel === "SINDICO";
export function maskCpf(value: string) {
  return digits(value).slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}
export function maskPhone(value: string) {
  const d = digits(value).slice(0, 11);
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(d.length === 11 ? /(\d{5})(\d{4})$/ : /(\d{4})(\d{4})$/, "$1-$2");
}
export const moradorSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome completo.").max(120, "Nome muito longo."),
  cpf: z.string().transform(digits).pipe(z.string().regex(/^\d{11}$/, "O CPF deve ter 11 dígitos.")),
  telefone: z.string().transform(digits).refine(v => !v || v.length === 10 || v.length === 11, "Telefone deve ter 10 ou 11 dígitos."),
  apartamento_id: z.string().uuid("Selecione um apartamento."),
  tipo_morador: z.enum(["PROPRIETARIO", "INQUILINO", "DEPENDENTE"]),
  status: z.enum(["ATIVO", "INATIVO", "BLOQUEADO"]),
});
export const apartamentoSchema = z.object({
  bloco: z.string().trim().min(1, "Informe o bloco.").max(30, "Bloco muito longo."),
  numero: z.string().trim().min(1, "Informe o número.").max(20, "Número muito longo."),
});
export function erroDados(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : "";
  if (code === "23505") return "Já existe um cadastro com esses dados.";
  if (code === "42501") return "Você não tem permissão para esta ação.";
  if (code === "23514") return "Verifique os campos: os dados não atendem às regras do cadastro.";
  return "Não foi possível concluir. Verifique sua conexão e tente novamente.";
}