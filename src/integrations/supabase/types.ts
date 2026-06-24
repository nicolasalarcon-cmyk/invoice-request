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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      form_config: {
        Row: {
          config: Json
          id: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          config?: Json
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          config?: Json
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      invoice_ledger: {
        Row: {
          approved_at: string | null
          comercial_email: string | null
          comercial_nombre: string | null
          concepto: string | null
          created_at: string
          document_type: string
          identificacion: string
          invoice_id: string | null
          nombre: string
          programa: string | null
          recibo_fecha: string
          recibo_numero: number
          valor_total: number
        }
        Insert: {
          approved_at?: string | null
          comercial_email?: string | null
          comercial_nombre?: string | null
          concepto?: string | null
          created_at?: string
          document_type?: string
          identificacion: string
          invoice_id?: string | null
          nombre: string
          programa?: string | null
          recibo_fecha: string
          recibo_numero: number
          valor_total?: number
        }
        Update: {
          approved_at?: string | null
          comercial_email?: string | null
          comercial_nombre?: string | null
          concepto?: string | null
          created_at?: string
          document_type?: string
          identificacion?: string
          invoice_id?: string | null
          nombre?: string
          programa?: string | null
          recibo_fecha?: string
          recibo_numero?: number
          valor_total?: number
        }
        Relationships: []
      }
      invoice_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_pdf_path: string | null
          attachments: Json
          ciudad: string | null
          codigo_estudiante: string | null
          codigo_snies: string | null
          cohorte: string | null
          comercial_email: string | null
          comercial_nombre: string | null
          concepto: string | null
          convocatoria: string | null
          created_at: string
          created_by: string | null
          descuento: number
          descuento_bono: number
          descuento_pct: number
          direccion: string | null
          document_type: string
          duracion: string | null
          email: string | null
          empresa: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          fecha_limite_pago: string | null
          fecha_pago_extraordinario: string | null
          horas_programa: number | null
          id: string
          identificacion: string
          info_requested: string | null
          matricula: number
          nemonico: string | null
          nit: string | null
          nombre: string
          numero_inscripcion: string | null
          numero_participantes: number | null
          observaciones: string | null
          pais: string | null
          parent_id: string | null
          periodo: string
          plan_estudio: string | null
          programa: string
          recargo_total: number
          recibo_fecha: string
          recibo_numero: number | null
          rejection_reason: string | null
          source: string
          source_row_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          telefono: string | null
          template_id: string | null
          tipo_persona: string | null
          tipo_programa: string | null
          updated_at: string
          valor_total: number
          valor_total_empresa: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_pdf_path?: string | null
          attachments?: Json
          ciudad?: string | null
          codigo_estudiante?: string | null
          codigo_snies?: string | null
          cohorte?: string | null
          comercial_email?: string | null
          comercial_nombre?: string | null
          concepto?: string | null
          convocatoria?: string | null
          created_at?: string
          created_by?: string | null
          descuento?: number
          descuento_bono?: number
          descuento_pct?: number
          direccion?: string | null
          document_type?: string
          duracion?: string | null
          email?: string | null
          empresa?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          fecha_limite_pago?: string | null
          fecha_pago_extraordinario?: string | null
          horas_programa?: number | null
          id?: string
          identificacion: string
          info_requested?: string | null
          matricula?: number
          nemonico?: string | null
          nit?: string | null
          nombre: string
          numero_inscripcion?: string | null
          numero_participantes?: number | null
          observaciones?: string | null
          pais?: string | null
          parent_id?: string | null
          periodo?: string
          plan_estudio?: string | null
          programa?: string
          recargo_total?: number
          recibo_fecha?: string
          recibo_numero?: number | null
          rejection_reason?: string | null
          source?: string
          source_row_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          telefono?: string | null
          template_id?: string | null
          tipo_persona?: string | null
          tipo_programa?: string | null
          updated_at?: string
          valor_total?: number
          valor_total_empresa?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_pdf_path?: string | null
          attachments?: Json
          ciudad?: string | null
          codigo_estudiante?: string | null
          codigo_snies?: string | null
          cohorte?: string | null
          comercial_email?: string | null
          comercial_nombre?: string | null
          concepto?: string | null
          convocatoria?: string | null
          created_at?: string
          created_by?: string | null
          descuento?: number
          descuento_bono?: number
          descuento_pct?: number
          direccion?: string | null
          document_type?: string
          duracion?: string | null
          email?: string | null
          empresa?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          fecha_limite_pago?: string | null
          fecha_pago_extraordinario?: string | null
          horas_programa?: number | null
          id?: string
          identificacion?: string
          info_requested?: string | null
          matricula?: number
          nemonico?: string | null
          nit?: string | null
          nombre?: string
          numero_inscripcion?: string | null
          numero_participantes?: number | null
          observaciones?: string | null
          pais?: string | null
          parent_id?: string | null
          periodo?: string
          plan_estudio?: string | null
          programa?: string
          recargo_total?: number
          recibo_fecha?: string
          recibo_numero?: number | null
          rejection_reason?: string | null
          source?: string
          source_row_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          telefono?: string | null
          template_id?: string | null
          tipo_persona?: string | null
          tipo_programa?: string | null
          updated_at?: string
          valor_total?: number
          valor_total_empresa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_requests_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "invoice_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_template"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_template: {
        Row: {
          default_for: string | null
          descripcion_legal: string
          dias_extraordinario: number
          dias_limite: number
          id: string
          institucion_nombre: string
          is_default: boolean
          layout: Json | null
          medios_pago: string
          nit: string
          nombre: string
          nota_legal: string
          nota_retencion: string
          recargo_pct: number
          singleton: boolean | null
          updated_at: string
        }
        Insert: {
          default_for?: string | null
          descripcion_legal?: string
          dias_extraordinario?: number
          dias_limite?: number
          id?: string
          institucion_nombre?: string
          is_default?: boolean
          layout?: Json | null
          medios_pago?: string
          nit?: string
          nombre?: string
          nota_legal?: string
          nota_retencion?: string
          recargo_pct?: number
          singleton?: boolean | null
          updated_at?: string
        }
        Update: {
          default_for?: string | null
          descripcion_legal?: string
          dias_extraordinario?: number
          dias_limite?: number
          id?: string
          institucion_nombre?: string
          is_default?: boolean
          layout?: Json | null
          medios_pago?: string
          nit?: string
          nombre?: string
          nota_legal?: string
          nota_retencion?: string
          recargo_pct?: number
          singleton?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nombre_completo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nombre_completo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nombre_completo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      programas: {
        Row: {
          codigo_snies: string | null
          cohorte: string | null
          created_at: string
          fecha_fin: string | null
          fecha_inicio: string | null
          horas_programa: number | null
          id: string
          matricula_default: number | null
          nemonico: string | null
          nombre: string
          periodo_default: string | null
          plan_estudio: string | null
          tipo_programa: string | null
          updated_at: string
        }
        Insert: {
          codigo_snies?: string | null
          cohorte?: string | null
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          horas_programa?: number | null
          id?: string
          matricula_default?: number | null
          nemonico?: string | null
          nombre: string
          periodo_default?: string | null
          plan_estudio?: string | null
          tipo_programa?: string | null
          updated_at?: string
        }
        Update: {
          codigo_snies?: string | null
          cohorte?: string | null
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          horas_programa?: number | null
          id?: string
          matricula_default?: number | null
          nemonico?: string | null
          nombre?: string
          periodo_default?: string | null
          plan_estudio?: string | null
          tipo_programa?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "comercial"
      invoice_status: "pendiente" | "aprobada" | "rechazada" | "requiere_info"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user", "comercial"],
      invoice_status: ["pendiente", "aprobada", "rechazada", "requiere_info"],
    },
  },
} as const
