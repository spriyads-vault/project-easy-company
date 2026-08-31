export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analysis_events: {
        Row: {
          analysis_run_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          sequence: number
          workspace_id: string
        }
        Insert: {
          analysis_run_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          sequence: number
          workspace_id?: string
        }
        Update: {
          analysis_run_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          sequence?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_events_analysis_run_id_workspace_id_fkey"
            columns: ["analysis_run_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      analysis_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          failure_case_id: string
          id: string
          measurement_id: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          failure_case_id: string
          id?: string
          measurement_id?: string | null
          status?: string
          workspace_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          failure_case_id?: string
          id?: string
          measurement_id?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_runs_failure_case_id_workspace_id_fkey"
            columns: ["failure_case_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "failure_cases"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "analysis_runs_measurement_id_workspace_id_fkey"
            columns: ["measurement_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "measurements"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      diagnostic_hypotheses: {
        Row: {
          analysis_run_id: string
          confidence_band: string | null
          created_at: string
          failure_case_id: string
          id: string
          recommended_next_step: string | null
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          analysis_run_id: string
          confidence_band?: string | null
          created_at?: string
          failure_case_id: string
          id?: string
          recommended_next_step?: string | null
          status?: string
          title: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          analysis_run_id?: string
          confidence_band?: string | null
          created_at?: string
          failure_case_id?: string
          id?: string
          recommended_next_step?: string | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_hypotheses_analysis_run_id_workspace_id_fkey"
            columns: ["analysis_run_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "diagnostic_hypotheses_failure_case_id_workspace_id_fkey"
            columns: ["failure_case_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "failure_cases"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      engineering_changes: {
        Row: {
          created_at: string
          description: string
          failure_case_id: string
          from_product_revision_id: string | null
          id: string
          to_product_revision_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description: string
          failure_case_id: string
          from_product_revision_id?: string | null
          id?: string
          to_product_revision_id: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          description?: string
          failure_case_id?: string
          from_product_revision_id?: string | null
          id?: string
          to_product_revision_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineering_changes_failure_case_id_workspace_id_fkey"
            columns: ["failure_case_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "failure_cases"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "engineering_changes_from_product_revision_id_workspace_id_fkey"
            columns: ["from_product_revision_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "product_revisions"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "engineering_changes_to_product_revision_id_workspace_id_fkey"
            columns: ["to_product_revision_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "product_revisions"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      evidence_items: {
        Row: {
          category: string
          created_at: string
          description: string
          hypothesis_id: string
          id: string
          source_ref: Json | null
          workspace_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          hypothesis_id: string
          id?: string
          source_ref?: Json | null
          workspace_id?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          hypothesis_id?: string
          id?: string
          source_ref?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_items_hypothesis_id_workspace_id_fkey"
            columns: ["hypothesis_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_hypotheses"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      failure_cases: {
        Row: {
          created_at: string
          id: string
          product_revision_id: string
          status: string
          test_type: string
          title: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_revision_id: string
          status?: string
          test_type?: string
          title?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_revision_id?: string
          status?: string
          test_type?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "failure_cases_product_revision_id_workspace_id_fkey"
            columns: ["product_revision_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "product_revisions"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      investigation_events: {
        Row: {
          created_at: string
          created_by: string
          description: string
          event_type: string
          failure_case_id: string
          id: string
          payload: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          event_type: string
          failure_case_id: string
          id?: string
          payload?: Json
          workspace_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          event_type?: string
          failure_case_id?: string
          id?: string
          payload?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_events_failure_case_id_workspace_id_fkey"
            columns: ["failure_case_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "failure_cases"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      measurement_peaks: {
        Row: {
          created_at: string
          detector: string | null
          frequency_mhz: number
          id: string
          limit_line: string | null
          margin_db: number
          measurement_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          detector?: string | null
          frequency_mhz: number
          id?: string
          limit_line?: string | null
          margin_db: number
          measurement_id: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          detector?: string | null
          frequency_mhz?: number
          id?: string
          limit_line?: string | null
          margin_db?: number
          measurement_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_peaks_measurement_id_workspace_id_fkey"
            columns: ["measurement_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "measurements"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      measurements: {
        Row: {
          created_at: string
          failure_case_id: string
          id: string
          label: string | null
          measured_at: string | null
          notes: string | null
          operating_mode: string | null
          product_revision_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          failure_case_id: string
          id?: string
          label?: string | null
          measured_at?: string | null
          notes?: string | null
          operating_mode?: string | null
          product_revision_id: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          failure_case_id?: string
          id?: string
          label?: string | null
          measured_at?: string | null
          notes?: string | null
          operating_mode?: string | null
          product_revision_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurements_failure_case_id_workspace_id_fkey"
            columns: ["failure_case_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "failure_cases"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "measurements_product_revision_id_workspace_id_fkey"
            columns: ["product_revision_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "product_revisions"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      product_facts: {
        Row: {
          category: string
          created_at: string
          fact: Json
          id: string
          product_revision_id: string
          source: string
          workspace_id: string
        }
        Insert: {
          category: string
          created_at?: string
          fact: Json
          id?: string
          product_revision_id: string
          source?: string
          workspace_id?: string
        }
        Update: {
          category?: string
          created_at?: string
          fact?: Json
          id?: string
          product_revision_id?: string
          source?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_facts_product_revision_id_workspace_id_fkey"
            columns: ["product_revision_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "product_revisions"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      product_revisions: {
        Row: {
          created_at: string
          id: string
          label: string
          notes: string | null
          product_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          product_id: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          product_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_revisions_product_id_workspace_id_fkey"
            columns: ["product_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_workspace_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

