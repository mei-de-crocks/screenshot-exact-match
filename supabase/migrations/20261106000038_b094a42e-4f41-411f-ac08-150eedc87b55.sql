-- ENUMS
CREATE TYPE public.papel_usuario AS ENUM ('PORTEIRO','SINDICO');
CREATE TYPE public.tipo_morador AS ENUM ('PROPRIETARIO','INQUILINO','DEPENDENTE');
CREATE TYPE public.status_morador AS ENUM ('ATIVO','INATIVO','BLOQUEADO');
CREATE TYPE public.tipo_pessoa AS ENUM ('MORADOR','VISITANTE','PRESTADOR');
CREATE TYPE public.tipo_fluxo AS ENUM ('ENTRADA','SAIDA');

-- PERFIS
CREATE TABLE public.perfis (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  papel public.papel_usuario,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.perfis TO authenticated;
GRANT ALL ON public.perfis TO service_role;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- APARTAMENTOS
CREATE TABLE public.apartamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco text NOT NULL,
  numero text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bloco, numero)
);
GRANT SELECT, INSERT, UPDATE ON public.apartamentos TO authenticated;
GRANT ALL ON public.apartamentos TO service_role;
ALTER TABLE public.apartamentos ENABLE ROW LEVEL SECURITY;

-- MORADORES
CREATE TABLE public.moradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartamento_id uuid NOT NULL REFERENCES public.apartamentos(id) ON DELETE RESTRICT,
  nome varchar(150) NOT NULL,
  cpf char(11) NOT NULL UNIQUE CHECK (cpf ~ '^[0-9]{11}$'),
  telefone text,
  tipo_morador public.tipo_morador NOT NULL DEFAULT 'DEPENDENTE',
  status public.status_morador NOT NULL DEFAULT 'ATIVO',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_moradores_cpf ON public.moradores(cpf);
CREATE INDEX idx_moradores_nome ON public.moradores(nome);
CREATE INDEX idx_moradores_apartamento ON public.moradores(apartamento_id);
GRANT SELECT, INSERT, UPDATE ON public.moradores TO authenticated;
GRANT ALL ON public.moradores TO service_role;
ALTER TABLE public.moradores ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_moradores_atualizado_em BEFORE UPDATE ON public.moradores
FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

-- REGISTROS DE ACESSO
CREATE TABLE public.registros_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_pessoa public.tipo_pessoa NOT NULL,
  morador_id uuid REFERENCES public.moradores(id) ON DELETE RESTRICT,
  nome_visitante text,
  documento_visitante text,
  apartamento_destino_id uuid REFERENCES public.apartamentos(id) ON DELETE RESTRICT,
  tipo_fluxo public.tipo_fluxo NOT NULL,
  data_hora timestamptz NOT NULL DEFAULT now(),
  observacao text,
  registrado_por uuid,
  CONSTRAINT chk_registro_campos CHECK (
    (tipo_pessoa = 'MORADOR' AND morador_id IS NOT NULL)
    OR (tipo_pessoa <> 'MORADOR' AND nome_visitante IS NOT NULL
        AND documento_visitante IS NOT NULL AND apartamento_destino_id IS NOT NULL)
  )
);
CREATE INDEX idx_registros_data_hora ON public.registros_acesso(data_hora);
CREATE INDEX idx_registros_morador ON public.registros_acesso(morador_id);
CREATE INDEX idx_registros_documento ON public.registros_acesso(documento_visitante);
GRANT SELECT ON public.registros_acesso TO authenticated;
GRANT ALL ON public.registros_acesso TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.registros_acesso FROM anon, authenticated;
ALTER TABLE public.registros_acesso ENABLE ROW LEVEL SECURITY;

-- FUNÇÃO AUXILIAR DE PAPEL
CREATE OR REPLACE FUNCTION public.papel_atual()
RETURNS public.papel_usuario LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT papel FROM public.perfis WHERE user_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.papel_atual() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.papel_atual() TO authenticated;

-- POLICIES
CREATE POLICY "perfis_ler_proprio_ou_sindico" ON public.perfis FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.papel_atual() = 'SINDICO');
CREATE POLICY "perfis_sindico_altera" ON public.perfis FOR UPDATE TO authenticated
  USING (public.papel_atual() = 'SINDICO') WITH CHECK (public.papel_atual() = 'SINDICO');

CREATE POLICY "apartamentos_ler" ON public.apartamentos FOR SELECT TO authenticated
  USING (public.papel_atual() IN ('PORTEIRO','SINDICO'));
