export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      apartamentos: {
        Row: {
          bloco: string
          criado_em: string
          id: string
          numero: string
        }
        Insert: {
          bloco: string
          criado_em?: string
          id?: string
          numero: string
        }
        Update: {
          bloco?: string
          criado_em?: string
          id?: string
          numero?: string
        }
        Relationships: []
      }
      moradores: {
        Row: {
          apartamento_id: string
          atualizado_em: string
          cpf: string
          criado_em: string
          id: string
          nome: string
          status: Database["public"]["Enums"]["status_morador"]
          telefone: string | null
          tipo_morador: Database["public"]["Enums"]["tipo_morador"]
        }
        Insert: {
          apartamento_id: string
          atualizado_em?: string
          cpf: string
          criado_em?: string
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["status_morador"]
          telefone?: string | null
          tipo_morador?: Database["public"]["Enums"]["tipo_morador"]
        }
        Update: {
          apartamento_id?: string
          atualizado_em?: string
          cpf?: string
          criado_em?: string
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["status_morador"]
          telefone?: string | null
          tipo_morador?: Database["public"]["Enums"]["tipo_morador"]
        }
        Relationships: [
          {
            foreignKeyName: "moradores_apartamento_id_fkey"
            columns: ["apartamento_id"]
            isOneToOne: false
            referencedRelation: "apartamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          criado_em: string
          email: string | null
          papel: Database["public"]["Enums"]["papel_usuario"] | null
          user_id: string
        }
        Insert: {
          criado_em?: string
          email?: string | null
          papel?: Database["public"]["Enums"]["papel_usuario"] | null
          user_id: string
        }
        Update: {
          criado_em?: string
          email?: string | null
          papel?: Database["public"]["Enums"]["papel_usuario"] | null
          user_id?: string
        }
        Relationships: []
      }
      registros_acesso: {
        Row: {
          apartamento_destino_id: string | null
          data_hora: string
          documento_visitante: string | null
          id: string
          morador_id: string | null
          nome_visitante: string | null
          observacao: string | null
          registrado_por: string | null
          tipo_fluxo: Database["public"]["Enums"]["tipo_fluxo"]
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
        }
        Insert: {
          apartamento_destino_id?: string | null
          data_hora?: string
          documento_visitante?: string | null
          id?: string
          morador_id?: string | null
          nome_visitante?: string | null
          observacao?: string | null
          registrado_por?: string | null
          tipo_fluxo: Database["public"]["Enums"]["tipo_fluxo"]
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
        }
        Update: {
          apartamento_destino_id?: string | null
          data_hora?: string
          documento_visitante?: string | null
          id?: string
          morador_id?: string | null
          nome_visitante?: string | null
          observacao?: string | null
          registrado_por?: string | null
          tipo_fluxo?: Database["public"]["Enums"]["tipo_fluxo"]
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"]
        }
        Relationships: [
          {
            foreignKeyName: "registros_acesso_apartamento_destino_id_fkey"
            columns: ["apartamento_destino_id"]
            isOneToOne: false
            referencedRelation: "apartamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_acesso_morador_id_fkey"
            columns: ["morador_id"]
            isOneToOne: false
            referencedRelation: "estado_moradores"
            referencedColumns: ["morador_id"]
          },
          {
            foreignKeyName: "registros_acesso_morador_id_fkey"
            columns: ["morador_id"]
            isOneToOne: false
            referencedRelation: "moradores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      estado_moradores: {
        Row: {
          apartamento_id: string | null
          bloco: string | null
          cpf: string | null
          estado: string | null
          morador_id: string | null
          nome: string | null
          numero: string | null
          status: Database["public"]["Enums"]["status_morador"] | null
          ultimo_registro: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moradores_apartamento_id_fkey"
            columns: ["apartamento_id"]
            isOneToOne: false
            referencedRelation: "apartamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      visitantes_dentro: {
        Row: {
          apartamento_destino_id: string | null
          documento_visitante: string | null
          entrada_em: string | null
          nome_visitante: string | null
          observacao: string | null
          tipo_fluxo: Database["public"]["Enums"]["tipo_fluxo"] | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"] | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_acesso_apartamento_destino_id_fkey"
            columns: ["apartamento_destino_id"]
            isOneToOne: false
            referencedRelation: "apartamentos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      papel_atual: {
        Args: never
        Returns: Database["public"]["Enums"]["papel_usuario"]
      }
      registrar_acesso: {
        Args: {
          p_apartamento_destino_id?: string
          p_confirmar_excecao?: boolean
          p_documento_visitante?: string
          p_morador_id?: string
          p_nome_visitante?: string
          p_observacao?: string
          p_tipo_fluxo?: Database["public"]["Enums"]["tipo_fluxo"]
          p_tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
        }
        Returns: Json
      }
    }
    Enums: {
      papel_usuario: "PORTEIRO" | "SINDICO"
      status_morador: "ATIVO" | "INATIVO" | "BLOQUEADO"
      tipo_fluxo: "ENTRADA" | "SAIDA"
      tipo_morador: "PROPRIETARIO" | "INQUILINO" | "DEPENDENTE"
      tipo_pessoa: "MORADOR" | "VISITANTE" | "PRESTADOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      papel_usuario: ["PORTEIRO", "SINDICO"],
      status_morador: ["ATIVO", "INATIVO", "BLOQUEADO"],
      tipo_fluxo: ["ENTRADA", "SAIDA"],
      tipo_morador: ["PROPRIETARIO", "INQUILINO", "DEPENDENTE"],
      tipo_pessoa: ["MORADOR", "VISITANTE", "PRESTADOR"],
    },
  },
} as const
