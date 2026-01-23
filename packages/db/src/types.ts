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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      bullets: {
        Row: {
          category: string | null
          created_at: string
          current_text: string
          embedding: string | null
          hard_skills: string[] | null
          id: string
          is_draft: boolean
          original_text: string
          position_id: string
          soft_skills: string[] | null
          updated_at: string
          user_id: string
          was_edited: boolean | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          current_text: string
          embedding?: string | null
          hard_skills?: string[] | null
          id?: string
          is_draft?: boolean
          original_text: string
          position_id: string
          soft_skills?: string[] | null
          updated_at?: string
          user_id: string
          was_edited?: boolean | null
        }
        Update: {
          category?: string | null
          created_at?: string
          current_text?: string
          embedding?: string | null
          hard_skills?: string[] | null
          id?: string
          is_draft?: boolean
          original_text?: string
          position_id?: string
          soft_skills?: string[] | null
          updated_at?: string
          user_id?: string
          was_edited?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "bullets_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_profiles: {
        Row: {
          headline: string | null
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          headline?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          headline?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_drafts: {
        Row: {
          company: string | null
          created_at: string
          draft_resume_id: string | null
          id: string
          jd_embedding: string | null
          jd_text: string
          job_title: string | null
          retrieved_bullet_ids: string[] | null
          selected_bullet_ids: string[] | null
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          draft_resume_id?: string | null
          id?: string
          jd_embedding?: string | null
          jd_text: string
          job_title?: string | null
          retrieved_bullet_ids?: string[] | null
          selected_bullet_ids?: string[] | null
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          draft_resume_id?: string | null
          id?: string
          jd_embedding?: string | null
          jd_text?: string
          job_title?: string | null
          retrieved_bullet_ids?: string[] | null
          selected_bullet_ids?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_drafts_draft_resume_id_fkey"
            columns: ["draft_resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          company: string
          created_at: string
          end_date: string | null
          id: string
          location: string | null
          raw_notes: string | null
          start_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string
          end_date?: string | null
          id?: string
          location?: string | null
          raw_notes?: string | null
          start_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          end_date?: string | null
          id?: string
          location?: string | null
          raw_notes?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resumes: {
        Row: {
          content: Json | null
          created_at: string
          id: string
          name: string
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          id?: string
          name: string
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          id?: string
          name?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          created_at: string
          id: string
          input: Json | null
          latency_ms: number | null
          model: string | null
          output: Json | null
          prompt_id: string | null
          success: boolean | null
          tokens_in: number | null
          tokens_out: number | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input?: Json | null
          latency_ms?: number | null
          model?: string | null
          output?: Json | null
          prompt_id?: string | null
          success?: boolean | null
          tokens_in?: number | null
          tokens_out?: number | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input?: Json | null
          latency_ms?: number | null
          model?: string | null
          output?: Json | null
          prompt_id?: string | null
          success?: boolean | null
          tokens_in?: number | null
          tokens_out?: number | null
          type?: string
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_bullets: {
        Args: {
          match_count?: number
          match_threshold?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          category: string
          current_text: string
          id: string
          position_id: string
          similarity: number
        }[]
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
