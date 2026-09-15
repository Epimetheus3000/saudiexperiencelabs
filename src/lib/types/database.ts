// Hand-written to match supabase/migrations/0001_init.sql.
// Once the Supabase project is linked, regenerate with:
//   npx supabase gen types typescript --linked > src/lib/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      labs: {
        Row: {
          id: string;
          name: string;
          logo_url: string | null;
          primary_color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          logo_url?: string | null;
          primary_color?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["labs"]["Insert"]>;
      };
      users: {
        Row: {
          id: string;
          email: string;
          is_master: boolean;
          is_external: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          is_master?: boolean;
          is_external?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      lab_memberships: {
        Row: {
          id: string;
          user_id: string;
          lab_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lab_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lab_memberships"]["Insert"]>;
      };
      stages: {
        Row: {
          id: string;
          lab_id: string;
          name: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          lab_id: string;
          name: string;
          position: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stages"]["Insert"]>;
      };
      stage_deadlines: {
        Row: {
          stage_id: string;
          lab_id: string;
          deadline_at: string | null;
        };
        Insert: {
          stage_id: string;
          lab_id: string;
          deadline_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["stage_deadlines"]["Insert"]>;
      };
      ideas: {
        Row: {
          id: string;
          lab_id: string;
          stage_id: string;
          title: string;
          category: string | null;
          description: string | null;
          pros: string | null;
          cons: string | null;
          shortlist_reasoning: string | null;
          concept_details: string | null;
          concept_audience: string | null;
          concept_notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lab_id: string;
          stage_id: string;
          title: string;
          category?: string | null;
          description?: string | null;
          pros?: string | null;
          cons?: string | null;
          shortlist_reasoning?: string | null;
          concept_details?: string | null;
          concept_audience?: string | null;
          concept_notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ideas"]["Insert"]>;
      };
      rating_criteria: {
        Row: {
          id: string;
          lab_id: string | null;
          name: string;
          scale: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          lab_id?: string | null;
          name: string;
          scale?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rating_criteria"]["Insert"]>;
      };
      ratings: {
        Row: {
          id: string;
          idea_id: string;
          criterion_id: string;
          user_id: string;
          score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          idea_id: string;
          criterion_id: string;
          user_id: string;
          score: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ratings"]["Insert"]>;
      };
      comments: {
        Row: {
          id: string;
          idea_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          idea_id: string;
          user_id: string;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
