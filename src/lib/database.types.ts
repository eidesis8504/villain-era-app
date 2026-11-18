// Supabase에서 자동 생성한 타입 (mcp generate_typescript_types). 스키마가 바뀌면 다시 생성한다.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      animals: {
        Row: {
          clutch_id: string | null
          code: string
          created_at: string
          dam_id: string | null
          hatch_date: string | null
          id: string
          morph: string
          name: string
          origin: Json | null
          owner_id: string
          photo_path: string | null
          sex: string
          sire_id: string | null
          species: string
          status: string
          updated_at: string
        }
        Insert: {
          clutch_id?: string | null
          code: string
          created_at?: string
          dam_id?: string | null
          hatch_date?: string | null
          id?: string
          morph?: string
          name?: string
          origin?: Json | null
          owner_id?: string
          photo_path?: string | null
          sex?: string
          sire_id?: string | null
          species?: string
          status?: string
          updated_at?: string
        }
        Update: {
          clutch_id?: string | null
          code?: string
          created_at?: string
          dam_id?: string | null
          hatch_date?: string | null
          id?: string
          morph?: string
          name?: string
          origin?: Json | null
          owner_id?: string
          photo_path?: string | null
          sex?: string
          sire_id?: string | null
          species?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      breeders: {
        Row: {
          created_at: string
          female_id: string
          male_id: string | null
          owner_id: string
        }
        Insert: {
          created_at?: string
          female_id: string
          male_id?: string | null
          owner_id?: string
        }
        Update: {
          created_at?: string
          female_id?: string
          male_id?: string | null
          owner_id?: string
        }
        Relationships: []
      }
      clutches: {
        Row: {
          created_at: string
          dam_id: string
          dead: number
          dead_note: string
          dead_on: string | null
          eggs: number
          fertile: number
          id: string
          laid_on: string
          owner_id: string
          seq: number
          sire_id: string | null
        }
        Insert: {
          created_at?: string
          dam_id: string
          dead?: number
          dead_note?: string
          dead_on?: string | null
          eggs: number
          fertile: number
          id?: string
          laid_on: string
          owner_id?: string
          seq: number
          sire_id?: string | null
        }
        Update: {
          created_at?: string
          dam_id?: string
          dead?: number
          dead_note?: string
          dead_on?: string | null
          eggs?: number
          fertile?: number
          id?: string
          laid_on?: string
          owner_id?: string
          seq?: number
          sire_id?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          adopted: boolean
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
          hidden: boolean
        }
        Insert: {
          adopted?: boolean
          author_id?: string
          body: string
          created_at?: string
          id?: string
          post_id: string
          hidden?: boolean
        }
        Update: {
          adopted?: boolean
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          hidden?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          max_uses: number
          note: string
          role: string
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          max_uses?: number
          note?: string
          role?: string
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          max_uses?: number
          note?: string
          role?: string
          uses?: number
        }
        Relationships: []
      }
      invite_redemptions: {
        Row: {
          code: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      notices: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string | null
          id: number
          kind: string
          link: string | null
          push_state: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          dedupe_key?: string | null
          id?: never
          kind: string
          link?: string | null
          push_state?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string | null
          id?: never
          kind?: string
          link?: string | null
          push_state?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          attach: Json | null
          author_id: string
          body: string
          cat: string
          comment_count: number
          created_at: string
          has_adopted: boolean
          id: string
          like_count: number
          media: Json
          title: string
          hidden: boolean
        }
        Insert: {
          attach?: Json | null
          author_id?: string
          body?: string
          cat?: string
          comment_count?: number
          created_at?: string
          has_adopted?: boolean
          id?: string
          like_count?: number
          media?: Json
          title: string
          hidden?: boolean
        }
        Update: {
          attach?: Json | null
          author_id?: string
          body?: string
          cat?: string
          comment_count?: number
          created_at?: string
          has_adopted?: boolean
          id?: string
          like_count?: number
          media?: Json
          title?: string
          hidden?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activated_at: string | null
          avatar_url: string | null
          badge: string | null
          bio: string
          coi_limit: number
          created_at: string
          id: string
          nickname: string | null
          role: string
          status: string
          todo_alarm: boolean
          tz: string
          first_platform: string | null
          is_test: boolean
          source: string | null
        }
        Insert: {
          activated_at?: string | null
          avatar_url?: string | null
          badge?: string | null
          bio?: string
          coi_limit?: number
          created_at?: string
          id: string
          nickname?: string | null
          role?: string
          status?: string
          todo_alarm?: boolean
          tz?: string
          first_platform?: string | null
          is_test?: boolean
          source?: string | null
        }
        Update: {
          activated_at?: string | null
          avatar_url?: string | null
          badge?: string | null
          bio?: string
          coi_limit?: number
          created_at?: string
          id?: string
          nickname?: string | null
          role?: string
          status?: string
          todo_alarm?: boolean
          tz?: string
          first_platform?: string | null
          is_test?: boolean
          source?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          last_success_at: string | null
          p256dh: string
          ua: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          last_success_at?: string | null
          p256dh: string
          ua?: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          last_success_at?: string | null
          p256dh?: string
          ua?: string
          user_id?: string
        }
        Relationships: []
      }
      todo_checks: {
        Row: {
          created_at: string
          day: string
          owner_id: string
          todo_id: string
        }
        Insert: {
          created_at?: string
          day: string
          owner_id?: string
          todo_id: string
        }
        Update: {
          created_at?: string
          day?: string
          owner_id?: string
          todo_id?: string
        }
        Relationships: []
      }
      todos: {
        Row: {
          alarm_minutes: number
          created_at: string
          days: number[]
          id: string
          mode: string
          once_date: string | null
          owner_id: string
          tag: string
          time_of_day: string
          title: string
        }
        Insert: {
          alarm_minutes?: number
          created_at?: string
          days?: number[]
          id?: string
          mode: string
          once_date?: string | null
          owner_id?: string
          tag?: string
          time_of_day: string
          title: string
        }
        Update: {
          alarm_minutes?: number
          created_at?: string
          days?: number[]
          id?: string
          mode?: string
          once_date?: string | null
          owner_id?: string
          tag?: string
          time_of_day?: string
          title?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          animal_id: string | null
          canceled_at: string | null
          claimed_animal_id: string | null
          claimed_at: string | null
          claimed_by: string | null
          code: string
          created_at: string
          expires_at: string
          id: string
          include_clutches: boolean
          include_lineage: boolean
          include_weights: boolean
          owner_id: string
          recipient_label: string
          snapshot: Json
        }
        Insert: {
          animal_id?: string | null
          canceled_at?: string | null
          claimed_animal_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          include_clutches?: boolean
          include_lineage?: boolean
          include_weights?: boolean
          owner_id?: string
          recipient_label?: string
          snapshot: Json
        }
        Update: {
          animal_id?: string | null
          canceled_at?: string | null
          claimed_animal_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          include_clutches?: boolean
          include_lineage?: boolean
          include_weights?: boolean
          owner_id?: string
          recipient_label?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "transfers_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weights: {
        Row: {
          animal_id: string
          created_at: string
          grams: number
          id: number
          measured_on: string
          owner_id: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          grams: number
          id?: never
          measured_on: string
          owner_id?: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          grams?: number
          id?: never
          measured_on?: string
          owner_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      landing_views: {
        Row: {
          created_at: string
          day: string
          id: number
          inapp: string | null
          platform: string
          src: string
        }
        Insert: {
          created_at?: string
          day?: string
          id?: never
          inapp?: string | null
          platform: string
          src?: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: never
          inapp?: string | null
          platform?: string
          src?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          created_at: string
          day: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          app_version: string
          body: string
          created_at: string
          id: number
          kind: string
          path: string
          status: string
          ua: string
          user_id: string
        }
        Insert: {
          app_version?: string
          body: string
          created_at?: string
          id?: never
          kind: string
          path?: string
          status?: string
          ua?: string
          user_id?: string
        }
        Update: {
          app_version?: string
          body?: string
          created_at?: string
          id?: never
          kind?: string
          path?: string
          status?: string
          ua?: string
          user_id?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          best_feature: string
          created_at: string
          nps: number
          survey: string
          user_id: string
          wish: string
        }
        Insert: {
          best_feature?: string
          created_at?: string
          nps: number
          survey?: string
          user_id?: string
          wish?: string
        }
        Update: {
          best_feature?: string
          created_at?: string
          nps?: number
          survey?: string
          user_id?: string
          wish?: string
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          app_version: string
          created_at: string
          id: number
          message: string
          path: string
          stack: string
          ua: string
          user_id: string
        }
        Insert: {
          app_version?: string
          created_at?: string
          id?: never
          message?: string
          path?: string
          stack?: string
          ua?: string
          user_id?: string
        }
        Update: {
          app_version?: string
          created_at?: string
          id?: never
          message?: string
          path?: string
          stack?: string
          ua?: string
          user_id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id?: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: number
          note: string
          reason: string
          reporter_id: string
          status: string
          target_id: string
          target_kind: string
          target_user: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          note?: string
          reason: string
          reporter_id?: string
          status?: string
          target_id: string
          target_kind: string
          target_user?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          note?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
          target_kind?: string
          target_user?: string | null
        }
        Relationships: []
      }
      banned_words: {
        Row: {
          created_at: string
          word: string
        }
        Insert: {
          created_at?: string
          word: string
        }
        Update: {
          created_at?: string
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adopt_comment: { Args: { p_comment: string }; Returns: undefined }
      apply_admin_code: {
        Args: { p_code: string }
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      cancel_transfer: { Args: { p_id: string }; Returns: undefined }
      claim_transfer: { Args: { p_code: string }; Returns: string }
      create_invite: {
        Args: {
          p_days?: number
          p_max_uses?: number
          p_note?: string
          p_role?: string
        }
        Returns: Database["public"]["Tables"]["invite_codes"]["Row"]
      }
      create_transfer: {
        Args: {
          p_animal: string
          p_clutches: boolean
          p_label?: string
          p_lineage: boolean
          p_weights: boolean
        }
        Returns: Database["public"]["Tables"]["transfers"]["Row"]
      }
      get_vapid_public_key: { Args: never; Returns: string }
      preview_transfer: { Args: { p_code: string }; Returns: Json }
      record_hatch: {
        Args: {
          p_clutch: string
          p_date: string
          p_dead: number
          p_hatched: number
          p_note?: string
        }
        Returns: Database["public"]["Tables"]["animals"]["Row"][]
      }
      redeem_invite: {
        Args: { p_code: string; p_nickname: string }
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_ua?: string
        }
        Returns: undefined
      }
      log_landing: { Args: { p_src: string; p_platform: string; p_inapp: string | null }; Returns: undefined }
      set_first_touch: { Args: { p_source: string; p_platform: string }; Returns: undefined }
      track: { Args: { p_names: string[] }; Returns: undefined }
      log_client_error: { Args: { p_message: string; p_stack: string; p_path: string; p_version: string; p_ua: string }; Returns: undefined }
      report_content: { Args: { p_kind: string; p_id: string; p_reason: string; p_note?: string }; Returns: undefined }
      admin_moderate: { Args: { p_report: number; p_action: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
