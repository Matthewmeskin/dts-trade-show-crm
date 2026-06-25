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
      carrier_shows: {
        Row: {
          carrier_id: string
          id: string
          show_id: string
        }
        Insert: {
          carrier_id: string
          id?: string
          show_id: string
        }
        Update: {
          carrier_id?: string
          id?: string
          show_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_shows_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_shows_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_venues: {
        Row: {
          carrier_id: string
          id: string
          venue_id: string
        }
        Insert: {
          carrier_id: string
          id?: string
          venue_id: string
        }
        Update: {
          carrier_id?: string
          id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_venues_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      carriers: {
        Row: {
          carrier_name: string
          created_at: string
          id: string
          trade_show_notes: string | null
          updated_at: string
        }
        Insert: {
          carrier_name: string
          created_at?: string
          id?: string
          trade_show_notes?: string | null
          updated_at?: string
        }
        Update: {
          carrier_name?: string
          created_at?: string
          id?: string
          trade_show_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          carrier_id: string | null
          company: string | null
          contact_type: Database["public"]["Enums"]["contact_type"] | null
          created_at: string
          email: string | null
          exhibitor_id: string | null
          first_name: string | null
          id: string
          last_name: string | null
          notes: string | null
          phone: string | null
          show_id: string | null
          title: string | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          carrier_id?: string | null
          company?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type"] | null
          created_at?: string
          email?: string | null
          exhibitor_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          show_id?: string | null
          title?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          carrier_id?: string | null
          company?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type"] | null
          created_at?: string
          email?: string | null
          exhibitor_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          show_id?: string | null
          title?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          document_name: string
          document_type: Database["public"]["Enums"]["document_type"] | null
          file_url: string | null
          id: string
          shipment_id: string | null
          show_id: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          document_name: string
          document_type?: Database["public"]["Enums"]["document_type"] | null
          file_url?: string | null
          id?: string
          shipment_id?: string | null
          show_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          document_name?: string
          document_type?: Database["public"]["Enums"]["document_type"] | null
          file_url?: string | null
          id?: string
          shipment_id?: string | null
          show_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibitors: {
        Row: {
          company_name: string
          created_at: string
          freight_profile_notes: string | null
          general_notes: string | null
          id: string
          industry: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_contact_title: string | null
          secondary_contacts: Json
          updated_at: string
        }
        Insert: {
          company_name: string
          created_at?: string
          freight_profile_notes?: string | null
          general_notes?: string | null
          id?: string
          industry?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_title?: string | null
          secondary_contacts?: Json
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          freight_profile_notes?: string | null
          general_notes?: string | null
          id?: string
          industry?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_title?: string | null
          secondary_contacts?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          accessorials_flagged: boolean
          actual_delivery_date: string | null
          billed_amount: number | null
          booth_number: string | null
          carrier_id: string | null
          check_in_number: string | null
          consignee_city: string | null
          consignee_company: string | null
          consignee_contact: string | null
          consignee_country: string | null
          consignee_phone: string | null
          consignee_state: string | null
          consignee_street1: string | null
          consignee_street2: string | null
          consignee_zip: string | null
          cost_amount: number | null
          created_at: string
          destination_address: string | null
          destination_type:
            | Database["public"]["Enums"]["shipment_destination"]
            | null
          direction: Database["public"]["Enums"]["shipment_direction"] | null
          estimated_delivery_date: string | null
          exhibitor_id: string | null
          id: string
          margin: number | null
          show_date: string | null
          target_delivery_date: string | null
          mode: Database["public"]["Enums"]["shipment_mode"] | null
          notes: string | null
          origin_city: string | null
          origin_state: string | null
          origin_street: string | null
          origin_zip: string | null
          pickup_date: string | null
          pieces: number | null
          po_ref: string | null
          pro_number: string | null
          shipper_number: string | null
          show_id: string | null
          special_requirements: string | null
          package_type: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tms_customer_id: string | null
          tms_venue_raw: string | null
          tms_venue_city: string | null
          tms_venue_state: string | null
          tms_last_synced_at: string | null
          tms_reference_id: string | null
          tms_sync_status: Database["public"]["Enums"]["tms_sync_status"]
          tracking_url: string | null
          updated_at: string
          venue_id: string | null
          weight: number | null
        }
        Insert: {
          accessorials_flagged?: boolean
          actual_delivery_date?: string | null
          billed_amount?: number | null
          booth_number?: string | null
          carrier_id?: string | null
          check_in_number?: string | null
          consignee_city?: string | null
          consignee_company?: string | null
          consignee_contact?: string | null
          consignee_country?: string | null
          consignee_phone?: string | null
          consignee_state?: string | null
          consignee_street1?: string | null
          consignee_street2?: string | null
          consignee_zip?: string | null
          cost_amount?: number | null
          created_at?: string
          destination_address?: string | null
          destination_type?:
            | Database["public"]["Enums"]["shipment_destination"]
            | null
          direction?: Database["public"]["Enums"]["shipment_direction"] | null
          estimated_delivery_date?: string | null
          show_date?: string | null
          target_delivery_date?: string | null
          exhibitor_id?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["shipment_mode"] | null
          notes?: string | null
          origin_city?: string | null
          origin_state?: string | null
          origin_street?: string | null
          origin_zip?: string | null
          pickup_date?: string | null
          pieces?: number | null
          po_ref?: string | null
          package_type?: string | null
          pro_number?: string | null
          shipper_number?: string | null
          show_id?: string | null
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tms_customer_id?: string | null
          tms_venue_raw?: string | null
          tms_venue_city?: string | null
          tms_venue_state?: string | null
          tms_last_synced_at?: string | null
          tms_reference_id?: string | null
          tms_sync_status?: Database["public"]["Enums"]["tms_sync_status"]
          tracking_url?: string | null
          updated_at?: string
          venue_id?: string | null
          weight?: number | null
        }
        Update: {
          accessorials_flagged?: boolean
          actual_delivery_date?: string | null
          billed_amount?: number | null
          booth_number?: string | null
          carrier_id?: string | null
          check_in_number?: string | null
          consignee_city?: string | null
          consignee_company?: string | null
          consignee_contact?: string | null
          consignee_country?: string | null
          consignee_phone?: string | null
          consignee_state?: string | null
          consignee_street1?: string | null
          consignee_street2?: string | null
          consignee_zip?: string | null
          cost_amount?: number | null
          created_at?: string
          destination_address?: string | null
          destination_type?:
            | Database["public"]["Enums"]["shipment_destination"]
            | null
          direction?: Database["public"]["Enums"]["shipment_direction"] | null
          estimated_delivery_date?: string | null
          show_date?: string | null
          target_delivery_date?: string | null
          exhibitor_id?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["shipment_mode"] | null
          notes?: string | null
          origin_city?: string | null
          origin_state?: string | null
          origin_street?: string | null
          origin_zip?: string | null
          pickup_date?: string | null
          pieces?: number | null
          po_ref?: string | null
          package_type?: string | null
          pro_number?: string | null
          shipper_number?: string | null
          show_id?: string | null
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tms_customer_id?: string | null
          tms_venue_raw?: string | null
          tms_venue_city?: string | null
          tms_venue_state?: string | null
          tms_last_synced_at?: string | null
          tms_reference_id?: string | null
          tms_sync_status?: Database["public"]["Enums"]["tms_sync_status"]
          tracking_url?: string | null
          updated_at?: string
          venue_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      show_debriefs: {
        Row: {
          carrier_performance_notes: string | null
          created_at: string
          id: string
          logged_by: string | null
          recommendations_next_year: string | null
          show_id: string
          venue_issues: string | null
          what_went_well: string | null
          what_went_wrong: string | null
        }
        Insert: {
          carrier_performance_notes?: string | null
          created_at?: string
          id?: string
          logged_by?: string | null
          recommendations_next_year?: string | null
          show_id: string
          venue_issues?: string | null
          what_went_well?: string | null
          what_went_wrong?: string | null
        }
        Update: {
          carrier_performance_notes?: string | null
          created_at?: string
          id?: string
          logged_by?: string | null
          recommendations_next_year?: string | null
          show_id?: string
          venue_issues?: string | null
          what_went_well?: string | null
          what_went_wrong?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "show_debriefs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_debriefs_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_debriefs_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      show_exhibitors: {
        Row: {
          created_at: string
          exhibitor_id: string
          id: string
          show_id: string
        }
        Insert: {
          created_at?: string
          exhibitor_id: string
          id?: string
          show_id: string
        }
        Update: {
          created_at?: string
          exhibitor_id?: string
          id?: string
          show_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_exhibitors_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_exhibitors_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_exhibitors_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          actual_revenue: number | null
          advance_warehouse_cutoff: string | null
          advance_warehouse_open: string | null
          advance_warehouse_address: string | null
          advance_warehouse_name: string | null
          advance_warehouse_care_of: string | null
          advance_warehouse_street1: string | null
          advance_warehouse_street2: string | null
          advance_warehouse_city: string | null
          advance_warehouse_state: string | null
          advance_warehouse_zip: string | null
          advance_warehouse_country: string | null
          direct_to_show_address: string | null
          direct_to_show_name: string | null
          direct_to_show_care_of: string | null
          direct_to_show_street1: string | null
          direct_to_show_street2: string | null
          direct_to_show_city: string | null
          direct_to_show_state: string | null
          direct_to_show_zip: string | null
          direct_to_show_country: string | null
          archived: boolean
          competitor_notes: string | null
          created_at: string
          direct_to_show_end: string | null
          direct_to_show_start: string | null
          edition_year: number | null
          estimated_revenue: number | null
          general_notes: string | null
          exhibitor_list_url: string | null
          exhibitor_manual_url: string | null
          website_url: string | null
          gsc_contact_id: string | null
          id: string
          industry_vertical: string | null
          move_in_end: string | null
          move_in_start: string | null
          move_out_end: string | null
          move_out_start: string | null
          show_end_date: string | null
          show_management_company: string | null
          show_name: string
          show_start_date: string | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          actual_revenue?: number | null
          advance_warehouse_cutoff?: string | null
          advance_warehouse_open?: string | null
          advance_warehouse_address?: string | null
          advance_warehouse_name?: string | null
          advance_warehouse_care_of?: string | null
          advance_warehouse_street1?: string | null
          advance_warehouse_street2?: string | null
          advance_warehouse_city?: string | null
          advance_warehouse_state?: string | null
          advance_warehouse_zip?: string | null
          advance_warehouse_country?: string | null
          direct_to_show_address?: string | null
          direct_to_show_name?: string | null
          direct_to_show_care_of?: string | null
          direct_to_show_street1?: string | null
          direct_to_show_street2?: string | null
          direct_to_show_city?: string | null
          direct_to_show_state?: string | null
          direct_to_show_zip?: string | null
          direct_to_show_country?: string | null
          archived?: boolean
          competitor_notes?: string | null
          created_at?: string
          direct_to_show_end?: string | null
          direct_to_show_start?: string | null
          edition_year?: number | null
          estimated_revenue?: number | null
          general_notes?: string | null
          exhibitor_list_url?: string | null
          exhibitor_manual_url?: string | null
          website_url?: string | null
          gsc_contact_id?: string | null
          id?: string
          industry_vertical?: string | null
          move_in_end?: string | null
          move_in_start?: string | null
          move_out_end?: string | null
          move_out_start?: string | null
          show_end_date?: string | null
          show_management_company?: string | null
          show_name: string
          show_start_date?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          actual_revenue?: number | null
          advance_warehouse_cutoff?: string | null
          advance_warehouse_open?: string | null
          advance_warehouse_address?: string | null
          advance_warehouse_name?: string | null
          advance_warehouse_care_of?: string | null
          advance_warehouse_street1?: string | null
          advance_warehouse_street2?: string | null
          advance_warehouse_city?: string | null
          advance_warehouse_state?: string | null
          advance_warehouse_zip?: string | null
          advance_warehouse_country?: string | null
          direct_to_show_address?: string | null
          direct_to_show_name?: string | null
          direct_to_show_care_of?: string | null
          direct_to_show_street1?: string | null
          direct_to_show_street2?: string | null
          direct_to_show_city?: string | null
          direct_to_show_state?: string | null
          direct_to_show_zip?: string | null
          direct_to_show_country?: string | null
          archived?: boolean
          competitor_notes?: string | null
          created_at?: string
          direct_to_show_end?: string | null
          direct_to_show_start?: string | null
          edition_year?: number | null
          estimated_revenue?: number | null
          general_notes?: string | null
          exhibitor_list_url?: string | null
          exhibitor_manual_url?: string | null
          website_url?: string | null
          gsc_contact_id?: string | null
          id?: string
          industry_vertical?: string | null
          move_in_end?: string | null
          move_in_start?: string | null
          move_out_end?: string | null
          move_out_start?: string | null
          show_end_date?: string | null
          show_management_company?: string | null
          show_name?: string
          show_start_date?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shows_gsc_contact_id_fkey"
            columns: ["gsc_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          related_carrier_id: string | null
          related_exhibitor_id: string | null
          related_shipment_id: string | null
          related_show_id: string | null
          related_venue_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_carrier_id?: string | null
          related_exhibitor_id?: string | null
          related_shipment_id?: string | null
          related_show_id?: string | null
          related_venue_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_carrier_id?: string | null
          related_exhibitor_id?: string | null
          related_shipment_id?: string | null
          related_show_id?: string | null
          related_venue_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_carrier_id_fkey"
            columns: ["related_carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_exhibitor_id_fkey"
            columns: ["related_exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_shipment_id_fkey"
            columns: ["related_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_show_id_fkey"
            columns: ["related_show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_show_id_fkey"
            columns: ["related_show_id"]
            isOneToOne: false
            referencedRelation: "shows_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_venue_id_fkey"
            columns: ["related_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      tms_load_candidates: {
        Row: {
          ai_confidence: string | null
          ai_is_candidate: boolean
          ai_reason: string | null
          billed_amount: number | null
          carrier_name: string | null
          cost_amount: number | null
          created_at: string
          customer_name: string | null
          delivery_location: string | null
          id: string
          load_number: string
          matched_venue: string | null
          mode: string | null
          pickup_location: string | null
          pieces: number | null
          po_ref: string | null
          review_status: string
          shipper_number: string | null
          tms_status: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          ai_confidence?: string | null
          ai_is_candidate?: boolean
          ai_reason?: string | null
          billed_amount?: number | null
          carrier_name?: string | null
          cost_amount?: number | null
          created_at?: string
          customer_name?: string | null
          delivery_location?: string | null
          id?: string
          load_number: string
          matched_venue?: string | null
          mode?: string | null
          pickup_location?: string | null
          pieces?: number | null
          po_ref?: string | null
          review_status?: string
          shipper_number?: string | null
          tms_status?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          ai_confidence?: string | null
          ai_is_candidate?: boolean
          ai_reason?: string | null
          billed_amount?: number | null
          carrier_name?: string | null
          cost_amount?: number | null
          created_at?: string
          customer_name?: string | null
          delivery_location?: string | null
          id?: string
          load_number?: string
          matched_venue?: string | null
          mode?: string | null
          pickup_location?: string | null
          pieces?: number | null
          po_ref?: string | null
          review_status?: string
          shipper_number?: string | null
          tms_status?: string | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          delivery_restrictions: string | null
          dock_notes: string | null
          general_notes: string | null
          id: string
          parking_and_staging_notes: string | null
          state: string | null
          union_rules: string | null
          updated_at: string
          venue_name: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          delivery_restrictions?: string | null
          dock_notes?: string | null
          general_notes?: string | null
          id?: string
          parking_and_staging_notes?: string | null
          state?: string | null
          union_rules?: string | null
          updated_at?: string
          venue_name: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          delivery_restrictions?: string | null
          dock_notes?: string | null
          general_notes?: string | null
          id?: string
          parking_and_staging_notes?: string | null
          state?: string | null
          union_rules?: string | null
          updated_at?: string
          venue_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      shows_with_status: {
        Row: {
          actual_revenue: number | null
          advance_warehouse_cutoff: string | null
          advance_warehouse_open: string | null
          archived: boolean | null
          competitor_notes: string | null
          created_at: string | null
          direct_to_show_end: string | null
          direct_to_show_start: string | null
          edition_year: number | null
          estimated_revenue: number | null
          general_notes: string | null
          gsc_contact_id: string | null
          id: string | null
          industry_vertical: string | null
          move_in_end: string | null
          move_in_start: string | null
          move_out_end: string | null
          move_out_start: string | null
          show_end_date: string | null
          show_management_company: string | null
          show_name: string | null
          show_start_date: string | null
          status: Database["public"]["Enums"]["show_status"] | null
          updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          actual_revenue?: number | null
          advance_warehouse_cutoff?: string | null
          advance_warehouse_open?: string | null
          archived?: boolean | null
          competitor_notes?: string | null
          created_at?: string | null
          direct_to_show_end?: string | null
          direct_to_show_start?: string | null
          edition_year?: number | null
          estimated_revenue?: number | null
          general_notes?: string | null
          gsc_contact_id?: string | null
          id?: string | null
          industry_vertical?: string | null
          move_in_end?: string | null
          move_in_start?: string | null
          move_out_end?: string | null
          move_out_start?: string | null
          show_end_date?: string | null
          show_management_company?: string | null
          show_name?: string | null
          show_start_date?: string | null
          status?: never
          updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          actual_revenue?: number | null
          advance_warehouse_cutoff?: string | null
          advance_warehouse_open?: string | null
          archived?: boolean | null
          competitor_notes?: string | null
          created_at?: string | null
          direct_to_show_end?: string | null
          direct_to_show_start?: string | null
          edition_year?: number | null
          estimated_revenue?: number | null
          general_notes?: string | null
          gsc_contact_id?: string | null
          id?: string | null
          industry_vertical?: string | null
          move_in_end?: string | null
          move_in_start?: string | null
          move_out_end?: string | null
          move_out_start?: string | null
          show_end_date?: string | null
          show_management_company?: string | null
          show_name?: string | null
          show_start_date?: string | null
          status?: never
          updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shows_gsc_contact_id_fkey"
            columns: ["gsc_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      show_status: {
        Args: { s: Database["public"]["Tables"]["shows"]["Row"] }
        Returns: Database["public"]["Enums"]["show_status"]
      }
    }
    Enums: {
      contact_type:
        | "gsc_rep"
        | "venue_coordinator"
        | "exhibitor_contact"
        | "carrier_rep"
        | "other"
      document_type:
        | "exhibitor_kit"
        | "routing_guide"
        | "floor_map"
        | "advance_warehouse_form"
        | "other"
      shipment_destination: "advance_warehouse" | "direct_to_show"
      shipment_direction: "move_in" | "move_out"
      shipment_mode: "LTL" | "FTL" | "partial" | "expedited" | "specialized"
      shipment_status:
        | "quoted"
        | "booked"
        | "in_transit"
        | "delivered"
        | "issue"
      show_status: "upcoming" | "active" | "completed" | "archived"
      task_priority: "low" | "medium" | "high"
      task_status: "open" | "in_progress" | "completed"
      tms_sync_status: "synced" | "manual" | "pending" | "error"
      user_role: "admin" | "standard"
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
      contact_type: [
        "gsc_rep",
        "venue_coordinator",
        "exhibitor_contact",
        "carrier_rep",
        "other",
      ],
      document_type: [
        "exhibitor_kit",
        "routing_guide",
        "floor_map",
        "advance_warehouse_form",
        "other",
      ],
      shipment_destination: ["advance_warehouse", "direct_to_show"],
      shipment_direction: ["move_in", "move_out"],
      shipment_mode: ["LTL", "FTL", "partial", "expedited", "specialized"],
      shipment_status: ["quoted", "booked", "in_transit", "delivered", "issue"],
      show_status: ["upcoming", "active", "completed", "archived"],
      task_priority: ["low", "medium", "high"],
      task_status: ["open", "in_progress", "completed"],
      tms_sync_status: ["synced", "manual", "pending", "error"],
      user_role: ["admin", "standard"],
    },
  },
} as const
