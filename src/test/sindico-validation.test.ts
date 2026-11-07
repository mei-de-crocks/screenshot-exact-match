import { describe, it, expect } from "vitest";
import { cpfValido, deveValidarCpf, podeAlterarPapel, podeAcessarSindico } from "@/lib/sindico-validation";
describe("Regras do síndico", () => {
  it("valida CPF novo pelos dígitos verificadores", () => {
    expect(deveValidarCpf("52998224725")).toBe(true);
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224724")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
  });
  it("não bloqueia CPF de exemplo inalterado na edição", () => {
    expect(deveValidarCpf("000.000.000-01", "00000000001")).toBe(false);
  });
  it("valida CPF quando alterado", () => {
    expect(deveValidarCpf("00000000002", "00000000001")).toBe(true);
    expect(cpfValido("00000000002")).toBe(false);
  });
  it("impede remover o próprio acesso de síndico", () => {
    expect(podeAlterarPapel(true, null)).toBe(false);
    expect(podeAlterarPapel(true, "PORTEIRO")).toBe(false);
    expect(podeAlterarPapel(true, "SINDICO")).toBe(true);
    expect(podeAlterarPapel(false, null)).toBe(true);
  });
  it("permite área somente ao síndico", () => {
    expect(podeAcessarSindico("SINDICO")).toBe(true);
    expect(podeAcessarSindico("PORTEIRO")).toBe(false);
    expect(podeAcessarSindico(null)).toBe(false);
  });
});