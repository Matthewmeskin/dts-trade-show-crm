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
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          summary: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          summary?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          summary?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          enabled: boolean
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_shows: {
        Row: {
          carrier_id: string
          id: string
          preferred: boolean
          show_id: string
        }
        Insert: {
          carrier_id: string
          id?: string
          preferred?: boolean
          show_id: string
        }
        Update: {
          carrier_id?: string
          id?: string
          preferred?: boolean
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
          {
            foreignKeyName: "carrier_shows_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows_with_status"
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
          bill_to_address1: string | null
          bill_to_address2: string | null
          bill_to_city: string | null
          bill_to_company: string | null
          bill_to_phone: string | null
          bill_to_state: string | null
          bill_to_zip: string | null
          carrier_name: string
          created_at: string
          id: string
          trade_show_notes: string | null
          updated_at: string
        }
        Insert: {
          bill_to_address1?: string | null
          bill_to_address2?: string | null
          bill_to_city?: string | null
          bill_to_company?: string | null
          bill_to_phone?: string | null
          bill_to_state?: string | null
          bill_to_zip?: string | null
          carrier_name: string
          created_at?: string
          id?: string
          trade_show_notes?: string | null
          updated_at?: string
        }
        Update: {
          bill_to_address1?: string | null
          bill_to_address2?: string | null
          bill_to_city?: string | null
          bill_to_company?: string | null
          bill_to_phone?: string | null
          bill_to_state?: string | null
          bill_to_zip?: string | null
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
          partner_id: string | null
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
          partner_id?: string | null
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
          partner_id?: string | null
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
            foreignKeyName: "documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
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
      mha_review_results: {
        Row: {
          checks: Json
          created_at: string
          extracted: Json
          gc_detected: string | null
          id: string
          model: string
          overall: string
          submission_id: string
        }
        Insert: {
          checks: Json
          created_at?: string
          extracted: Json
          gc_detected?: string | null
          id?: string
          model: string
          overall: string
          submission_id: string
        }
        Update: {
          checks?: Json
          created_at?: string
          extracted?: Json
          gc_detected?: string | null
          id?: string
          model?: string
          overall?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mha_review_results_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "mha_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      mha_submissions: {
        Row: {
          company_name: string
          created_at: string
          file_bytes: number
          file_mime: string
          id: string
          load_id: string | null
          load_number_input: string | null
          match_method: string | null
          show_id: string | null
          status: string
          storage_path: string
          submitter_email: string
          submitter_name: string
          submitter_phone: string
        }
        Insert: {
          company_name: string
          created_at?: string
          file_bytes: number
          file_mime: string
          id?: string
          load_id?: string | null
          load_number_input?: string | null
          match_method?: string | null
          show_id?: string | null
          status?: string
          storage_path: string
          submitter_email: string
          submitter_name: string
          submitter_phone: string
        }
        Update: {
          company_name?: string
          created_at?: string
          file_bytes?: number
          file_mime?: string
          id?: string
          load_id?: string | null
          load_number_input?: string | null
          match_method?: string | null
          show_id?: string | null
          status?: string
          storage_path?: string
          submitter_email?: string
          submitter_name?: string
          submitter_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "mha_submissions_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mha_submissions_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mha_submissions_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_calls: {
        Row: {
          booked_by: string | null
          client_count: number | null
          contact_id: string | null
          created_at: string
          id: string
          outcome: string | null
          outcome_at: string | null
          outcome_by: string | null
          outcome_note: string | null
          partner_id: string
          q_agreed_time: boolean
          q_influence: boolean
          q_show_120: boolean
          rep_id: string
          scheduled_at: string
          shipping_pain: string
          shows_note: string
          signal: string
          status: string
          updated_at: string
        }
        Insert: {
          booked_by?: string | null
          client_count?: number | null
          contact_id?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          outcome_at?: string | null
          outcome_by?: string | null
          outcome_note?: string | null
          partner_id: string
          q_agreed_time?: boolean
          q_influence?: boolean
          q_show_120?: boolean
          rep_id: string
          scheduled_at: string
          shipping_pain: string
          shows_note: string
          signal: string
          status?: string
          updated_at?: string
        }
        Update: {
          booked_by?: string | null
          client_count?: number | null
          contact_id?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          outcome_at?: string | null
          outcome_by?: string | null
          outcome_note?: string | null
          partner_id?: string
          q_agreed_time?: boolean
          q_influence?: boolean
          q_show_120?: boolean
          rep_id?: string
          scheduled_at?: string
          shipping_pain?: string
          shows_note?: string
          signal?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_calls_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_calls_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_clients: {
        Row: {
          created_at: string
          created_by: string | null
          exhibitor_id: string
          id: string
          in_pilot: boolean
          notes: string | null
          partner_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          exhibitor_id: string
          id?: string
          in_pilot?: boolean
          notes?: string | null
          partner_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          exhibitor_id?: string
          id?: string
          in_pilot?: boolean
          notes?: string | null
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_clients_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_clients_exhibitor_id_fkey"
            columns: ["exhibitor_id"]
            isOneToOne: false
            referencedRelation: "exhibitors"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_code_history: {
        Row: {
          old_code: string
          partner_id: string
          retired_at: string
          retired_by: string | null
        }
        Insert: {
          old_code: string
          partner_id: string
          retired_at?: string
          retired_by?: string | null
        }
        Update: {
          old_code?: string
          partner_id?: string
          retired_at?: string
          retired_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_code_history_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_rebate_lines: {
        Row: {
          billed: number
          cost: number
          exhibitor_name: string | null
          id: string
          invoice_nos: string | null
          margin: number
          paid_on: string
          rebate: number
          shipment_id: string | null
          show_name: string | null
          statement_id: string
          tms_reference_id: string | null
        }
        Insert: {
          billed: number
          cost: number
          exhibitor_name?: string | null
          id?: string
          invoice_nos?: string | null
          margin: number
          paid_on: string
          rebate: number
          shipment_id?: string | null
          show_name?: string | null
          statement_id: string
          tms_reference_id?: string | null
        }
        Update: {
          billed?: number
          cost?: number
          exhibitor_name?: string | null
          id?: string
          invoice_nos?: string | null
          margin?: number
          paid_on?: string
          rebate?: number
          shipment_id?: string | null
          show_name?: string | null
          statement_id?: string
          tms_reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_rebate_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "partner_rebate_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_rebate_lines_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_rebate_statements: {
        Row: {
          billed_total: number
          commission_basis: string | null
          id: string
          issued_at: string
          issued_by: string | null
          line_count: number
          margin_total: number
          notes: string | null
          paid_by: string | null
          paid_on: string | null
          paid_ref: string | null
          partner_id: string
          period_end: string
          period_start: string
          quarter: string
          rebate_pct: number
          rebate_total: number
          sent_at: string | null
          status: string
        }
        Insert: {
          billed_total: number
          commission_basis?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          line_count: number
          margin_total: number
          notes?: string | null
          paid_by?: string | null
          paid_on?: string | null
          paid_ref?: string | null
          partner_id: string
          period_end: string
          period_start: string
          quarter: string
          rebate_pct: number
          rebate_total: number
          sent_at?: string | null
          status?: string
        }
        Update: {
          billed_total?: number
          commission_basis?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          line_count?: number
          margin_total?: number
          notes?: string | null
          paid_by?: string | null
          paid_on?: string | null
          paid_ref?: string | null
          partner_id?: string
          period_end?: string
          period_start?: string
          quarter?: string
          rebate_pct?: number
          rebate_total?: number
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_rebate_statements_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_shows: {
        Row: {
          manifest_sent_at: string | null
          cobranded: boolean
          client_count: number | null
          created_at: string
          id: string
          is_pilot: boolean
          notes: string | null
          partner_id: string
          show_id: string
        }
        Insert: {
          manifest_sent_at?: string | null
          cobranded?: boolean
          client_count?: number | null
          created_at?: string
          id?: string
          is_pilot?: boolean
          notes?: string | null
          partner_id: string
          show_id: string
        }
        Update: {
          manifest_sent_at?: string | null
          cobranded?: boolean
          client_count?: number | null
          created_at?: string
          id?: string
          is_pilot?: boolean
          notes?: string | null
          partner_id?: string
          show_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_shows_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_shows_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_signals: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          occurred_on: string
          partner_id: string
          show_id: string | null
          signal_type: string
          worked_at: string | null
          worked_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          occurred_on?: string
          partner_id: string
          show_id?: string | null
          signal_type: string
          worked_at?: string | null
          worked_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          occurred_on?: string
          partner_id?: string
          show_id?: string | null
          signal_type?: string
          worked_at?: string | null
          worked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_signals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_signals_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_touches: {
        Row: {
          channel: string
          created_by: string | null
          id: string
          note: string | null
          occurred_at: string
          partner_id: string
          reached: boolean
        }
        Insert: {
          channel: string
          created_by?: string | null
          id?: string
          note?: string | null
          occurred_at?: string
          partner_id: string
          reached?: boolean
        }
        Update: {
          channel?: string
          created_by?: string | null
          id?: string
          note?: string | null
          occurred_at?: string
          partner_id?: string
          reached?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "partner_touches_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_touches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          ship_manifest_to: string | null
          label_settings: Json
          ship_email: string | null
          ship_phone: string | null
          code: string | null
          commission_basis: string | null
          incentive_model: string | null
          logo_url: string | null
          markup_pct: number | null
          public_name: string | null
          rebate_pct: number | null
          terms_note: string | null
          cobrand_active: boolean
          admin_id: string | null
          archived: boolean
          city: string | null
          client_count: number | null
          created_at: string
          created_by: string | null
          id: string
          last_report_sent_at: string | null
          name: string
          next_step: string | null
          next_step_on: string | null
          notes: string | null
          report_active: boolean
          report_to: string | null
          partner_type: string
          rep_id: string | null
          shipping_pain: string | null
          source: string | null
          stage: string
          state: string | null
          tier: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          ship_manifest_to?: string | null
          label_settings?: Json
          ship_email?: string | null
          ship_phone?: string | null
          code?: string | null
          commission_basis?: string | null
          incentive_model?: string | null
          logo_url?: string | null
          markup_pct?: number | null
          public_name?: string | null
          rebate_pct?: number | null
          terms_note?: string | null
          cobrand_active?: boolean
          admin_id?: string | null
          archived?: boolean
          city?: string | null
          client_count?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_report_sent_at?: string | null
          name: string
          next_step?: string | null
          next_step_on?: string | null
          notes?: string | null
          report_active?: boolean
          report_to?: string | null
          partner_type?: string
          rep_id?: string | null
          shipping_pain?: string | null
          source?: string | null
          stage?: string
          state?: string | null
          tier?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          ship_manifest_to?: string | null
          label_settings?: Json
          ship_email?: string | null
          ship_phone?: string | null
          code?: string | null
          commission_basis?: string | null
          incentive_model?: string | null
          logo_url?: string | null
          markup_pct?: number | null
          public_name?: string | null
          rebate_pct?: number | null
          terms_note?: string | null
          cobrand_active?: boolean
          admin_id?: string | null
          archived?: boolean
          city?: string | null
          client_count?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_report_sent_at?: string | null
          name?: string
          next_step?: string | null
          next_step_on?: string | null
          notes?: string | null
          report_active?: boolean
          report_to?: string | null
          partner_type?: string
          rep_id?: string | null
          shipping_pain?: string | null
          source?: string | null
          stage?: string
          state?: string | null
          tier?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_sections: {
        Row: {
          body: string
          key: string
          sort: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          key: string
          sort?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          key?: string
          sort?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          booking_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_mha_default_contact: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          title: string | null
          updated_at: string
        }
        Insert: {
          booking_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_mha_default_contact?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          booking_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_mha_default_contact?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      public_sync_runs: {
        Row: {
          error: string | null
          id: number
          ok: boolean
          partner_rows: number
          ran_at: string
          revalidated: boolean | null
          show_rows: number
          trigger: string
        }
        Insert: {
          error?: string | null
          id?: never
          ok: boolean
          partner_rows?: number
          ran_at?: string
          revalidated?: boolean | null
          show_rows?: number
          trigger: string
        }
        Update: {
          error?: string | null
          id?: never
          ok?: boolean
          partner_rows?: number
          ran_at?: string
          revalidated?: boolean | null
          show_rows?: number
          trigger?: string
        }
        Relationships: []
      }
      ship_change_requests: {
        Row: {
          handled_at: string | null
          handled_by: string | null
          handled_note: string | null
          id: string
          message: string
          public_change_id: number
          request_id: string
          requested_at: string
        }
        Insert: {
          handled_at?: string | null
          handled_by?: string | null
          handled_note?: string | null
          id?: string
          message: string
          public_change_id: number
          request_id: string
          requested_at: string
        }
        Update: {
          handled_at?: string | null
          handled_by?: string | null
          handled_note?: string | null
          id?: string
          message?: string
          public_change_id?: number
          request_id?: string
          requested_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ship_change_requests_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ship_request_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ship_change_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ship_email_log: {
        Row: {
          error: string | null
          id: string
          key: string
          kind: string
          ok: boolean | null
          partner_id: string | null
          request_id: string | null
          sent_at: string
          sent_by: string | null
          sent_to: string
          show_id: string | null
          subject: string | null
        }
        Insert: {
          error?: string | null
          id?: string
          key: string
          kind: string
          ok?: boolean | null
          partner_id?: string | null
          request_id?: string | null
          sent_at?: string
          sent_by?: string | null
          sent_to: string
          show_id?: string | null
          subject?: string | null
        }
        Update: {
          error?: string | null
          id?: string
          key?: string
          kind?: string
          ok?: boolean | null
          partner_id?: string | null
          request_id?: string | null
          sent_at?: string
          sent_by?: string | null
          sent_to?: string
          show_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ship_email_log_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ship_email_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ship_request_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ship_email_log_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ship_email_log_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      ship_pull_state: {
        Row: {
          id: number
          last_count: number
          last_error: string | null
          last_ok_at: string | null
          last_run_at: string | null
        }
        Insert: {
          id?: number
          last_count?: number
          last_error?: string | null
          last_ok_at?: string | null
          last_run_at?: string | null
        }
        Update: {
          id?: number
          last_count?: number
          last_error?: string | null
          last_ok_at?: string | null
          last_run_at?: string | null
        }
        Relationships: []
      }
      ship_quotes: {
        Row: {
          amount: number
          id: string
          leg_id: string
          note: string | null
          sent_at: string
          sent_by: string | null
          sent_to: string | null
          sent_via: string
        }
        Insert: {
          amount: number
          id?: string
          leg_id: string
          note?: string | null
          sent_at?: string
          sent_by?: string | null
          sent_to?: string | null
          sent_via: string
        }
        Update: {
          amount?: number
          id?: string
          leg_id?: string
          note?: string | null
          sent_at?: string
          sent_by?: string | null
          sent_to?: string | null
          sent_via?: string
        }
        Relationships: [
          {
            foreignKeyName: "ship_quotes_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "ship_request_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ship_quotes_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ship_request_inbox: {
        Row: {
          exhibitor_version: number
          exhibitor_cancelled_at: string | null
          pushed_closed: boolean
          assigned_to: string | null
          booth: string | null
          booth_tbd: boolean
          closed: string | null
          closed_at: string | null
          closed_by: string | null
          closed_note: string | null
          company: string | null
          confirmed_at: string | null
          contact_name: string | null
          declared_value: number | null
          email: string | null
          id: string
          marketing_consent: boolean
          marketing_consent_text: string | null
          mobile: string | null
          on_behalf_of: string | null
          partner_id: string | null
          problems: string[]
          public_ref: string
          public_request_id: string
          received_at: string
          show_id: string | null
          show_snapshot: Json
          submitted_at: string | null
          terms_accepted_at: string | null
          updated_at: string
          wants_coverage: boolean
        }
        Insert: {
          exhibitor_version?: number
          exhibitor_cancelled_at?: string | null
          pushed_closed?: boolean
          assigned_to?: string | null
          booth?: string | null
          booth_tbd?: boolean
          closed?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_note?: string | null
          company?: string | null
          confirmed_at?: string | null
          contact_name?: string | null
          declared_value?: number | null
          email?: string | null
          id?: string
          marketing_consent?: boolean
          marketing_consent_text?: string | null
          mobile?: string | null
          on_behalf_of?: string | null
          partner_id?: string | null
          problems?: string[]
          public_ref: string
          public_request_id: string
          received_at?: string
          show_id?: string | null
          show_snapshot?: Json
          submitted_at?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          wants_coverage?: boolean
        }
        Update: {
          exhibitor_version?: number
          exhibitor_cancelled_at?: string | null
          pushed_closed?: boolean
          assigned_to?: string | null
          booth?: string | null
          booth_tbd?: boolean
          closed?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_note?: string | null
          company?: string | null
          confirmed_at?: string | null
          contact_name?: string | null
          declared_value?: number | null
          email?: string | null
          id?: string
          marketing_consent?: boolean
          marketing_consent_text?: string | null
          mobile?: string | null
          on_behalf_of?: string | null
          partner_id?: string | null
          problems?: string[]
          public_ref?: string
          public_request_id?: string
          received_at?: string
          show_id?: string | null
          show_snapshot?: Json
          submitted_at?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          wants_coverage?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ship_request_inbox_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ship_request_inbox_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ship_request_inbox_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ship_request_inbox_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      ship_request_legs: {
        Row: {
          approved_at: string | null
          pushed: Json | null
          city: string | null
          deliver_by: string | null
          description: string | null
          direction: string
          hazmat: boolean
          id: string
          inbound_to: string | null
          inside: boolean
          largest_h_in: number | null
          largest_l_in: number | null
          largest_w_in: number | null
          liftgate: boolean
          location_type: string | null
          onsite_contact_mobile: string | null
          onsite_contact_name: string | null
          own_carrier: boolean
          packaging: string | null
          pieces: number | null
          place_name: string | null
          public_leg_id: string
          ready_date: string | null
          request_id: string
          return_to_warehouse: boolean
          seq: number
          stage: string
          state: string | null
          street1: string | null
          street2: string | null
          updated_at: string
          weight_lbs: number | null
          zip: string | null
        }
        Insert: {
          approved_at?: string | null
          pushed?: Json | null
          city?: string | null
          deliver_by?: string | null
          description?: string | null
          direction: string
          hazmat?: boolean
          id?: string
          inbound_to?: string | null
          inside?: boolean
          largest_h_in?: number | null
          largest_l_in?: number | null
          largest_w_in?: number | null
          liftgate?: boolean
          location_type?: string | null
          onsite_contact_mobile?: string | null
          onsite_contact_name?: string | null
          own_carrier?: boolean
          packaging?: string | null
          pieces?: number | null
          place_name?: string | null
          public_leg_id: string
          ready_date?: string | null
          request_id: string
          return_to_warehouse?: boolean
          seq: number
          stage?: string
          state?: string | null
          street1?: string | null
          street2?: string | null
          updated_at?: string
          weight_lbs?: number | null
          zip?: string | null
        }
        Update: {
          approved_at?: string | null
          pushed?: Json | null
          city?: string | null
          deliver_by?: string | null
          description?: string | null
          direction?: string
          hazmat?: boolean
          id?: string
          inbound_to?: string | null
          inside?: boolean
          largest_h_in?: number | null
          largest_l_in?: number | null
          largest_w_in?: number | null
          liftgate?: boolean
          location_type?: string | null
          onsite_contact_mobile?: string | null
          onsite_contact_name?: string | null
          own_carrier?: boolean
          packaging?: string | null
          pieces?: number | null
          place_name?: string | null
          public_leg_id?: string
          ready_date?: string | null
          request_id?: string
          return_to_warehouse?: boolean
          seq?: number
          stage?: string
          state?: string | null
          street1?: string | null
          street2?: string | null
          updated_at?: string
          weight_lbs?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ship_request_legs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ship_request_inbox"
            referencedColumns: ["id"]
          },
        ]
      }
      ship_shows: {
        Row: {
          coordinator_mobile: string | null
          coordinator_name: string | null
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          manifest_email: string
          outbound_email: boolean
          partner_id: string
          request_cap: number | null
          show_id: string
          transit_days: number
          updated_at: string
        }
        Insert: {
          coordinator_mobile?: string | null
          coordinator_name?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          manifest_email?: string
          outbound_email?: boolean
          partner_id: string
          request_cap?: number | null
          show_id: string
          transit_days?: number
          updated_at?: string
        }
        Update: {
          coordinator_mobile?: string | null
          coordinator_name?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          manifest_email?: string
          outbound_email?: boolean
          partner_id?: string
          request_cap?: number | null
          show_id?: string
          transit_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ship_shows_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ship_shows_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          source: string
          partner_credit_source: string | null
          partner_credited_at: string | null
          partner_credited_by: string | null
          partner_id: string | null
          accessorials_flagged: boolean
          actual_delivery_date: string | null
          billed_amount: number | null
          booth_number: string | null
          carrier_id: string | null
          check_in_number: string | null
          carrier_quote_number: string | null
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
          forced: boolean
          forced_at: string | null
          forced_by: string | null
          forced_reason: Database["public"]["Enums"]["forced_reason"] | null
          forced_reason_other: string | null
          id: string
          margin: number | null
          mode: Database["public"]["Enums"]["shipment_mode"] | null
          notes: string | null
          origin_city: string | null
          origin_state: string | null
          origin_street: string | null
          origin_zip: string | null
          package_type: string | null
          pickup_date: string | null
          pieces: number | null
          po_ref: string | null
          pro_number: string | null
          ship_leg_id: string | null
          shipper_number: string | null
          show_auto_linked: boolean
          show_date: string | null
          show_id: string | null
          special_requirements: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          target_delivery_date: string | null
          tms_created_at: string | null
          tms_customer_id: string | null
          tms_last_synced_at: string | null
          tms_reference_id: string | null
          tms_sync_status: Database["public"]["Enums"]["tms_sync_status"]
          tms_venue_city: string | null
          tms_venue_raw: string | null
          tms_venue_state: string | null
          tracking_url: string | null
          updated_at: string
          venue_auto_linked: boolean
          venue_id: string | null
          weight: number | null
        }
        Insert: {
          source?: string
          partner_credit_source?: string | null
          partner_credited_at?: string | null
          partner_credited_by?: string | null
          partner_id?: string | null
          accessorials_flagged?: boolean
          actual_delivery_date?: string | null
          billed_amount?: number | null
          booth_number?: string | null
          carrier_id?: string | null
          check_in_number?: string | null
          carrier_quote_number?: string | null
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
          exhibitor_id?: string | null
          forced?: boolean
          forced_at?: string | null
          forced_by?: string | null
          forced_reason?: Database["public"]["Enums"]["forced_reason"] | null
          forced_reason_other?: string | null
          id?: string
          margin?: number | null
          mode?: Database["public"]["Enums"]["shipment_mode"] | null
          notes?: string | null
          origin_city?: string | null
          origin_state?: string | null
          origin_street?: string | null
          origin_zip?: string | null
          package_type?: string | null
          pickup_date?: string | null
          pieces?: number | null
          po_ref?: string | null
          pro_number?: string | null
          ship_leg_id?: string | null
          shipper_number?: string | null
          show_auto_linked?: boolean
          show_date?: string | null
          show_id?: string | null
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          target_delivery_date?: string | null
          tms_created_at?: string | null
          tms_customer_id?: string | null
          tms_last_synced_at?: string | null
          tms_reference_id?: string | null
          tms_sync_status?: Database["public"]["Enums"]["tms_sync_status"]
          tms_venue_city?: string | null
          tms_venue_raw?: string | null
          tms_venue_state?: string | null
          tracking_url?: string | null
          updated_at?: string
          venue_auto_linked?: boolean
          venue_id?: string | null
          weight?: number | null
        }
        Update: {
          source?: string
          partner_credit_source?: string | null
          partner_credited_at?: string | null
          partner_credited_by?: string | null
          partner_id?: string | null
          accessorials_flagged?: boolean
          actual_delivery_date?: string | null
          billed_amount?: number | null
          booth_number?: string | null
          carrier_id?: string | null
          check_in_number?: string | null
          carrier_quote_number?: string | null
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
          exhibitor_id?: string | null
          forced?: boolean
          forced_at?: string | null
          forced_by?: string | null
          forced_reason?: Database["public"]["Enums"]["forced_reason"] | null
          forced_reason_other?: string | null
          id?: string
          margin?: number | null
          mode?: Database["public"]["Enums"]["shipment_mode"] | null
          notes?: string | null
          origin_city?: string | null
          origin_state?: string | null
          origin_street?: string | null
          origin_zip?: string | null
          package_type?: string | null
          pickup_date?: string | null
          pieces?: number | null
          po_ref?: string | null
          pro_number?: string | null
          ship_leg_id?: string | null
          shipper_number?: string | null
          show_auto_linked?: boolean
          show_date?: string | null
          show_id?: string | null
          special_requirements?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          target_delivery_date?: string | null
          tms_created_at?: string | null
          tms_customer_id?: string | null
          tms_last_synced_at?: string | null
          tms_reference_id?: string | null
          tms_sync_status?: Database["public"]["Enums"]["tms_sync_status"]
          tms_venue_city?: string | null
          tms_venue_raw?: string | null
          tms_venue_state?: string | null
          tracking_url?: string | null
          updated_at?: string
          venue_auto_linked?: boolean
          venue_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_ship_leg_id_fkey"
            columns: ["ship_leg_id"]
            isOneToOne: true
            referencedRelation: "ship_request_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
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
            foreignKeyName: "shipments_forced_by_fkey"
            columns: ["forced_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          {
            foreignKeyName: "shipments_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      show_assignees: {
        Row: {
          created_at: string
          id: string
          show_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          show_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          show_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_assignees_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_assignees_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      show_public_logistics: {
        Row: {
          advance_cutoff_local: string | null
          advance_late_surcharge_note: string | null
          carrier_check_in_cutoff_local: string | null
          created_at: string
          direct_cutoff_local: string | null
          dts_public_notes: string | null
          dts_public_notes_updated_at: string | null
          gsc_url: string | null
          label_requirements_note: string | null
          last_verified_at: string | null
          marshalling_yard_note: string | null
          show_id: string
          source_type: string | null
          source_url: string | null
          targeted_move_in: boolean
          targeted_move_in_note: string | null
          timezone: string | null
          updated_at: string
          verification_status: string
          verified_by: string | null
        }
        Insert: {
          advance_cutoff_local?: string | null
          advance_late_surcharge_note?: string | null
          carrier_check_in_cutoff_local?: string | null
          created_at?: string
          direct_cutoff_local?: string | null
          dts_public_notes?: string | null
          dts_public_notes_updated_at?: string | null
          gsc_url?: string | null
          label_requirements_note?: string | null
          last_verified_at?: string | null
          marshalling_yard_note?: string | null
          show_id: string
          source_type?: string | null
          source_url?: string | null
          targeted_move_in?: boolean
          targeted_move_in_note?: string | null
          timezone?: string | null
          updated_at?: string
          verification_status?: string
          verified_by?: string | null
        }
        Update: {
          advance_cutoff_local?: string | null
          advance_late_surcharge_note?: string | null
          carrier_check_in_cutoff_local?: string | null
          created_at?: string
          direct_cutoff_local?: string | null
          dts_public_notes?: string | null
          dts_public_notes_updated_at?: string | null
          gsc_url?: string | null
          label_requirements_note?: string | null
          last_verified_at?: string | null
          marshalling_yard_note?: string | null
          show_id?: string
          source_type?: string | null
          source_url?: string | null
          targeted_move_in?: boolean
          targeted_move_in_note?: string | null
          timezone?: string | null
          updated_at?: string
          verification_status?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "show_public_logistics_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: true
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_series: {
        Row: {
          created_at: string
          description_short: string | null
          id: string
          industry: string | null
          is_public: boolean
          name: string
          slug: string
          typical_city: string | null
          typical_month: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_short?: string | null
          id?: string
          industry?: string | null
          is_public?: boolean
          name: string
          slug: string
          typical_city?: string | null
          typical_month?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_short?: string | null
          id?: string
          industry?: string | null
          is_public?: boolean
          name?: string
          slug?: string
          typical_city?: string | null
          typical_month?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      shows: {
        Row: {
          actual_revenue: number | null
          advance_warehouse_address: string | null
          advance_warehouse_care_of: string | null
          advance_warehouse_city: string | null
          advance_warehouse_country: string | null
          advance_warehouse_cutoff: string | null
          advance_warehouse_name: string | null
          advance_warehouse_open: string | null
          advance_warehouse_state: string | null
          advance_warehouse_street1: string | null
          advance_warehouse_street2: string | null
          advance_warehouse_window: string | null
          advance_warehouse_zip: string | null
          archived: boolean
          competitor_notes: string | null
          created_at: string
          decorator: string | null
          direct_to_show_address: string | null
          direct_to_show_care_of: string | null
          direct_to_show_city: string | null
          direct_to_show_country: string | null
          direct_to_show_end: string | null
          direct_to_show_name: string | null
          direct_to_show_start: string | null
          direct_to_show_state: string | null
          direct_to_show_street1: string | null
          direct_to_show_street2: string | null
          direct_to_show_window: string | null
          direct_to_show_zip: string | null
          edition_year: number | null
          emailed_two_weeks: boolean
          week_before_sent: boolean
          start_call_done: boolean
          estimated_revenue: number | null
          exhibitor_count: number | null
          exhibitor_list_url: string | null
          exhibitor_manual_url: string | null
          general_notes: string | null
          gsc_contact_id: string | null
          id: string
          industry_vertical: string | null
          instantly_created: boolean
          lead_gen_completion_date: string | null
          lead_gen_owner: string | null
          lead_gen_start_date: string | null
          marshalling_yard_address: string | null
          marshalling_yard_care_of: string | null
          marshalling_yard_city: string | null
          marshalling_yard_country: string | null
          marshalling_yard_cutoff: string | null
          marshalling_yard_name: string | null
          marshalling_yard_open: string | null
          marshalling_yard_state: string | null
          marshalling_yard_street1: string | null
          marshalling_yard_street2: string | null
          marshalling_yard_zip: string | null
          move_in_end: string | null
          move_in_schedule_url: string | null
          move_in_start: string | null
          move_out_end: string | null
          move_out_start: string | null
          sales_people: string | null
          series_id: string | null
          show_end_date: string | null
          show_management_company: string | null
          show_name: string
          show_start_date: string | null
          updated_at: string
          venue_id: string | null
          website_url: string | null
        }
        Insert: {
          actual_revenue?: number | null
          advance_warehouse_address?: string | null
          advance_warehouse_care_of?: string | null
          advance_warehouse_city?: string | null
          advance_warehouse_country?: string | null
          advance_warehouse_cutoff?: string | null
          advance_warehouse_name?: string | null
          advance_warehouse_open?: string | null
          advance_warehouse_state?: string | null
          advance_warehouse_street1?: string | null
          advance_warehouse_street2?: string | null
          advance_warehouse_window?: string | null
          advance_warehouse_zip?: string | null
          archived?: boolean
          competitor_notes?: string | null
          created_at?: string
          decorator?: string | null
          direct_to_show_address?: string | null
          direct_to_show_care_of?: string | null
          direct_to_show_city?: string | null
          direct_to_show_country?: string | null
          direct_to_show_end?: string | null
          direct_to_show_name?: string | null
          direct_to_show_start?: string | null
          direct_to_show_state?: string | null
          direct_to_show_street1?: string | null
          direct_to_show_street2?: string | null
          direct_to_show_window?: string | null
          direct_to_show_zip?: string | null
          edition_year?: number | null
          emailed_two_weeks?: boolean
          week_before_sent?: boolean
          start_call_done?: boolean
          estimated_revenue?: number | null
          exhibitor_count?: number | null
          exhibitor_list_url?: string | null
          exhibitor_manual_url?: string | null
          general_notes?: string | null
          gsc_contact_id?: string | null
          id?: string
          industry_vertical?: string | null
          instantly_created?: boolean
          lead_gen_completion_date?: string | null
          lead_gen_owner?: string | null
          lead_gen_start_date?: string | null
          marshalling_yard_address?: string | null
          marshalling_yard_care_of?: string | null
          marshalling_yard_city?: string | null
          marshalling_yard_country?: string | null
          marshalling_yard_cutoff?: string | null
          marshalling_yard_name?: string | null
          marshalling_yard_open?: string | null
          marshalling_yard_state?: string | null
          marshalling_yard_street1?: string | null
          marshalling_yard_street2?: string | null
          marshalling_yard_zip?: string | null
          move_in_end?: string | null
          move_in_schedule_url?: string | null
          move_in_start?: string | null
          move_out_end?: string | null
          move_out_start?: string | null
          sales_people?: string | null
          series_id?: string | null
          show_end_date?: string | null
          show_management_company?: string | null
          show_name: string
          show_start_date?: string | null
          updated_at?: string
          venue_id?: string | null
          website_url?: string | null
        }
        Update: {
          actual_revenue?: number | null
          advance_warehouse_address?: string | null
          advance_warehouse_care_of?: string | null
          advance_warehouse_city?: string | null
          advance_warehouse_country?: string | null
          advance_warehouse_cutoff?: string | null
          advance_warehouse_name?: string | null
          advance_warehouse_open?: string | null
          advance_warehouse_state?: string | null
          advance_warehouse_street1?: string | null
          advance_warehouse_street2?: string | null
          advance_warehouse_window?: string | null
          advance_warehouse_zip?: string | null
          archived?: boolean
          competitor_notes?: string | null
          created_at?: string
          decorator?: string | null
          direct_to_show_address?: string | null
          direct_to_show_care_of?: string | null
          direct_to_show_city?: string | null
          direct_to_show_country?: string | null
          direct_to_show_end?: string | null
          direct_to_show_name?: string | null
          direct_to_show_start?: string | null
          direct_to_show_state?: string | null
          direct_to_show_street1?: string | null
          direct_to_show_street2?: string | null
          direct_to_show_window?: string | null
          direct_to_show_zip?: string | null
          edition_year?: number | null
          emailed_two_weeks?: boolean
          week_before_sent?: boolean
          start_call_done?: boolean
          estimated_revenue?: number | null
          exhibitor_count?: number | null
          exhibitor_list_url?: string | null
          exhibitor_manual_url?: string | null
          general_notes?: string | null
          gsc_contact_id?: string | null
          id?: string
          industry_vertical?: string | null
          instantly_created?: boolean
          lead_gen_completion_date?: string | null
          lead_gen_owner?: string | null
          lead_gen_start_date?: string | null
          marshalling_yard_address?: string | null
          marshalling_yard_care_of?: string | null
          marshalling_yard_city?: string | null
          marshalling_yard_country?: string | null
          marshalling_yard_cutoff?: string | null
          marshalling_yard_name?: string | null
          marshalling_yard_open?: string | null
          marshalling_yard_state?: string | null
          marshalling_yard_street1?: string | null
          marshalling_yard_street2?: string | null
          marshalling_yard_zip?: string | null
          move_in_end?: string | null
          move_in_schedule_url?: string | null
          move_in_start?: string | null
          move_out_end?: string | null
          move_out_start?: string | null
          sales_people?: string | null
          series_id?: string | null
          show_end_date?: string | null
          show_management_company?: string | null
          show_name?: string
          show_start_date?: string | null
          updated_at?: string
          venue_id?: string | null
          website_url?: string | null
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
          tms_customer_id: string | null
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
          tms_customer_id?: string | null
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
          tms_customer_id?: string | null
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
          public_slug: string | null
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
          public_slug?: string | null
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
          public_slug?: string | null
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
      carrier_shipment_stats: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          carrier_id: string
          shipment_count: number
        }[]
      }
      exhibitor_shipment_stats: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          exhibitor_id: string
          load_count: number
          show_ids: string[]
        }[]
      }
      issue_rebate_statement: {
        Args: {
          p_commission_basis: string | null
          p_lines: Json
          p_partner_id: string
          p_period_end: string
          p_period_start: string
          p_quarter: string
          p_rebate_pct: number
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      merge_shows: {
        Args: { p_source: string; p_target: string }
        Returns: undefined
      }
      merge_venues: {
        Args: { p_source: string; p_target: string }
        Returns: undefined
      }
      shipment_ar_status: {
        Args: { p_shipment_ids: string[] }
        Returns: {
          ar_status: string
          invoice_nos: string[]
          invoiced: number | null
          open_balance: number | null
          paid_on: string | null
          shipment_id: string
        }[]
      }
      show_status: {
        Args: { s: Database["public"]["Tables"]["shows"]["Row"] }
        Returns: Database["public"]["Enums"]["show_status"]
      }
      venue_shipment_stats: {
        Args: never
        Returns: {
          load_count: number
          venue_id: string
        }[]
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
        | "MHA"
      forced_reason:
        | "carrier_no_show"
        | "paperwork_error"
        | "missed_check_in"
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
        "MHA",
      ],
      forced_reason: [
        "carrier_no_show",
        "paperwork_error",
        "missed_check_in",
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
