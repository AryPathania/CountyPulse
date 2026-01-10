export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          duration_ms: number | null
          error: string | null
          id: string
          prompt_id: number | null
          run_at: string | null
          source_id: number | null
          status: string | null
        }
        Insert: {
          duration_ms?: number | null
          error?: string | null
          id?: string
          prompt_id?: number | null
          run_at?: string | null
          source_id?: number | null
          status?: string | null
        }
        Update: {
          duration_ms?: number | null
          error?: string | null
          id?: string
          prompt_id?: number | null
          run_at?: string | null
          source_id?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      item_events: {
        Row: {
          category: string
          metric: string
          time: string
          value: number | null
        }
        Insert: {
          category: string
          metric: string
          time: string
          value?: number | null
        }
        Update: {
          category?: string
          metric?: string
          time?: string
          value?: number | null
        }
        Relationships: []
      }
      item_tags: {
        Row: {
          cat_id: number
          item_id: string
        }
        Insert: {
          cat_id: number
          item_id: string
        }
        Update: {
          cat_id?: number
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_tags_cat_id_fkey"
            columns: ["cat_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_tags_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "normalized_items"
            referencedColumns: ["id"]
          },
        ]
      }
      normalized_items: {
        Row: {
          category: string
          embedding: string | null
          id: string
          indexed_at: string | null
          metadata: Json | null
          published_at: string | null
          summary: string | null
          title: string | null
        }
        Insert: {
          category: string
          embedding?: string | null
          id: string
          indexed_at?: string | null
          metadata?: Json | null
          published_at?: string | null
          summary?: string | null
          title?: string | null
        }
        Update: {
          category?: string
          embedding?: string | null
          id?: string
          indexed_at?: string | null
          metadata?: Json | null
          published_at?: string | null
          summary?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "normalized_items_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "raw_items"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_templates: {
        Row: {
          code: string
          description: string | null
          id: number
          template: string
        }
        Insert: {
          code: string
          description?: string | null
          id?: number
          template: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: number
          template?: string
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          created_at: string | null
          id: number
          prompt_id: number | null
          template: string
          version_note: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          prompt_id?: number | null
          template: string
          version_note?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          prompt_id?: number | null
          template?: string
          version_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_items: {
        Row: {
          external_id: string | null
          fetched_at: string | null
          id: string
          raw_payload: Json
          source_id: number | null
        }
        Insert: {
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          raw_payload: Json
          source_id?: number | null
        }
        Update: {
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          raw_payload?: Json
          source_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      run_feedback: {
        Row: {
          created_at: string | null
          feedback: Json | null
          run_id: string | null
        }
        Insert: {
          created_at?: string | null
          feedback?: Json | null
          run_id?: string | null
        }
        Update: {
          created_at?: string | null
          feedback?: Json | null
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "run_feedback_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_feedback: {
        Row: {
          created_at: string | null
          dataset_id: string
          decision: string
          feedback: string
          id: number
        }
        Insert: {
          created_at?: string | null
          dataset_id: string
          decision: string
          feedback: string
          id?: number
        }
        Update: {
          created_at?: string | null
          dataset_id?: string
          decision?: string
          feedback?: string
          id?: number
        }
        Relationships: []
      }
      sources: {
        Row: {
          code: string
          config: Json | null
          connector: string
          discovery_reason: string | null
          fetch_interval: unknown
          id: number
          last_discovered: string | null
          last_fetched: string | null
          name: string
          prompt_code: string | null
        }
        Insert: {
          code: string
          config?: Json | null
          connector: string
          discovery_reason?: string | null
          fetch_interval: unknown
          id?: number
          last_discovered?: string | null
          last_fetched?: string | null
          name: string
          prompt_code?: string | null
        }
        Update: {
          code?: string
          config?: Json | null
          connector?: string
          discovery_reason?: string | null
          fetch_interval?: unknown
          id?: number
          last_discovered?: string | null
          last_fetched?: string | null
          name?: string
          prompt_code?: string | null
        }
        Relationships: []
      }
      summaries: {
        Row: {
          category: string
          output: string
          run_id: string
        }
        Insert: {
          category: string
          output: string
          run_id: string
        }
        Update: {
          category?: string
          output?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "summaries_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          display_name: string
          id: string
          profile_completed_at: string | null
          profile_version: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name: string
          id?: string
          profile_completed_at?: string | null
          profile_version?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string
          id?: string
          profile_completed_at?: string | null
          profile_version?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      watches: {
        Row: {
          category_id: number | null
          created_at: string | null
          filter: Json | null
          id: number
          user_id: string
        }
        Insert: {
          category_id?: number | null
          created_at?: string | null
          filter?: Json | null
          id?: number
          user_id: string
        }
        Update: {
          category_id?: number | null
          created_at?: string | null
          filter?: Json | null
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watches_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
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
  public: {
    Enums: {},
  },
} as const

// Re-export common types for convenience
export type User = {
  id: string
  email?: string
  // Add other auth.users fields as needed
}

export type Session = {
  user: User
  // Add other session fields as needed
}

export type UserProfile = Database['public']['Tables']['user_profiles']['Row']