CREATE POLICY "apartamentos_inserir" ON public.apartamentos FOR INSERT TO authenticated
  WITH CHECK (public.papel_atual() = 'SINDICO');
CREATE POLICY "apartamentos_alterar" ON public.apartamentos FOR UPDATE TO authenticated
  USING (public.papel_atual() = 'SINDICO') WITH CHECK (public.papel_atual() = 'SINDICO');

CREATE POLICY "moradores_ler" ON public.moradores FOR SELECT TO authenticated
  USING (public.papel_atual() IN ('PORTEIRO','SINDICO'));
CREATE POLICY "moradores_inserir" ON public.moradores FOR INSERT TO authenticated
  WITH CHECK (public.papel_atual() = 'SINDICO');
CREATE POLICY "moradores_alterar" ON public.moradores FOR UPDATE TO authenticated
  USING (public.papel_atual() = 'SINDICO') WITH CHECK (public.papel_atual() = 'SINDICO');

CREATE POLICY "registros_ler" ON public.registros_acesso FOR SELECT TO authenticated
  USING (public.papel_atual() IN ('PORTEIRO','SINDICO'));

-- PERFIL AUTOMÁTICO
CREATE OR REPLACE FUNCTION public.handle_novo_usuario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('perfis_primeiro_sindico'));
  INSERT INTO public.perfis (user_id, email, papel)
  VALUES (NEW.id, NEW.email,
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.perfis) THEN 'SINDICO'::public.papel_usuario ELSE NULL END);
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_novo_usuario() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_novo_usuario();

