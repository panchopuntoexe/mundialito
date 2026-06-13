/**
 * Tipos de la base de datos (tarea 1.8).
 *
 * ⚠️ Escritos a mano para reflejar EXACTAMENTE las migraciones de
 * `supabase/migrations/`. Una vez vinculado el proyecto, regenerar con:
 *   npx supabase gen types typescript --linked > types/database.ts
 * y mantener en sync con las migraciones.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          total_points: number;
          is_bot: boolean;
          username_changed_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          total_points?: number;
          is_bot?: boolean;
          username_changed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          total_points?: number;
          is_bot?: boolean;
          username_changed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: number;
          api_football_id: number | null;
          external_ref: string | null;
          home_team: string;
          away_team: string;
          home_flag: string | null;
          away_flag: string | null;
          phase: string;
          macro_round: string;
          kickoff_at: string;
          status: Database["public"]["Enums"]["match_status"];
          score_home: number | null;
          score_away: number | null;
          total_goals: number | null;
          winner_team: string | null;
          processed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: never;
          api_football_id?: number | null;
          external_ref?: string | null;
          home_team: string;
          away_team: string;
          home_flag?: string | null;
          away_flag?: string | null;
          phase: string;
          macro_round: string;
          kickoff_at: string;
          status?: Database["public"]["Enums"]["match_status"];
          score_home?: number | null;
          score_away?: number | null;
          winner_team?: string | null;
          processed?: boolean;
          updated_at?: string;
        };
        Update: {
          api_football_id?: number | null;
          external_ref?: string | null;
          home_team?: string;
          away_team?: string;
          home_flag?: string | null;
          away_flag?: string | null;
          phase?: string;
          macro_round?: string;
          kickoff_at?: string;
          status?: Database["public"]["Enums"]["match_status"];
          score_home?: number | null;
          score_away?: number | null;
          winner_team?: string | null;
          processed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      predictions: {
        Row: {
          id: string;
          user_id: string;
          match_id: number;
          result_pred: Database["public"]["Enums"]["result_pred"];
          /** Legacy (pre-0013): rango de goles. Solo en filas históricas. */
          goals_range_pred: Database["public"]["Enums"]["goals_range"] | null;
          /** Marcador exacto pronosticado por equipo (0013). Van juntas o ninguna. */
          home_goals_pred: number | null;
          away_goals_pred: number | null;
          result_correct: boolean | null;
          /** Reinterpretada en 0013: true = marcador exacto (ambos equipos). */
          goals_correct: boolean | null;
          points_earned: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          match_id: number;
          result_pred: Database["public"]["Enums"]["result_pred"];
          goals_range_pred?: Database["public"]["Enums"]["goals_range"] | null;
          home_goals_pred?: number | null;
          away_goals_pred?: number | null;
          result_correct?: boolean | null;
          goals_correct?: boolean | null;
          points_earned?: number | null;
          created_at?: string;
        };
        Update: {
          result_pred?: Database["public"]["Enums"]["result_pred"];
          goals_range_pred?: Database["public"]["Enums"]["goals_range"] | null;
          home_goals_pred?: number | null;
          away_goals_pred?: number | null;
          result_correct?: boolean | null;
          goals_correct?: boolean | null;
          points_earned?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "predictions_match_id_fkey";
            columns: ["match_id"];
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      leagues: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          invite_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leagues_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      league_members: {
        Row: {
          league_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          league_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey";
            columns: ["league_id"];
            referencedRelation: "leagues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "league_members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      streaks: {
        Row: {
          user_id: string;
          current_streak: number;
          max_streak: number;
          freeze_available: boolean;
          last_participated_on: string | null;
          freeze_refilled_round: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          current_streak?: number;
          max_streak?: number;
          freeze_available?: boolean;
          last_participated_on?: string | null;
          freeze_refilled_round?: string | null;
          updated_at?: string;
        };
        Update: {
          current_streak?: number;
          max_streak?: number;
          freeze_available?: boolean;
          last_participated_on?: string | null;
          freeze_refilled_round?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "streaks_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      achievements: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          earned_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          earned_at?: string;
        };
        Update: {
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "achievements_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      wrapped_cards: {
        Row: {
          id: string;
          user_id: string;
          phase: string;
          stats_json: Json;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          phase: string;
          stats_json: Json;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          stats_json?: Json;
          image_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wrapped_cards_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      // Registro de pushes enviados (migración 0014). Garantiza "como máximo
      // una vez" por (user, kind, dedupe_key) vía unique; server-only.
      push_notification_log: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          dedupe_key: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          dedupe_key: string;
          sent_at?: string;
        };
        Update: {
          kind?: string;
          dedupe_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_notification_log_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      // Precisión agregada por usuario (migración 0010). Alimenta el ranking por
      // % de aciertos. Columnas nullables como en los tipos generados de views.
      user_accuracy: {
        Row: {
          user_id: string | null;
          total_predictions: number | null;
          correct_predictions: number | null;
          accuracy: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      is_league_member: {
        Args: { p_league_id: string; p_user_id: string };
        Returns: boolean;
      };
      // Aplica los resultados de un partido finalizado en una transacción
      // idempotente (migración 0007 / tarea 5.5). Devuelve true si esta corrida
      // hizo el claim del partido; false si ya estaba procesado.
      apply_match_results: {
        Args: { p_match_id: number; p_results: Json };
        Returns: boolean;
      };
    };
    Enums: {
      match_status: "scheduled" | "live" | "finished" | "cancelled";
      result_pred: "home" | "draw" | "away";
      goals_range: "0-1" | "2-3" | "4-5" | "6+";
    };
    CompositeTypes: Record<never, never>;
  };
}
