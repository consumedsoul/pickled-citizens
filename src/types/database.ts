// Database types generated from schema.sql
// This file provides type safety for Supabase queries

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          email: string | null
          first_name: string | null
          last_name: string | null
          gender: string | null
          dupr_id: string | null
          self_reported_dupr: number | null
          display_name: string | null
          avatar_url: string | null
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          gender?: string | null
          dupr_id?: string | null
          self_reported_dupr?: number | null
          display_name?: string | null
          avatar_url?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          gender?: string | null
          dupr_id?: string | null
          self_reported_dupr?: number | null
          display_name?: string | null
          avatar_url?: string | null
        }
      }
      leagues: {
        Row: {
          id: string
          created_at: string
          name: string
          owner_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          owner_id: string
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          owner_id?: string
        }
      }
      league_members: {
        Row: {
          league_id: string
          user_id: string
          role: 'player' | 'admin'
          email: string | null
          created_at: string
        }
        Insert: {
          league_id: string
          user_id: string
          role?: 'player' | 'admin'
          email?: string | null
          created_at?: string
        }
        Update: {
          league_id?: string
          user_id?: string
          role?: 'player' | 'admin'
          email?: string | null
          created_at?: string
        }
      }
      league_invites: {
        Row: {
          id: string
          league_id: string
          email: string
          invited_by: string
          status: 'pending' | 'accepted' | 'revoked'
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          league_id: string
          email: string
          invited_by: string
          status?: 'pending' | 'accepted' | 'revoked'
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          league_id?: string
          email?: string
          invited_by?: string
          status?: 'pending' | 'accepted' | 'revoked'
          created_at?: string
          accepted_at?: string | null
        }
      }
      game_sessions: {
        Row: {
          id: string
          league_id: string | null
          created_by: string
          created_at: string
          scheduled_for: string | null
          location: string | null
          player_count: 6 | 8 | 10 | 12
        }
        Insert: {
          id?: string
          league_id?: string | null
          created_by: string
          created_at?: string
          scheduled_for?: string | null
          location?: string | null
          player_count: 6 | 8 | 10 | 12
        }
        Update: {
          id?: string
          league_id?: string | null
          created_by?: string
          created_at?: string
          scheduled_for?: string | null
          location?: string | null
          player_count?: 6 | 8 | 10 | 12
        }
      }
      matches: {
        Row: {
          id: string
          session_id: string
          court_number: number | null
          scheduled_order: number | null
          status: 'scheduled' | 'completed' | 'canceled'
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          court_number?: number | null
          scheduled_order?: number | null
          status?: 'scheduled' | 'completed' | 'canceled'
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          court_number?: number | null
          scheduled_order?: number | null
          status?: 'scheduled' | 'completed' | 'canceled'
          created_at?: string
        }
      }
      match_players: {
        Row: {
          match_id: string
          user_id: string
          team: 1 | 2
          position: number
        }
        Insert: {
          match_id: string
          user_id: string
          team: 1 | 2
          position?: number
        }
        Update: {
          match_id?: string
          user_id?: string
          team?: 1 | 2
          position?: number
        }
      }
      match_results: {
        Row: {
          match_id: string
          team1_score: number | null
          team2_score: number | null
          completed_at: string | null
        }
        Insert: {
          match_id: string
          team1_score?: number | null
          team2_score?: number | null
          completed_at?: string | null
        }
        Update: {
          match_id?: string
          team1_score?: number | null
          team2_score?: number | null
          completed_at?: string | null
        }
      }
      admin_events: {
        Row: {
          id: string
          created_at: string
          event_type: string
          user_id: string | null
          user_email: string | null
          league_id: string | null
          payload: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          event_type: string
          user_id?: string | null
          user_email?: string | null
          league_id?: string | null
          payload?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          event_type?: string
          user_id?: string | null
          user_email?: string | null
          league_id?: string | null
          payload?: Json | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_user: {
        Args: {
          user_id_to_delete: string
        }
        Returns: void
      }
      delete_user_cascade: {
        Args: {
          target_user_id: string
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