-- RPC registrar_acesso
CREATE OR REPLACE FUNCTION public.registrar_acesso(
  p_tipo_pessoa public.tipo_pessoa,
  p_morador_id uuid DEFAULT NULL,
  p_nome_visitante text DEFAULT NULL,
  p_documento_visitante text DEFAULT NULL,
  p_apartamento_destino_id uuid DEFAULT NULL,
  p_tipo_fluxo public.tipo_fluxo DEFAULT 'ENTRADA',
  p_observacao text DEFAULT NULL,
  p_confirmar_excecao boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_papel public.papel_usuario;
  v_status public.status_morador;
  v_ultimo public.tipo_fluxo;
  v_obs text := p_observacao;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  SELECT papel INTO v_papel FROM public.perfis WHERE user_id = auth.uid();
  IF v_papel IS NULL OR v_papel NOT IN ('PORTEIRO','SINDICO') THEN
    RAISE EXCEPTION 'Sem permissão para registrar acesso';
  END IF;

  IF p_tipo_pessoa = 'MORADOR' THEN
    SELECT status INTO v_status FROM public.moradores WHERE id = p_morador_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Morador não encontrado'; END IF;
    IF v_status <> 'ATIVO' THEN RAISE EXCEPTION 'Morador inativo ou bloqueado'; END IF;

    SELECT tipo_fluxo INTO v_ultimo FROM public.registros_acesso
      WHERE morador_id = p_morador_id ORDER BY data_hora DESC LIMIT 1;
    IF v_ultimo IS NOT NULL AND v_ultimo = p_tipo_fluxo THEN
      IF NOT p_confirmar_excecao THEN
        RETURN jsonb_build_object('sucesso', false, 'inconsistencia', true,
          'mensagem', CASE WHEN p_tipo_fluxo = 'ENTRADA'
            THEN 'Morador já consta como DENTRO (dupla entrada). Confirme a exceção para registrar.'
            ELSE 'Morador já consta como FORA (dupla saída). Confirme a exceção para registrar.' END);
      END IF;
      v_obs := 'EXCEÇÃO CONFIRMADA: ' || coalesce(p_observacao, '');
    END IF;
  END IF;

  INSERT INTO public.registros_acesso (tipo_pessoa, morador_id, nome_visitante, documento_visitante,
    apartamento_destino_id, tipo_fluxo, data_hora, observacao, registrado_por)
  VALUES (p_tipo_pessoa,
    CASE WHEN p_tipo_pessoa = 'MORADOR' THEN p_morador_id END,
    p_nome_visitante, p_documento_visitante, p_apartamento_destino_id,
    p_tipo_fluxo, now(), v_obs, auth.uid());

  RETURN jsonb_build_object('sucesso', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.registrar_acesso(public.tipo_pessoa, uuid, text, text, uuid, public.tipo_fluxo, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_acesso(public.tipo_pessoa, uuid, text, text, uuid, public.tipo_fluxo, text, boolean) TO authenticated;

-- VIEWS
CREATE VIEW public.estado_moradores WITH (security_invoker = true) AS
SELECT m.id AS morador_id, m.nome, m.cpf, m.apartamento_id, a.bloco, a.numero, m.status,
  CASE WHEN u.tipo_fluxo = 'ENTRADA' THEN 'DENTRO' ELSE 'FORA' END AS estado,
  u.data_hora AS ultimo_registro
FROM public.moradores m
JOIN public.apartamentos a ON a.id = m.apartamento_id
LEFT JOIN LATERAL (
  SELECT r.tipo_fluxo, r.data_hora FROM public.registros_acesso r
  WHERE r.morador_id = m.id ORDER BY r.data_hora DESC LIMIT 1
) u ON true;

CREATE VIEW public.visitantes_dentro WITH (security_invoker = true) AS
SELECT * FROM (
  SELECT DISTINCT ON (r.documento_visitante)
    r.documento_visitante, r.nome_visitante, r.tipo_pessoa, r.apartamento_destino_id,
    r.tipo_fluxo, r.data_hora AS entrada_em, r.observacao
  FROM public.registros_acesso r
  WHERE r.tipo_pessoa IN ('VISITANTE','PRESTADOR')
  ORDER BY r.documento_visitante, r.data_hora DESC
) ult WHERE ult.tipo_fluxo = 'ENTRADA';

GRANT SELECT ON public.estado_moradores, public.visitantes_dentro TO authenticated;
GRANT SELECT ON public.estado_moradores, public.visitantes_dentro TO service_role;

-- RETENÇÃO 30 DIAS (03:00 horário de Brasília = 06:00 UTC)
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('limpeza_registros_acesso_30d', '0 6 * * *',
  $$DELETE FROM public.registros_acesso WHERE data_hora < now() - interval '30 days'$$);

-- DADOS DE EXEMPLO (fictícios)
INSERT INTO public.apartamentos (id, bloco, numero) VALUES
  ('11111111-0000-0000-0000-000000000001','A','101'),
  ('11111111-0000-0000-0000-000000000002','A','102'),
  ('11111111-0000-0000-0000-000000000003','B','201');

INSERT INTO public.moradores (id, apartamento_id, nome, cpf, telefone, tipo_morador, status) VALUES
  ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','Ana Souza','00000000001','(11) 90000-0001','PROPRIETARIO','ATIVO'),
  ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','Bruno Souza','00000000002',NULL,'DEPENDENTE','ATIVO'),
  ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000002','Carla Lima','00000000003','(11) 90000-0003','INQUILINO','ATIVO'),
  ('22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000002','Diego Lima','00000000004',NULL,'DEPENDENTE','INATIVO'),
  ('22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000003','Elisa Rocha','00000000005','(11) 90000-0005','PROPRIETARIO','ATIVO'),
  ('22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000003','Fábio Rocha','00000000006',NULL,'DEPENDENTE','BLOQUEADO');

INSERT INTO public.registros_acesso (tipo_pessoa, morador_id, nome_visitante, documento_visitante, apartamento_destino_id, tipo_fluxo, data_hora, observacao) VALUES
  ('MORADOR','22222222-0000-0000-0000-000000000001',NULL,NULL,NULL,'SAIDA', now() - interval '5 hours', NULL),
  ('MORADOR','22222222-0000-0000-0000-000000000001',NULL,NULL,NULL,'ENTRADA', now() - interval '2 hours', NULL),
  ('MORADOR','22222222-0000-0000-0000-000000000003',NULL,NULL,NULL,'SAIDA', now() - interval '3 hours', NULL),
  ('MORADOR','22222222-0000-0000-0000-000000000005',NULL,NULL,NULL,'ENTRADA', now() - interval '1 day', NULL),
  ('VISITANTE',NULL,'Gustavo Pereira','RG1234567','11111111-0000-0000-0000-000000000001','ENTRADA', now() - interval '1 hour','Visita à Ana'),
  ('PRESTADOR',NULL,'Hidro Serviços - João','RG7654321','11111111-0000-0000-0000-000000000003','ENTRADA', now() - interval '4 hours','Manutenção hidráulica'),
  ('PRESTADOR',NULL,'Hidro Serviços - João','RG7654321','11111111-0000-0000-0000-000000000003','SAIDA', now() - interval '3 hours', NULL);