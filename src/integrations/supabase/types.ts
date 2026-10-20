export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      tnp_tours: {
        Row: {
          description: string;
          visibility: string;
          settings: Json;
          revision: number;
          id: string;
          owner_id: string;
          title: string;
          is_published: boolean;
          created_at: string;
        };
        Insert: {
          description?: string;
          visibility?: string;
          settings?: Json;
          revision?: number;
          id?: string;
          owner_id: string;
          title: string;
          is_published?: boolean;
          created_at?: string;
        };
        Update: {
          description?: string;
          visibility?: string;
          settings?: Json;
          revision?: number;
          id?: string;
          owner_id?: string;
          title?: string;
          is_published?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      tnp_tour_scenes: {
        Row: {
          settings: Json;
          id: string;
          tour_id: string;
          name: string;
          panorama_url: string;
          storage_path: string;
          scene_order: number;
          created_at: string;
        };
        Insert: {
          settings?: Json;
          id?: string;
          tour_id: string;
          name: string;
          panorama_url: string;
          storage_path: string;
          scene_order?: number;
          created_at?: string;
        };
        Update: {
          settings?: Json;
          id?: string;
          tour_id?: string;
          name?: string;
          panorama_url?: string;
          storage_path?: string;
          scene_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      lease_requests: {
        Row: {
          reviewed_at: string | null;
          reviewed_by: string | null;
          decision_at: string | null;
          rejection_reason: string | null;
          withdrawn_at: string | null;
          lease_id: string | null;
          preferred_move_in: string | null;
          occupants: number | null;
          employment_status: string | null;
          monthly_income: number | null;
          phone: string | null;
          created_at: string;
          id: string;
          message: string | null;
          landlord_message: string | null;
          updated_at: string;
          move_in: string | null;
          property_id: string;
          status: string;
          tenant_id: string;
        };
        Insert: {
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          decision_at?: string | null;
          rejection_reason?: string | null;
          withdrawn_at?: string | null;
          lease_id?: string | null;
          preferred_move_in?: string | null;
          occupants?: number | null;
          employment_status?: string | null;
          monthly_income?: number | null;
          phone?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          landlord_message?: string | null;
          updated_at?: string;
          move_in?: string | null;
          property_id: string;
          status?: string;
          tenant_id: string;
        };
        Update: {
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          decision_at?: string | null;
          rejection_reason?: string | null;
          withdrawn_at?: string | null;
          lease_id?: string | null;
          preferred_move_in?: string | null;
          occupants?: number | null;
          employment_status?: string | null;
          monthly_income?: number | null;
          phone?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          landlord_message?: string | null;
          updated_at?: string;
          move_in?: string | null;
          property_id?: string;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lease_requests_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          bio: string | null;
          created_at: string;
          full_name: string;
          id: string;
          phone: string | null;
          trust_score: number;
          updated_at: string;
          verification: string;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          full_name?: string;
          id: string;
          phone?: string | null;
          trust_score?: number;
          updated_at?: string;
          verification?: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          phone?: string | null;
          trust_score?: number;
          updated_at?: string;
          verification?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          tour_url: string | null;
          property_category: string;
          listing_type: string;
          price_usd: number | null;
          price_unit: string;
          rooms: number | null;
          size: number | null;
          size_unit: string;
          land_use: string | null;
          water_available: boolean;
          electricity_available: boolean;
          road_access: boolean;
          zoning: string | null;
          title_status: string | null;
          amenities: string[];
          available: boolean;
          baths: number;
          beds: number;
          city: string;
          created_at: string;
          deposit_usd: number;
          description: string | null;
          fraud_flags: string[];
          id: string;
          image_url: string | null;
          owner_id: string;
          property_type: string;
          rent_usd: number;
          suburb: string;
          title: string;
          verified: boolean;
        };
        Insert: {
          tour_url?: string | null;
          property_category?: string;
          listing_type?: string;
          price_usd?: number | null;
          price_unit?: string;
          rooms?: number | null;
          size?: number | null;
          size_unit?: string;
          land_use?: string | null;
          water_available?: boolean;
          electricity_available?: boolean;
          road_access?: boolean;
          zoning?: string | null;
          title_status?: string | null;
          amenities?: string[];
          available?: boolean;
          baths?: number;
          beds?: number;
          city?: string;
          created_at?: string;
          deposit_usd?: number;
          description?: string | null;
          fraud_flags?: string[];
          id?: string;
          image_url?: string | null;
          owner_id: string;
          property_type?: string;
          rent_usd: number;
          suburb: string;
          title: string;
          verified?: boolean;
        };
        Update: {
          tour_url?: string | null;
          property_category?: string;
          listing_type?: string;
          price_usd?: number | null;
          price_unit?: string;
          rooms?: number | null;
          size?: number | null;
          size_unit?: string;
          land_use?: string | null;
          water_available?: boolean;
          electricity_available?: boolean;
          road_access?: boolean;
          zoning?: string | null;
          title_status?: string | null;
          amenities?: string[];
          available?: boolean;
          baths?: number;
          beds?: number;
          city?: string;
          created_at?: string;
          deposit_usd?: number;
          description?: string | null;
          fraud_flags?: string[];
          id?: string;
          image_url?: string | null;
          owner_id?: string;
          property_type?: string;
          rent_usd?: number;
          suburb?: string;
          title?: string;
          verified?: boolean;
        };
        Relationships: [];
      };
      property_history: {
        Row: {
          detail: string | null;
          entry_hash: string;
          event: string;
          id: string;
          occurred_at: string;
          property_id: string;
        };
        Insert: {
          detail?: string | null;
          entry_hash?: string;
          event: string;
          id?: string;
          occurred_at?: string;
          property_id: string;
        };
        Update: {
          detail?: string | null;
          entry_hash?: string;
          event?: string;
          id?: string;
          occurred_at?: string;
          property_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_history_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          moderation_status: string;
          admin_note: string | null;
          reviewed_at: string | null;
          landlord_response: string | null;
          landlord_responded_at: string | null;
          landlord_response_by: string | null;
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          lease_confirmed: boolean;
          property_id: string | null;
          rating: number;
          subject_id: string;
        };
        Insert: {
          moderation_status?: string;
          admin_note?: string | null;
          reviewed_at?: string | null;
          landlord_response?: string | null;
          landlord_responded_at?: string | null;
          landlord_response_by?: string | null;
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          lease_confirmed?: boolean;
          property_id?: string | null;
          rating?: number;
          subject_id: string;
        };
        Update: {
          moderation_status?: string;
          admin_note?: string | null;
          reviewed_at?: string | null;
          landlord_response?: string | null;
          landlord_responded_at?: string | null;
          landlord_response_by?: string | null;
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          lease_confirmed?: boolean;
          property_id?: string | null;
          rating?: number;
          subject_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "tenant" | "landlord" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["tenant", "landlord", "admin"],
    },
  },
} as const;
