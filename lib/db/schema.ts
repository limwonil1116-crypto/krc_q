import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  date,
  boolean,
  integer,
  bigint,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 150 }).notNull(),
  type: text("type").$type<"contractor" | "client_agency" | "admin_org">().notNull(),
  businessNumber: varchar("business_number", { length: 30 }),
  representativeName: varchar("representative_name", { length: 80 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  headquarters: varchar("headquarters", { length: 50 }),
  branch: varchar("branch", { length: 50 }),
  status: text("status").$type<"pending" | "active" | "suspended" | "deleted">().notNull().default("pending"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash"),
  kakaoId: varchar("kakao_id", { length: 64 }),
  name: varchar("name", { length: 80 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  branch: varchar("branch", { length: 50 }),
  role: text("role").$type<"contractor" | "supervisor" | "client" | "admin">().notNull(),
  status: text("status").$type<"pending" | "active" | "suspended" | "deleted">().notNull().default("pending"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  memberRole: text("member_role").$type<"owner" | "manager" | "viewer" | "staff">().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const structureTypes = pgTable("structure_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  guideText: text("guide_text"),
  parentId: uuid("parent_id"),
  isRequiredCheck: boolean("is_required_check").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const phaseTemplates = pgTable("phase_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  structureTypeId: uuid("structure_type_id").notNull().references(() => structureTypes.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  guideText: text("guide_text"),
  sortOrder: integer("sort_order").notNull(),
  isRequired: boolean("is_required").notNull().default(true),
  minPhotoCount: integer("min_photo_count").notNull().default(0),
  minVideoCount: integer("min_video_count").notNull().default(0),
  audioRequired: boolean("audio_required").notNull().default(false),
  textRequired: boolean("text_required").notNull().default(false),
  allowNotApplicable: boolean("allow_not_applicable").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const constructionSites = pgTable("construction_sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientOrgId: uuid("client_org_id"),
  contractorOrgId: uuid("contractor_org_id"),
  siteCode: varchar("site_code", { length: 100 }),
  districtName: varchar("district_name", { length: 150 }).notNull(),
  projectName: varchar("project_name", { length: 200 }).notNull(),
  executor: varchar("executor", { length: 50 }),
  workType: varchar("work_type", { length: 100 }),
  workTypes: text("work_types"),
  siteManagerName: varchar("site_manager_name", { length: 80 }),
  siteManagerPhone: varchar("site_manager_phone", { length: 30 }),
  siteManagerEmail: varchar("site_manager_email", { length: 255 }),
  contractorLogoDriveId: text("contractor_logo_drive_id"),
  contractorLogoName: varchar("contractor_logo_name", { length: 255 }),
  contractorCompany: varchar("contractor_company", { length: 150 }),
  address: text("address").notNull(),
  lat: numeric("lat", { precision: 10, scale: 7 }),
  lng: numeric("lng", { precision: 10, scale: 7 }),
  startedOn: date("started_on"),
  endedOn: date("ended_on"),
  supervisorName: varchar("supervisor_name", { length: 80 }),
  supervisorPhone: varchar("supervisor_phone", { length: 30 }),
  supervisorEmail: varchar("supervisor_email", { length: 255 }),
  status: text("status").$type<"draft" | "active" | "completed" | "archived">().notNull().default("draft"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const siteParticipants = pgTable("site_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => constructionSites.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  participantRole: text("participant_role")
    .$type<"contractor_manager" | "supervisor" | "client_viewer" | "client_manager">()
    .notNull(),
  receiveEmail: boolean("receive_email").notNull().default(true),
  receivePush: boolean("receive_push").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteStructures = pgTable("site_structures", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => constructionSites.id, { onDelete: "cascade" }),
  structureTypeId: uuid("structure_type_id").notNull().references(() => structureTypes.id),
  name: varchar("name", { length: 150 }).notNull(),
  locationDescription: text("location_description"),
  hasStructure: boolean("has_structure").notNull().default(true),
  notApplicableReason: text("not_applicable_reason"),
  status: text("status").$type<"active" | "not_applicable" | "completed" | "archived">().notNull().default("active"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const constructionRecords = pgTable("construction_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => constructionSites.id, { onDelete: "cascade" }),
  siteStructureId: uuid("site_structure_id").notNull().references(() => siteStructures.id, { onDelete: "cascade" }),
  phaseTemplateId: uuid("phase_template_id").notNull().references(() => phaseTemplates.id),
  inspectionDate: date("inspection_date"),
  subTypeId: uuid("sub_type_id"),
  inspectionContent: text("inspection_content"),
  inspectionPartFromMain: integer("inspection_part_from_main"),
  inspectionPartFromSub: integer("inspection_part_from_sub"),
  inspectionPartToMain: integer("inspection_part_to_main"),
  inspectionPartToSub: integer("inspection_part_to_sub"),
  title: varchar("title", { length: 200 }),
  textDescription: text("text_description"),
  voiceMemoText: text("voice_memo_text"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  locationAddress: text("location_address"),
  notApplicable: boolean("not_applicable").notNull().default(false),
  notApplicableReason: text("not_applicable_reason"),
  status: text("status").$type<"draft" | "ready" | "submitted" | "revision_requested" | "approved">().notNull().default("draft"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const recordAssets = pgTable("record_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordId: uuid("record_id").notNull().references(() => constructionRecords.id, { onDelete: "cascade" }),
  assetType: text("asset_type").$type<"photo" | "video" | "audio" | "document" | "map">().notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
  durationSeconds: numeric("duration_seconds", { precision: 10, scale: 2 }),
  width: integer("width"),
  height: integer("height"),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  gpsLat: numeric("gps_lat", { precision: 10, scale: 7 }),
  gpsLng: numeric("gps_lng", { precision: 10, scale: 7 }),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
  uploadStatus: text("upload_status").$type<"uploading" | "uploaded" | "failed" | "deleted">().notNull().default("uploading"),
  checksum: varchar("checksum", { length: 128 }),
  storageProvider: text("storage_provider").$type<"google_drive" | "supabase" | "vercel_blob">().notNull().default("google_drive"),
  storageFileId: text("storage_file_id"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});


export const guideAssets = pgTable("guide_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  structureTypeId: uuid("structure_type_id").references(() => structureTypes.id, { onDelete: "cascade" }),
  phaseTemplateId: uuid("phase_template_id").references(() => phaseTemplates.id, { onDelete: "cascade" }),
  subTypeId: uuid("sub_type_id").references(() => structureTypes.id, { onDelete: "cascade" }),
  phaseCode: varchar("phase_code", { length: 50 }),
  assetKind: text("asset_kind").$type<"reference" | "spec">().notNull().default("reference"),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull().default(0),
  storageProvider: text("storage_provider").$type<"google_drive" | "supabase" | "vercel_blob">().notNull().default("google_drive"),
  storageFileId: text("storage_file_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});


export const guideEntries = pgTable("guide_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  subTypeId: uuid("sub_type_id").notNull().references(() => structureTypes.id, { onDelete: "cascade" }),
  phaseCode: varchar("phase_code", { length: 50 }).notNull(),
  guideText: text("guide_text"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ===== 검측 요청/결과 (별지 제4호) =====
export const inspectionRequests = pgTable("inspection_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => constructionSites.id, { onDelete: "cascade" }),
  siteStructureId: uuid("site_structure_id").notNull().references(() => siteStructures.id, { onDelete: "cascade" }),
  subTypeId: uuid("sub_type_id"),
  inspectionDate: date("inspection_date"),
  requestNo: varchar("request_no", { length: 50 }),
  locationWork: text("location_work"),
  inspectionPart: text("inspection_part"),
  requiredAt: timestamp("required_at", { withTimezone: true }),
  inspectionMatter: text("inspection_matter"),
  isRecheck: boolean("is_recheck").notNull().default(false),
  // 시공사측
  contractorAgentName: varchar("contractor_agent_name", { length: 80 }),
  contractorCheckerName: varchar("contractor_checker_name", { length: 80 }),
  contractorSignature: text("contractor_signature"),
  contractorSignedAt: timestamp("contractor_signed_at", { withTimezone: true }),
  // 감독측
  supervisorId: uuid("supervisor_id").references(() => users.id),
  inspectionResult: text("inspection_result"),
  instruction: text("instruction"),
  supervisorSignature: text("supervisor_signature"),
  supervisorSignedAt: timestamp("supervisor_signed_at", { withTimezone: true }),
  status: text("status").$type<"draft" | "submitted" | "under_review" | "revision_requested" | "approved">().notNull().default("draft"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ===== 체크리스트 헤더 (별지 제5호) =====
export const checklists = pgTable("checklists", {
  id: uuid("id").primaryKey().defaultRandom(),
  inspectionRequestId: uuid("inspection_request_id").notNull().references(() => inspectionRequests.id, { onDelete: "cascade" }),
  facilityName: text("facility_name"),
  locationPart: text("location_part"),
  workName: text("work_name"),
  quantity: text("quantity"),
  stage: text("stage"),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  aiSource: text("ai_source"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ===== 체크리스트 항목 =====
export const checklistItems = pgTable("checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  checklistId: uuid("checklist_id").notNull().references(() => checklists.id, { onDelete: "cascade" }),
  itemNo: integer("item_no").notNull(),
  checkItem: text("check_item").notNull(),
  standard: text("standard"),
  // 시공사 1차
  contractorResult: text("contractor_result"),
  contractorNote: text("contractor_note"),
  // 감독 2차
  supervisorResult: text("supervisor_result"),
  supervisorNote: text("supervisor_note"),
  sortOrder: integer("sort_order").notNull().default(0),
});
