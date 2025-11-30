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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          chat_type: string
          content: string
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          chat_type: string
          content: string
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          chat_type?: string
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      current_affairs: {
        Row: {
          category: string
          created_at: string | null
          date: string
          full_content: string | null
          id: string
          importance_level: string | null
          summary: string
          tags: string[] | null
          title: string
        }
        Insert: {
          category: string
          created_at?: string | null
          date?: string
          full_content?: string | null
          id?: string
          importance_level?: string | null
          summary: string
          tags?: string[] | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string | null
          date?: string
          full_content?: string | null
          id?: string
          importance_level?: string | null
          summary?: string
          tags?: string[] | null
          title?: string
        }
        Relationships: []
      }
      gamification_badges: {
        Row: {
          badge_description: string | null
          badge_name: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_description?: string | null
          badge_name: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_description?: string | null
          badge_name?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      mains_questions: {
        Row: {
          category: string
          created_at: string
          date: string
          id: string
          question_text: string
          word_limit: number
        }
        Insert: {
          category: string
          created_at?: string
          date?: string
          id?: string
          question_text: string
          word_limit?: number
        }
        Update: {
          category?: string
          created_at?: string
          date?: string
          id?: string
          question_text?: string
          word_limit?: number
        }
        Relationships: []
      }
      mains_submissions: {
        Row: {
          answer_image_url: string | null
          answer_text: string | null
          evaluation: string | null
          id: string
          marks: number | null
          question_id: string | null
          submitted_at: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          answer_image_url?: string | null
          answer_text?: string | null
          evaluation?: string | null
          id?: string
          marks?: number | null
          question_id?: string | null
          submitted_at?: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          answer_image_url?: string | null
          answer_text?: string | null
          evaluation?: string | null
          id?: string
          marks?: number | null
          question_id?: string | null
          submitted_at?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mains_submissions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "mains_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      prelims_attempts: {
        Row: {
          attempted_at: string | null
          id: string
          is_correct: boolean
          question_id: string
          selected_answer: string
          time_taken_seconds: number | null
          user_id: string
        }
        Insert: {
          attempted_at?: string | null
          id?: string
          is_correct: boolean
          question_id: string
          selected_answer: string
          time_taken_seconds?: number | null
          user_id: string
        }
        Update: {
          attempted_at?: string | null
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_answer?: string
          time_taken_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prelims_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "prelims_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      prelims_questions: {
        Row: {
          correct_answer: string
          created_at: string | null
          difficulty: string | null
          explanation: string | null
          id: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question: string
          subject: string
          topic: string | null
        }
        Insert: {
          correct_answer: string
          created_at?: string | null
          difficulty?: string | null
          explanation?: string | null
          id?: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question: string
          subject: string
          topic?: string | null
        }
        Update: {
          correct_answer?: string
          created_at?: string | null
          difficulty?: string | null
          explanation?: string | null
          id?: string
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question?: string
          subject?: string
          topic?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          current_streak: number | null
          id: string
          language: string | null
          level: number | null
          mentor_personality: string | null
          name: string
          optional_subject: string | null
          profile_photo_url: string | null
          study_hours_per_day: number | null
          target_year: number
          total_xp: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_streak?: number | null
          id: string
          language?: string | null
          level?: number | null
          mentor_personality?: string | null
          name: string
          optional_subject?: string | null
          profile_photo_url?: string | null
          study_hours_per_day?: number | null
          target_year: number
          total_xp?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_streak?: number | null
          id?: string
          language?: string | null
          level?: number | null
          mentor_personality?: string | null
          name?: string
          optional_subject?: string | null
          profile_photo_url?: string | null
          study_hours_per_day?: number | null
          target_year?: number
          total_xp?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      study_plan: {
        Row: {
          completed_tasks: number | null
          created_at: string | null
          date: string
          id: string
          tasks: Json
          total_tasks: number | null
          user_id: string
        }
        Insert: {
          completed_tasks?: number | null
          created_at?: string | null
          date: string
          id?: string
          tasks?: Json
          total_tasks?: number | null
          user_id: string
        }
        Update: {
          completed_tasks?: number | null
          created_at?: string | null
          date?: string
          id?: string
          tasks?: Json
          total_tasks?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
