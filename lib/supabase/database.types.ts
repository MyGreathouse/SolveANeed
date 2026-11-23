
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "agreement_milestones": {
                  Row: {
                    "acceptance_criteria": string,"agreement_id": string,"amount_minor": number,"currency": string,"decided_at": string | null,"decided_by": string | null,"due_date": string | null,"evidence_submitted_at": string | null,"id": string,"position": number,"status": Database["public"]['Enums']["milestone_status"],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acceptance_criteria": string,"agreement_id": string,"amount_minor": number,"currency": string,"decided_at"?: string | null,"decided_by"?: string | null,"due_date"?: string | null,"evidence_submitted_at"?: string | null,"id"?: string,"position": number,"status"?: Database["public"]['Enums']["milestone_status"],"title": string
                  }
                  Update: {
                    "acceptance_criteria"?: string,"agreement_id"?: string,"amount_minor"?: number,"currency"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"due_date"?: string | null,"evidence_submitted_at"?: string | null,"id"?: string,"position"?: number,"status"?: Database["public"]['Enums']["milestone_status"],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agreement_milestones_agreement_id_fkey"
      columns: ["agreement_id"]
isOneToOne: false
      referencedRelation: "agreements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agreement_milestones_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "agreement_milestones_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"agreements": {
                  Row: {
                    "agreement_type": Database["public"]['Enums']["support_type"],"amount_minor": number,"created_at": string,"currency": string,"id": string,"offer_id": string,"offer_version_id": string,"platform_fee_bps": number,"requester_id": string,"status": Database["public"]['Enums']["agreement_status"],"supporter_id": string,"terms_sha256": string,"terms_snapshot": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agreement_type": Database["public"]['Enums']["support_type"],"amount_minor": number,"created_at"?: string,"currency": string,"id"?: string,"offer_id": string,"offer_version_id": string,"platform_fee_bps"?: number,"requester_id": string,"status"?: Database["public"]['Enums']["agreement_status"],"supporter_id": string,"terms_sha256": string,"terms_snapshot": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "agreement_type"?: Database["public"]['Enums']["support_type"],"amount_minor"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"offer_id"?: string,"offer_version_id"?: string,"platform_fee_bps"?: number,"requester_id"?: string,"status"?: Database["public"]['Enums']["agreement_status"],"supporter_id"?: string,"terms_sha256"?: string,"terms_snapshot"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agreements_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "agreements_offer_id_fkey"
      columns: ["offer_id"]
isOneToOne: true
      referencedRelation: "offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agreements_offer_version_id_fkey"
      columns: ["offer_version_id"]
isOneToOne: false
      referencedRelation: "offer_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agreements_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agreements_supporter_id_fkey"
      columns: ["supporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_events": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": number,"metadata": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: never,"metadata"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"metadata"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"contributions": {
                  Row: {
                    "amount_minor": number,"created_at": string,"currency": string,"id": string,"is_anonymous": boolean,"need_id": string,"payment_transaction_id": string | null,"status": Database["public"]['Enums']["payment_status"],"supporter_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"currency": string,"id"?: string,"is_anonymous"?: boolean,"need_id": string,"payment_transaction_id"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"supporter_id"?: string | null
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"is_anonymous"?: boolean,"need_id"?: string,"payment_transaction_id"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"supporter_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contributions_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "contributions_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contributions_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contributions_payment_transaction_id_fkey"
      columns: ["payment_transaction_id"]
isOneToOne: false
      referencedRelation: "payment_transactions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contributions_supporter_id_fkey"
      columns: ["supporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "blocked_by": string | null,"created_at": string,"id": string,"need_id": string | null,"offer_id": string | null,"requester_id": string,"supporter_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_by"?: string | null,"created_at"?: string,"id"?: string,"need_id"?: string | null,"offer_id"?: string | null,"requester_id": string,"supporter_id": string
                  }
                  Update: {
                    "blocked_by"?: string | null,"created_at"?: string,"id"?: string,"need_id"?: string | null,"offer_id"?: string | null,"requester_id"?: string,"supporter_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_blocked_by_fkey"
      columns: ["blocked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_offer_id_fkey"
      columns: ["offer_id"]
isOneToOne: true
      referencedRelation: "offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_supporter_id_fkey"
      columns: ["supporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"currencies": {
                  Row: {
                    "code": string,"created_at": string,"enabled": boolean,"max_need_minor": number,"min_need_minor": number,"minor_unit": number,"name": string,"sort_order": number,"symbol": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"enabled"?: boolean,"max_need_minor": number,"min_need_minor": number,"minor_unit": number,"name": string,"sort_order"?: number,"symbol": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"enabled"?: boolean,"max_need_minor"?: number,"min_need_minor"?: number,"minor_unit"?: number,"name"?: string,"sort_order"?: number,"symbol"?: string
                  }
                  Relationships: [
                    
                  ]
                },"dispute_evidence": {
                  Row: {
                    "created_at": string,"description": string,"dispute_id": string,"id": string,"storage_path": string | null,"submitted_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"dispute_id": string,"id"?: string,"storage_path"?: string | null,"submitted_by": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"dispute_id"?: string,"id"?: string,"storage_path"?: string | null,"submitted_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dispute_evidence_dispute_id_fkey"
      columns: ["dispute_id"]
isOneToOne: false
      referencedRelation: "disputes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispute_evidence_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"disputes": {
                  Row: {
                    "agreement_id": string,"id": string,"opened_at": string,"opened_by": string,"reason": string,"resolution": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["dispute_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "agreement_id": string,"id"?: string,"opened_at"?: string,"opened_by": string,"reason": string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["dispute_status"]
                  }
                  Update: {
                    "agreement_id"?: string,"id"?: string,"opened_at"?: string,"opened_by"?: string,"reason"?: string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["dispute_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "disputes_agreement_id_fkey"
      columns: ["agreement_id"]
isOneToOne: false
      referencedRelation: "agreements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_opened_by_fkey"
      columns: ["opened_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"evidence_access_grants": {
                  Row: {
                    "created_at": string,"evidence_id": string,"expires_at": string,"id": string,"storage_path": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"evidence_id": string,"expires_at": string,"id"?: string,"storage_path": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"evidence_id"?: string,"expires_at"?: string,"id"?: string,"storage_path"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evidence_access_grants_evidence_id_fkey"
      columns: ["evidence_id"]
isOneToOne: false
      referencedRelation: "need_evidence"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evidence_access_grants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string,"conversation_id": string,"created_at": string,"id": string,"read_at": string | null,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"conversation_id": string,"created_at"?: string,"id"?: string,"read_at"?: string | null,"sender_id": string
                  }
                  Update: {
                    "body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"read_at"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_actions": {
                  Row: {
                    "action": string,"created_at": string,"id": string,"moderator_id": string | null,"note": string | null,"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"id"?: string,"moderator_id"?: string | null,"note"?: string | null,"target_id": string,"target_type": string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"id"?: string,"moderator_id"?: string | null,"note"?: string | null,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_actions_moderator_id_fkey"
      columns: ["moderator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"need_categories": {
                  Row: {
                    "active": boolean,"description": string,"label": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"description": string,"label": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"description"?: string,"label"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"need_evidence": {
                  Row: {
                    "created_at": string,"file_name": string,"id": string,"mime_type": string,"need_id": string,"owner_id": string,"size_bytes": number,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_name": string,"id"?: string,"mime_type": string,"need_id": string,"owner_id": string,"size_bytes": number,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"file_name"?: string,"id"?: string,"mime_type"?: string,"need_id"?: string,"owner_id"?: string,"size_bytes"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "need_evidence_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "need_evidence_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "need_evidence_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"needs": {
                  Row: {
                    "accepted_support_types": (Database["public"]['Enums']["support_type"])[],"amount_minor": number | null,"category_slug": string,"closed_at": string | null,"created_at": string,"currency": string,"deadline": string | null,"description": string,"evidence_reviewed_at": string | null,"funded_minor": number,"funding_basis_points": number | null,"id": string,"intended_use": string | null,"moderation_note": string | null,"outcome_confirmed_at": string | null,"published_at": string | null,"region": string | null,"requester_id": string,"search": unknown,"show_requester_name": boolean,"status": Database["public"]['Enums']["need_status"],"submitted_at": string | null,"title": string,"updated_at": string,"visibility": Database["public"]['Enums']["need_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_support_types"?: (Database["public"]['Enums']["support_type"])[],"amount_minor"?: number | null,"category_slug": string,"closed_at"?: string | null,"created_at"?: string,"currency"?: string,"deadline"?: string | null,"description"?: string,"evidence_reviewed_at"?: string | null,"funded_minor"?: number,"funding_basis_points"?: never,"id"?: string,"intended_use"?: string | null,"moderation_note"?: string | null,"outcome_confirmed_at"?: string | null,"published_at"?: string | null,"region"?: string | null,"requester_id": string,"search"?: never,"show_requester_name"?: boolean,"status"?: Database["public"]['Enums']["need_status"],"submitted_at"?: string | null,"title": string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["need_visibility"]
                  }
                  Update: {
                    "accepted_support_types"?: (Database["public"]['Enums']["support_type"])[],"amount_minor"?: number | null,"category_slug"?: string,"closed_at"?: string | null,"created_at"?: string,"currency"?: string,"deadline"?: string | null,"description"?: string,"evidence_reviewed_at"?: string | null,"funded_minor"?: number,"funding_basis_points"?: never,"id"?: string,"intended_use"?: string | null,"moderation_note"?: string | null,"outcome_confirmed_at"?: string | null,"published_at"?: string | null,"region"?: string | null,"requester_id"?: string,"search"?: never,"show_requester_name"?: boolean,"status"?: Database["public"]['Enums']["need_status"],"submitted_at"?: string | null,"title"?: string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["need_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "needs_category_slug_fkey"
      columns: ["category_slug"]
isOneToOne: false
      referencedRelation: "need_categories"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "needs_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "needs_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"link_path": string | null,"read_at": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"link_path"?: string | null,"read_at"?: string | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"link_path"?: string | null,"read_at"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"offer_versions": {
                  Row: {
                    "amount_minor": number,"created_at": string,"currency": string,"id": string,"offer_id": string,"proposed_by": string,"terms": NonNullable<Json>,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"currency": string,"id"?: string,"offer_id": string,"proposed_by": string,"terms": NonNullable<Json>,"version": number
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"offer_id"?: string,"proposed_by"?: string,"terms"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "offer_versions_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "offer_versions_offer_id_fkey"
      columns: ["offer_id"]
isOneToOne: false
      referencedRelation: "offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_versions_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"offers": {
                  Row: {
                    "accepted_at": string | null,"accepted_version": number | null,"amount_minor": number,"created_at": string,"currency": string,"current_version": number,"expires_at": string | null,"id": string,"need_id": string,"offer_type": Database["public"]['Enums']["support_type"],"organisation_id": string | null,"requester_id": string,"status": Database["public"]['Enums']["offer_status"],"supporter_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_version"?: number | null,"amount_minor": number,"created_at"?: string,"currency": string,"current_version"?: number,"expires_at"?: string | null,"id"?: string,"need_id": string,"offer_type": Database["public"]['Enums']["support_type"],"organisation_id"?: string | null,"requester_id": string,"status"?: Database["public"]['Enums']["offer_status"],"supporter_id": string,"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_version"?: number | null,"amount_minor"?: number,"created_at"?: string,"currency"?: string,"current_version"?: number,"expires_at"?: string | null,"id"?: string,"need_id"?: string,"offer_type"?: Database["public"]['Enums']["support_type"],"organisation_id"?: string | null,"requester_id"?: string,"status"?: Database["public"]['Enums']["offer_status"],"supporter_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offers_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "offers_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_organisation_id_fkey"
      columns: ["organisation_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_supporter_id_fkey"
      columns: ["supporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organisation_members": {
                  Row: {
                    "created_at": string,"member_role": string,"organisation_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"member_role": string,"organisation_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"member_role"?: string,"organisation_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organisation_members_organisation_id_fkey"
      columns: ["organisation_id"]
isOneToOne: false
      referencedRelation: "organisations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organisation_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organisations": {
                  Row: {
                    "country_code": string,"created_at": string,"created_by": string | null,"id": string,"name": string,"registration_number": string | null,"verified_at": string | null,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "country_code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"registration_number"?: string | null,"verified_at"?: string | null,"website"?: string | null
                  }
                  Update: {
                    "country_code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"registration_number"?: string | null,"verified_at"?: string | null,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "organisations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_transactions": {
                  Row: {
                    "agreement_id": string | null,"amount_minor": number,"created_at": string,"currency": string,"fee_minor": number,"id": string,"idempotency_key": string,"kind": string,"livemode": boolean,"need_id": string | null,"payee_id": string | null,"payer_id": string | null,"provider": string,"provider_ref": string | null,"status": Database["public"]['Enums']["payment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agreement_id"?: string | null,"amount_minor": number,"created_at"?: string,"currency": string,"fee_minor"?: number,"id"?: string,"idempotency_key": string,"kind": string,"livemode"?: boolean,"need_id"?: string | null,"payee_id"?: string | null,"payer_id"?: string | null,"provider": string,"provider_ref"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Update: {
                    "agreement_id"?: string | null,"amount_minor"?: number,"created_at"?: string,"currency"?: string,"fee_minor"?: number,"id"?: string,"idempotency_key"?: string,"kind"?: string,"livemode"?: boolean,"need_id"?: string | null,"payee_id"?: string | null,"payer_id"?: string | null,"provider"?: string,"provider_ref"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_transactions_agreement_id_fkey"
      columns: ["agreement_id"]
isOneToOne: false
      referencedRelation: "agreements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_transactions_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "payment_transactions_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_transactions_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_transactions_payee_id_fkey"
      columns: ["payee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_transactions_payer_id_fkey"
      columns: ["payer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payouts": {
                  Row: {
                    "agreement_id": string | null,"amount_minor": number,"approved_at": string | null,"approved_by": string | null,"created_at": string,"currency": string,"id": string,"idempotency_key": string,"milestone_id": string | null,"provider_ref": string | null,"recipient_id": string,"status": Database["public"]['Enums']["payout_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "agreement_id"?: string | null,"amount_minor": number,"approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"currency": string,"id"?: string,"idempotency_key": string,"milestone_id"?: string | null,"provider_ref"?: string | null,"recipient_id": string,"status"?: Database["public"]['Enums']["payout_status"]
                  }
                  Update: {
                    "agreement_id"?: string | null,"amount_minor"?: number,"approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"idempotency_key"?: string,"milestone_id"?: string | null,"provider_ref"?: string | null,"recipient_id"?: string,"status"?: Database["public"]['Enums']["payout_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "payouts_agreement_id_fkey"
      columns: ["agreement_id"]
isOneToOne: false
      referencedRelation: "agreements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payouts_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payouts_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "payouts_milestone_id_fkey"
      columns: ["milestone_id"]
isOneToOne: false
      referencedRelation: "agreement_milestones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payouts_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_settings": {
                  Row: {
                    "key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "account_status": Database["public"]['Enums']["account_status"],"age_confirmed_at": string,"bio": string | null,"created_at": string,"deletion_requested_at": string | null,"display_name": string,"id": string,"identity_verified_at": string | null,"notify_email_messages": boolean,"notify_email_offers": boolean,"notify_email_updates": boolean,"notify_marketing": boolean,"preferred_currency": string,"region": string | null,"show_region": boolean,"terms_accepted_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_status"?: Database["public"]['Enums']["account_status"],"age_confirmed_at": string,"bio"?: string | null,"created_at"?: string,"deletion_requested_at"?: string | null,"display_name": string,"id": string,"identity_verified_at"?: string | null,"notify_email_messages"?: boolean,"notify_email_offers"?: boolean,"notify_email_updates"?: boolean,"notify_marketing"?: boolean,"preferred_currency"?: string,"region"?: string | null,"show_region"?: boolean,"terms_accepted_at": string,"updated_at"?: string
                  }
                  Update: {
                    "account_status"?: Database["public"]['Enums']["account_status"],"age_confirmed_at"?: string,"bio"?: string | null,"created_at"?: string,"deletion_requested_at"?: string | null,"display_name"?: string,"id"?: string,"identity_verified_at"?: string | null,"notify_email_messages"?: boolean,"notify_email_offers"?: boolean,"notify_email_updates"?: boolean,"notify_marketing"?: boolean,"preferred_currency"?: string,"region"?: string | null,"show_region"?: boolean,"terms_accepted_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_preferred_currency_fkey"
      columns: ["preferred_currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                },"provider_events": {
                  Row: {
                    "event_id": string,"event_type": string,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"processing_error": string | null,"provider": string,"received_at": string,"signature_verified": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"event_type": string,"id"?: string,"payload": NonNullable<Json>,"processed_at"?: string | null,"processing_error"?: string | null,"provider": string,"received_at"?: string,"signature_verified": boolean
                  }
                  Update: {
                    "event_id"?: string,"event_type"?: string,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"processing_error"?: string | null,"provider"?: string,"received_at"?: string,"signature_verified"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"rate_limit_rules": {
                  Row: {
                    "action": string,"max_hits": number,"scope": string,"window_seconds": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"max_hits": number,"scope": string,"window_seconds": number
                  }
                  Update: {
                    "action"?: string,"max_hits"?: number,"scope"?: string,"window_seconds"?: number
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "hits": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "hits"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "hits"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"refunds": {
                  Row: {
                    "amount_minor": number,"created_at": string,"currency": string,"id": string,"idempotency_key": string,"payment_transaction_id": string,"provider_ref": string | null,"reason": string,"requested_by": string | null,"status": Database["public"]['Enums']["refund_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"currency": string,"id"?: string,"idempotency_key": string,"payment_transaction_id": string,"provider_ref"?: string | null,"reason": string,"requested_by"?: string | null,"status"?: Database["public"]['Enums']["refund_status"]
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"idempotency_key"?: string,"payment_transaction_id"?: string,"provider_ref"?: string | null,"reason"?: string,"requested_by"?: string | null,"status"?: Database["public"]['Enums']["refund_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "refunds_payment_transaction_id_fkey"
      columns: ["payment_transaction_id"]
isOneToOne: false
      referencedRelation: "payment_transactions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"details": string | null,"id": string,"reason": Database["public"]['Enums']["report_reason"],"reporter_id": string | null,"resolution": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason": Database["public"]['Enums']["report_reason"],"reporter_id"?: string | null,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason"?: Database["public"]['Enums']["report_reason"],"reporter_id"?: string | null,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"risk_signals": {
                  Row: {
                    "created_at": string,"detail": NonNullable<Json>,"entity_id": string,"entity_type": string,"id": string,"reviewed_at": string | null,"reviewed_by": string | null,"signal": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"detail"?: NonNullable<Json>,"entity_id": string,"entity_type": string,"id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"signal": string
                  }
                  Update: {
                    "created_at"?: string,"detail"?: NonNullable<Json>,"entity_id"?: string,"entity_type"?: string,"id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"signal"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "risk_signals_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_needs": {
                  Row: {
                    "created_at": string,"need_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"need_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"need_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_needs_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_needs_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_needs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"support_preferences": {
                  Row: {
                    "categories": (string)[],"currency": string | null,"max_amount_minor": number | null,"open_to_paid_tasks": boolean,"regions": (string)[],"support_types": (Database["public"]['Enums']["support_type"])[],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "categories"?: (string)[],"currency"?: string | null,"max_amount_minor"?: number | null,"open_to_paid_tasks"?: boolean,"regions"?: (string)[],"support_types"?: (Database["public"]['Enums']["support_type"])[],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "categories"?: (string)[],"currency"?: string | null,"max_amount_minor"?: number | null,"open_to_paid_tasks"?: boolean,"regions"?: (string)[],"support_types"?: (Database["public"]['Enums']["support_type"])[],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_preferences_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "support_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"task_deliverables": {
                  Row: {
                    "agreement_id": string,"description": string,"id": string,"review_note": string | null,"review_status": string,"reviewed_at": string | null,"storage_path": string | null,"submitted_at": string,"submitted_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agreement_id": string,"description": string,"id"?: string,"review_note"?: string | null,"review_status"?: string,"reviewed_at"?: string | null,"storage_path"?: string | null,"submitted_at"?: string,"submitted_by": string
                  }
                  Update: {
                    "agreement_id"?: string,"description"?: string,"id"?: string,"review_note"?: string | null,"review_status"?: string,"reviewed_at"?: string | null,"storage_path"?: string | null,"submitted_at"?: string,"submitted_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_deliverables_agreement_id_fkey"
      columns: ["agreement_id"]
isOneToOne: false
      referencedRelation: "agreements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_deliverables_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string,"reason"?: string | null
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"granted_by": string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"granted_by"?: string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"granted_by"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"verification_cases": {
                  Row: {
                    "created_at": string,"id": string,"need_id": string | null,"notes": string | null,"provider": string | null,"provider_ref": string | null,"reviewed_at": string | null,"reviewer_id": string | null,"status": Database["public"]['Enums']["verification_status"],"subject_user_id": string,"type": Database["public"]['Enums']["verification_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"need_id"?: string | null,"notes"?: string | null,"provider"?: string | null,"provider_ref"?: string | null,"reviewed_at"?: string | null,"reviewer_id"?: string | null,"status"?: Database["public"]['Enums']["verification_status"],"subject_user_id": string,"type": Database["public"]['Enums']["verification_type"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"need_id"?: string | null,"notes"?: string | null,"provider"?: string | null,"provider_ref"?: string | null,"reviewed_at"?: string | null,"reviewer_id"?: string | null,"status"?: Database["public"]['Enums']["verification_status"],"subject_user_id"?: string,"type"?: Database["public"]['Enums']["verification_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "verification_cases_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_cases_need_id_fkey"
      columns: ["need_id"]
isOneToOne: false
      referencedRelation: "needs_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_cases_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_cases_subject_user_id_fkey"
      columns: ["subject_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "needs_public": {
                  Row: {
                    "accepted_support_types": (Database["public"]['Enums']["support_type"])[],"amount_minor": number | null,"category_slug": string,"currency": string,"deadline": string | null,"description": string,"evidence_reviewed": boolean | null,"funded_minor": number,"funding_basis_points": number | null,"id": string,"intended_use": string | null,"outcome_confirmed": boolean | null,"published_at": string | null,"region": string | null,"requester_identity_verified": boolean | null,"requester_name": string | null,"search": unknown,"title": string,"visibility": Database["public"]['Enums']["need_visibility"]
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "needs_category_slug_fkey"
      columns: ["category_slug"]
isOneToOne: false
      referencedRelation: "need_categories"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "needs_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                }
          }
          Functions: {
            "admin_set_account_status":
{ Args: { "p_reason": string,"p_status": Database["public"]['Enums']["account_status"],"p_user_id": string }; Returns: undefined
                           },
"admin_set_platform_setting":
{ Args: { "p_key": string,"p_value": Json }; Returns: undefined
                           },
"admin_set_role":
{ Args: { "p_enabled": boolean,"p_role": Database["public"]['Enums']["app_role"],"p_user_id": string }; Returns: undefined
                           },
"authorise_evidence_access":
{ Args: { "p_evidence_id": string }; Returns: string
                           },
"block_user":
{ Args: { "p_reason": string,"p_user_id": string }; Returns: undefined
                           },
"check_rate_limit":
{ Args: { "p_action": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"close_need":
{ Args: { "p_need_id": string }; Returns: undefined
                           },
"consume_anon_rate_limit":
{ Args: { "p_action": string,"p_server_token": string,"p_subject_hash": string }; Returns: boolean
                           },
"consume_rate_limit":
{ Args: { "p_action": string }; Returns: boolean
                           },
"current_aal":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"detect_sensitive_content":
{ Args: { "p_text": string }; Returns: (string)[]
                           },
"has_role":
{ Args: { "p_role": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"is_active_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_blocked_between":
{ Args: { "p_a": string,"p_b": string }; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"log_audit":
{ Args: { "p_action": string,"p_entity_id": string,"p_entity_type": string,"p_metadata"?: Json }; Returns: undefined
                           },
"mark_all_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"mark_risk_signal_reviewed":
{ Args: { "p_signal_id": string }; Returns: undefined
                           },
"moderate_need":
{ Args: { "p_action": string,"p_need_id": string,"p_note": string }; Returns: undefined
                           },
"moderation_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_blocked_users":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"display_name": string,"reason": string,"user_id": string
            }[]
                           },
"my_roles":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"][]
                           },
"need_requester_public":
{ Args: { "p_need_id": string }; Returns: {
              "display_name": string,"identity_verified": boolean
            }[]
                           },
"need_transition_allowed":
{ Args: { "p_from": Database["public"]['Enums']["need_status"],"p_to": Database["public"]['Enums']["need_status"] }; Returns: boolean
                           },
"notify_user":
{ Args: { "p_body": string,"p_link": string,"p_title": string,"p_type": string,"p_user_id": string }; Returns: undefined
                           },
"offer_transition_allowed":
{ Args: { "p_from": Database["public"]['Enums']["offer_status"],"p_to": Database["public"]['Enums']["offer_status"] }; Returns: boolean
                           },
"purge_rate_limits":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"record_staff_mfa_reset":
{ Args: { "p_reason": string,"p_user_id": string }; Returns: undefined
                           },
"request_account_deletion":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"resolve_report":
{ Args: { "p_report_id": string,"p_resolution": string,"p_status": Database["public"]['Enums']["report_status"] }; Returns: undefined
                           },
"set_my_role":
{ Args: { "p_enabled": boolean,"p_role": Database["public"]['Enums']["app_role"] }; Returns: undefined
                           },
"setting_bool":
{ Args: { "p_key": string }; Returns: boolean
                           },
"staff_evidence_in_scope":
{ Args: { "p_need_id": string }; Returns: boolean
                           },
"staff_has_evidence_grant":
{ Args: { "p_path": string }; Returns: boolean
                           },
"submit_need":
{ Args: { "p_need_id": string }; Returns: undefined
                           },
"submit_report":
{ Args: { "p_details": string,"p_reason": Database["public"]['Enums']["report_reason"],"p_target_id": string,"p_target_type": Database["public"]['Enums']["report_target"] }; Returns: string
                           },
"unblock_user":
{ Args: { "p_user_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "account_status": "active"|"suspended"|"deletion_requested","agreement_status": "awaiting_payment_readiness"|"active"|"submitted"|"in_review"|"completed"|"cancelled"|"disputed","app_role": "requester"|"supporter"|"business_rep"|"moderator"|"admin","dispute_status": "open"|"under_review"|"resolved"|"appealed"|"closed","milestone_status": "pending"|"evidence_submitted"|"approved"|"rejected"|"paid"|"cancelled","need_status": "draft"|"pending_review"|"changes_requested"|"published"|"rejected"|"closed"|"suspended","need_visibility": "public"|"members_only","offer_status": "draft"|"proposed"|"countered"|"accepted"|"declined"|"expired"|"cancelled"|"completed"|"disputed","payment_status": "created"|"requires_action"|"processing"|"succeeded"|"failed"|"cancelled"|"refunded"|"partially_refunded","payout_status": "pending"|"approved"|"in_transit"|"paid"|"failed"|"cancelled","refund_status": "requested"|"processing"|"succeeded"|"failed"|"cancelled","report_reason": "fraud_or_scam"|"misleading"|"inappropriate"|"harassment"|"duplicate"|"prohibited_request"|"other","report_status": "open"|"under_review"|"actioned"|"dismissed","report_target": "need"|"profile"|"message"|"offer","support_type": "gift"|"paid_task"|"milestone"|"direct_support","verification_status": "pending"|"approved"|"rejected"|"withdrawn","verification_type": "identity"|"evidence"|"outcome"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "account_status": ["active", "suspended", "deletion_requested"],"agreement_status": ["awaiting_payment_readiness", "active", "submitted", "in_review", "completed", "cancelled", "disputed"],"app_role": ["requester", "supporter", "business_rep", "moderator", "admin"],"dispute_status": ["open", "under_review", "resolved", "appealed", "closed"],"milestone_status": ["pending", "evidence_submitted", "approved", "rejected", "paid", "cancelled"],"need_status": ["draft", "pending_review", "changes_requested", "published", "rejected", "closed", "suspended"],"need_visibility": ["public", "members_only"],"offer_status": ["draft", "proposed", "countered", "accepted", "declined", "expired", "cancelled", "completed", "disputed"],"payment_status": ["created", "requires_action", "processing", "succeeded", "failed", "cancelled", "refunded", "partially_refunded"],"payout_status": ["pending", "approved", "in_transit", "paid", "failed", "cancelled"],"refund_status": ["requested", "processing", "succeeded", "failed", "cancelled"],"report_reason": ["fraud_or_scam", "misleading", "inappropriate", "harassment", "duplicate", "prohibited_request", "other"],"report_status": ["open", "under_review", "actioned", "dismissed"],"report_target": ["need", "profile", "message", "offer"],"support_type": ["gift", "paid_task", "milestone", "direct_support"],"verification_status": ["pending", "approved", "rejected", "withdrawn"],"verification_type": ["identity", "evidence", "outcome"]
          }
        }
} as const
