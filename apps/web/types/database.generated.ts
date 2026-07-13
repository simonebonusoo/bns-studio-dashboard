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
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          attendee_ids: string[] | null
          client_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          end_at: string
          id: string
          location: string | null
          meeting_link: string | null
          organization_id: string
          project_id: string | null
          reminder_minutes: number | null
          start_at: string
          title: string
          type: string | null
          updated_at: string
          visibility: string | null
        }
        Insert: {
          all_day?: boolean | null
          attendee_ids?: string[] | null
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_at: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          organization_id: string
          project_id?: string | null
          reminder_minutes?: number | null
          start_at: string
          title: string
          type?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          all_day?: boolean | null
          attendee_ids?: string[] | null
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_at?: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          organization_id?: string
          project_id?: string | null
          reminder_minutes?: number | null
          start_at?: string
          title?: string
          type?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          company_id: string | null
          company_name: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          email: string | null
          first_name: string | null
          id: string
          last_contact_at: string | null
          last_name: string | null
          next_contact_at: string | null
          notes: string | null
          organization_id: string
          owner_id: string | null
          phone: string | null
          priority: string
          province: string | null
          sector: string | null
          source: string | null
          status: Database["public"]["Enums"]["client_status"]
          tags: string[] | null
          tax_code: string | null
          type: string
          updated_at: string
          vat: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_contact_at?: string | null
          last_name?: string | null
          next_contact_at?: string | null
          notes?: string | null
          organization_id: string
          owner_id?: string | null
          phone?: string | null
          priority?: string
          province?: string | null
          sector?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tags?: string[] | null
          tax_code?: string | null
          type?: string
          updated_at?: string
          vat?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_contact_at?: string | null
          last_name?: string | null
          next_contact_at?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string | null
          phone?: string | null
          priority?: string
          province?: string | null
          sector?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tags?: string[] | null
          tax_code?: string | null
          type?: string
          updated_at?: string
          vat?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          deleted_at: string | null
          edited: boolean | null
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          updated_at: string
          visibility: string | null
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          deleted_at?: string | null
          edited?: boolean | null
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          edited?: boolean | null
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          sector: string | null
          size: string | null
          updated_at: string
          vat: string | null
          website: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          sector?: string | null
          size?: string | null
          updated_at?: string
          vat?: string | null
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          sector?: string | null
          size?: string | null
          updated_at?: string
          vat?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_id: string | null
          created_at: string
          deleted_at: string | null
          end_date: string | null
          estimate_id: string | null
          id: string
          included_revisions: number | null
          notes: string | null
          number: string
          organization_id: string
          payment_terms: string | null
          pdf_name: string | null
          pdf_url: string | null
          project_id: string | null
          signed_by_client: boolean | null
          signed_by_studio: boolean | null
          start_date: string | null
          status: string | null
          terms: string | null
          title: string
          type: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          estimate_id?: string | null
          id?: string
          included_revisions?: number | null
          notes?: string | null
          number: string
          organization_id: string
          payment_terms?: string | null
          pdf_name?: string | null
          pdf_url?: string | null
          project_id?: string | null
          signed_by_client?: boolean | null
          signed_by_studio?: boolean | null
          start_date?: string | null
          status?: string | null
          terms?: string | null
          title: string
          type?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          estimate_id?: string | null
          id?: string
          included_revisions?: number | null
          notes?: string | null
          number?: string
          organization_id?: string
          payment_terms?: string | null
          pdf_name?: string | null
          pdf_url?: string | null
          project_id?: string | null
          signed_by_client?: boolean | null
          signed_by_studio?: boolean | null
          start_date?: string | null
          status?: string | null
          terms?: string | null
          title?: string
          type?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          author_id: string | null
          client_id: string | null
          content: string | null
          created_at: string
          deleted_at: string | null
          id: string
          organization_id: string
          project_id: string | null
          tags: string[] | null
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          client_id?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id: string
          project_id?: string | null
          tags?: string[] | null
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          client_id?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id?: string
          project_id?: string | null
          tags?: string[] | null
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          accepted_at: string | null
          client_id: string | null
          created_at: string
          currency: string | null
          deleted_at: string | null
          deposit_pct: number | null
          expiry_date: string | null
          global_discount_pct: number | null
          id: string
          issue_date: string
          items: Json
          notes: string | null
          number: string
          opportunity_id: string | null
          organization_id: string
          rejected_reason: string | null
          status: string
          terms: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          accepted_at?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          deposit_pct?: number | null
          expiry_date?: string | null
          global_discount_pct?: number | null
          id?: string
          issue_date: string
          items?: Json
          notes?: string | null
          number: string
          opportunity_id?: string | null
          organization_id: string
          rejected_reason?: string | null
          status?: string
          terms?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          accepted_at?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          deposit_pct?: number | null
          expiry_date?: string | null
          global_discount_pct?: number | null
          id?: string
          issue_date?: string
          items?: Json
          notes?: string | null
          number?: string
          opportunity_id?: string | null
          organization_id?: string
          rejected_reason?: string | null
          status?: string
          terms?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          client_id: string | null
          client_visible: boolean | null
          created_at: string
          deleted_at: string | null
          folder: string | null
          id: string
          mime: string | null
          name: string
          organization_id: string
          project_id: string | null
          size: number | null
          storage_path: string | null
          tags: string[] | null
          task_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          client_id?: string | null
          client_visible?: boolean | null
          created_at?: string
          deleted_at?: string | null
          folder?: string | null
          id?: string
          mime?: string | null
          name: string
          organization_id: string
          project_id?: string | null
          size?: number | null
          storage_path?: string | null
          tags?: string[] | null
          task_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string | null
          client_visible?: boolean | null
          created_at?: string
          deleted_at?: string | null
          folder?: string | null
          id?: string
          mime?: string | null
          name?: string
          organization_id?: string
          project_id?: string | null
          size?: number | null
          storage_path?: string | null
          tags?: string[] | null
          task_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string | null
          created_at: string
          currency: string | null
          deleted_at: string | null
          due_date: string | null
          estimate_id: string | null
          global_discount_pct: number | null
          id: string
          issue_date: string
          items: Json
          notes: string | null
          number: string
          organization_id: string
          payment_method: string | null
          project_id: string | null
          status: string
          updated_at: string
          withholding_pct: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          due_date?: string | null
          estimate_id?: string | null
          global_discount_pct?: number | null
          id?: string
          issue_date: string
          items?: Json
          notes?: string | null
          number: string
          organization_id: string
          payment_method?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          withholding_pct?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          due_date?: string | null
          estimate_id?: string | null
          global_discount_pct?: number | null
          id?: string
          issue_date?: string
          items?: Json
          notes?: string | null
          number?: string
          organization_id?: string
          payment_method?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          withholding_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      markdown_imports: {
        Row: {
          candidate_count: number
          created_at: string
          created_by: string | null
          created_count: number
          deleted_at: string | null
          failed_count: number
          file_names: Json
          files_count: number
          id: string
          organization_id: string
          skipped_count: number
          status: string
          summary: Json
          updated_at: string
          updated_count: number
        }
        Insert: {
          candidate_count?: number
          created_at?: string
          created_by?: string | null
          created_count?: number
          deleted_at?: string | null
          failed_count?: number
          file_names?: Json
          files_count?: number
          id?: string
          organization_id: string
          skipped_count?: number
          status?: string
          summary?: Json
          updated_at?: string
          updated_count?: number
        }
        Update: {
          candidate_count?: number
          created_at?: string
          created_by?: string | null
          created_count?: number
          deleted_at?: string | null
          failed_count?: number
          file_names?: Json
          files_count?: number
          id?: string
          organization_id?: string
          skipped_count?: number
          status?: string
          summary?: Json
          updated_at?: string
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "markdown_imports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markdown_imports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          avatar_color: string | null
          client_rate: number | null
          collaboration_type: string | null
          created_at: string
          deleted_at: string | null
          email: string
          first_name: string
          id: string
          internal_rate: number | null
          job_title: string | null
          joined_at: string | null
          last_name: string
          organization_id: string
          profile_id: string | null
          role: Database["public"]["Enums"]["member_role"]
          skills: string[] | null
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          weekly_hours: number | null
        }
        Insert: {
          avatar_color?: string | null
          client_rate?: number | null
          collaboration_type?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          first_name: string
          id?: string
          internal_rate?: number | null
          job_title?: string | null
          joined_at?: string | null
          last_name: string
          organization_id: string
          profile_id?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          skills?: string[] | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          weekly_hours?: number | null
        }
        Update: {
          avatar_color?: string | null
          client_rate?: number | null
          collaboration_type?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          first_name?: string
          id?: string
          internal_rate?: number | null
          job_title?: string | null
          joined_at?: string | null
          last_name?: string
          organization_id?: string
          profile_id?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          skills?: string[] | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          weekly_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          client_visible: boolean | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          order: number | null
          organization_id: string
          project_id: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_visible?: boolean | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          order?: number | null
          organization_id: string
          project_id: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_visible?: boolean | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          order?: number | null
          organization_id?: string
          project_id?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          organization_id: string
          read: boolean | null
          title: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id: string
          read?: boolean | null
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id?: string
          read?: boolean | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          client_id: string | null
          company_id: string | null
          contact_name: string | null
          created_at: string
          deleted_at: string | null
          expected_close_date: string | null
          id: string
          lost_reason: string | null
          next_follow_up_at: string | null
          notes: string | null
          order: number | null
          organization_id: string
          owner_id: string | null
          priority: string | null
          probability: number
          service_id: string | null
          source: string | null
          stage: string
          tags: string[] | null
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          client_id?: string | null
          company_id?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          order?: number | null
          organization_id: string
          owner_id?: string | null
          priority?: string | null
          probability?: number
          service_id?: string | null
          source?: string | null
          stage?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          value?: number
        }
        Update: {
          client_id?: string | null
          company_id?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          order?: number | null
          organization_id?: string
          owner_id?: string | null
          priority?: string | null
          probability?: number
          service_id?: string | null
          source?: string | null
          stage?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          currency: string
          email: string | null
          id: string
          locale: string
          name: string
          slug: string
          timezone: string
          updated_at: string
          vat: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          locale?: string
          name: string
          slug: string
          timezone?: string
          updated_at?: string
          vat?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          locale?: string
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
          vat?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          currency: string | null
          date: string
          deleted_at: string | null
          id: string
          invoice_id: string | null
          method: string | null
          notes: string | null
          organization_id: string
          project_id: string | null
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          currency?: string | null
          date: string
          deleted_at?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          notes?: string | null
          organization_id: string
          project_id?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          currency?: string | null
          date?: string
          deleted_at?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          notes?: string | null
          organization_id?: string
          project_id?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
        }
        Insert: {
          avatar_color?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
        }
        Update: {
          avatar_color?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget: number | null
          client_id: string | null
          code: string
          color: string | null
          company_id: string | null
          completed_at: string | null
          contract_value: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          health: string | null
          id: string
          manager_id: string | null
          member_ids: string[] | null
          name: string
          organization_id: string
          priority: string | null
          progress: number | null
          service_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          tags: string[] | null
          target_margin: number | null
          updated_at: string
        }
        Insert: {
          budget?: number | null
          client_id?: string | null
          code: string
          color?: string | null
          company_id?: string | null
          completed_at?: string | null
          contract_value?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          health?: string | null
          id?: string
          manager_id?: string | null
          member_ids?: string[] | null
          name: string
          organization_id: string
          priority?: string | null
          progress?: number | null
          service_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tags?: string[] | null
          target_margin?: number | null
          updated_at?: string
        }
        Update: {
          budget?: number | null
          client_id?: string | null
          code?: string
          color?: string | null
          company_id?: string | null
          completed_at?: string | null
          contract_value?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          health?: string | null
          id?: string
          manager_id?: string | null
          member_ids?: string[] | null
          name?: string
          organization_id?: string
          priority?: string | null
          progress?: number | null
          service_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tags?: string[] | null
          target_margin?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean | null
          base_price: number | null
          category: string | null
          color: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          internal_cost: number | null
          name: string
          organization_id: string
          price_unit: string | null
          target_margin: number | null
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          active?: boolean | null
          base_price?: number | null
          category?: string | null
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          internal_cost?: number | null
          name: string
          organization_id: string
          price_unit?: string | null
          target_margin?: number | null
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          active?: boolean | null
          base_price?: number | null
          category?: string | null
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          internal_cost?: number | null
          name?: string
          organization_id?: string
          price_unit?: string | null
          target_margin?: number | null
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_ids: string[] | null
          checklist: Json | null
          client_visible: boolean | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          milestone_id: string | null
          order: number | null
          organization_id: string
          parent_task_id: string | null
          priority: string | null
          project_id: string
          start_date: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_ids?: string[] | null
          checklist?: Json | null
          client_visible?: boolean | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          milestone_id?: string | null
          order?: number | null
          organization_id: string
          parent_task_id?: string | null
          priority?: string | null
          project_id: string
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_ids?: string[] | null
          checklist?: Json | null
          client_visible?: boolean | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          milestone_id?: string | null
          order?: number | null
          organization_id?: string
          parent_task_id?: string | null
          priority?: string | null
          project_id?: string
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          approved: boolean | null
          billable: boolean | null
          client_id: string | null
          created_at: string
          date: string
          deleted_at: string | null
          description: string | null
          duration_minutes: number
          hourly_rate: number | null
          id: string
          internal_cost: number | null
          member_id: string
          organization_id: string
          project_id: string | null
          running: boolean | null
          started_at: string | null
          task_id: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean | null
          billable?: boolean | null
          client_id?: string | null
          created_at?: string
          date: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number
          hourly_rate?: number | null
          id?: string
          internal_cost?: number | null
          member_id: string
          organization_id: string
          project_id?: string | null
          running?: boolean | null
          started_at?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean | null
          billable?: boolean | null
          client_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number
          hourly_rate?: number | null
          id?: string
          internal_cost?: number | null
          member_id?: string
          organization_id?: string
          project_id?: string | null
          running?: boolean | null
          started_at?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          client_id: string | null
          created_at: string
          currency: string | null
          date: string
          deleted_at: string | null
          description: string | null
          id: string
          method: string | null
          notes: string | null
          organization_id: string
          project_id: string | null
          type: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          date: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          organization_id: string
          project_id?: string | null
          type: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          date?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          organization_id?: string
          project_id?: string | null
          type?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_available: { Args: { p_org_slug?: string }; Returns: boolean }
      bootstrap_owner: {
        Args: {
          p_first_name?: string
          p_last_name?: string
          p_org_name?: string
          p_org_slug?: string
        }
        Returns: string
      }
      can_finance: { Args: { org: string }; Returns: boolean }
      is_internal_org_member: { Args: { org: string }; Returns: boolean }
      is_org_member: { Args: { org: string }; Returns: boolean }
      org_role: {
        Args: { org: string }
        Returns: Database["public"]["Enums"]["member_role"]
      }
    }
    Enums: {
      client_status:
        | "lead"
        | "prospect"
        | "active"
        | "inactive"
        | "past_client"
        | "partner"
        | "archived"
      member_role:
        | "owner"
        | "admin"
        | "project_manager"
        | "designer"
        | "developer"
        | "collaborator"
        | "accountant"
        | "client"
      member_status:
        | "invited"
        | "active"
        | "unavailable"
        | "suspended"
        | "inactive"
      project_status:
        | "lead"
        | "draft"
        | "planned"
        | "active"
        | "waiting_client"
        | "review"
        | "paused"
        | "completed"
        | "cancelled"
        | "archived"
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
      client_status: [
        "lead",
        "prospect",
        "active",
        "inactive",
        "past_client",
        "partner",
        "archived",
      ],
      member_role: [
        "owner",
        "admin",
        "project_manager",
        "designer",
        "developer",
        "collaborator",
        "accountant",
        "client",
      ],
      member_status: [
        "invited",
        "active",
        "unavailable",
        "suspended",
        "inactive",
      ],
      project_status: [
        "lead",
        "draft",
        "planned",
        "active",
        "waiting_client",
        "review",
        "paused",
        "completed",
        "cancelled",
        "archived",
      ],
    },
  },
} as const
