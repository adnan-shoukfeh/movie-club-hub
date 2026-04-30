# Sticker Reactions System Design

## Context

Movie Club Hub currently has a verdict system where users rate and review movies. Users want a way to react to each other's verdicts with custom stickers, similar to Sleeper's reaction system. This adds social engagement and fun to the movie club experience.

The system will support:
- Custom stickers uploaded by admins (global + per-group)
- Multiple reactions per user per verdict
- "View All" to see who reacted
- Extensible design for future entities (nominations, picks)

## Requirements Summary

| Requirement | Decision |
|-------------|----------|
| React to | Verdicts first, extensible to nominations/picks |
| Sticker organization | Single flat category |
| Storage | Google Cloud Storage (GCS) |
| Multiple reactions | Yes, per user per verdict |
| View All | Yes, shows who reacted with what |
| Scope | Global stickers + per-group custom stickers |
| Upload constraints | PNG/GIF/WEBP, accept up to 2MB, process to 512×512 max |
| Global admin | Username `dingle_documentary` (checked via session user) |
| Responsive | Mobile-first, works on all devices |

## Data Model

### Tables

```sql
CREATE TABLE stickers (
    id          bigserial PRIMARY KEY,
    name        text NOT NULL,
    image_url   text NOT NULL,
    group_id    bigint REFERENCES groups(id) ON DELETE CASCADE,  -- null = global
    created_by  integer NOT NULL REFERENCES users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT stickers_name_group_unique UNIQUE (name, group_id)
);

CREATE TABLE reactions (
    id           bigserial PRIMARY KEY,
    entity_type  text NOT NULL,          -- 'verdict' (extensible)
    entity_id    bigint NOT NULL,
    user_id      integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sticker_id   bigint NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT reactions_unique UNIQUE (entity_type, entity_id, user_id, sticker_id)
);

CREATE INDEX reactions_entity_idx ON reactions(entity_type, entity_id);
CREATE INDEX stickers_group_idx ON stickers(group_id);
```

### Key Design Decisions

- **Polymorphic reactions**: `entity_type` + `entity_id` allows extending to nominations, picks without schema changes
- **No FK on entity_id**: App logic validates entity exists before creating reaction, cleans up reactions on entity delete
- **Global stickers**: `group_id = NULL` indicates global sticker
- **Unique constraint**: Prevents duplicate reactions (same user, same sticker, same entity)

## API Endpoints

### Sticker Management

```
# Signed URL for upload
POST   /api/stickers/upload-url
       Request:  { filename: "fire.png", contentType: "image/png", groupId?: 5 }
       Response: { uploadUrl: "https://storage.googleapis.com/...", objectName: "..." }

# Global stickers (super admin only)
POST   /api/stickers              -- Create sticker record after upload
GET    /api/stickers              -- List global stickers
DELETE /api/stickers/{id}         -- Delete global sticker

# Group stickers
POST   /api/groups/{groupId}/stickers      -- Create group sticker
GET    /api/groups/{groupId}/stickers      -- List group + global stickers
DELETE /api/groups/{groupId}/stickers/{id} -- Delete group sticker
```

### Reactions

```
POST   /api/reactions
       { entityType: "verdict", entityId: 123, stickerId: 5 }
       
DELETE /api/reactions/{id}

GET    /api/reactions?entityType=verdict&entityId=123
       Response: { reactions: [...], userReactions: [...] }
```

### Upload Flow

1. Client requests signed URL from backend
2. Client uploads directly to GCS
3. Client confirms upload, backend creates sticker record
4. Backend processes image (resize, compress)

## Frontend Components

### New Domain: `src/domains/reactions/`

```
reactions/
├── components/
│   ├── ReactionPicker.tsx      -- Modal/bottom sheet with sticker grid
│   ├── ReactionBar.tsx         -- Inline reactions with counts
│   ├── ReactionButton.tsx      -- Add reaction trigger (+)
│   └── ReactionViewAll.tsx     -- Modal showing who reacted
├── hooks/
│   ├── useReactions.ts         -- Fetch/add/remove reactions
│   └── useStickers.ts          -- Fetch available stickers
└── types.ts
```

### Integration

VerdictCard layout with reactions:

```
┌─────────────────────────────────────────┐
│  @username  ★★★★☆  7.5                  │
│  "Great cinematography, weak ending"    │
│                                         │
│  [😂 3] [🔥 2] [➕]                      │
└─────────────────────────────────────────┘
```

### Interaction Flow

1. Tap `[➕]` → ReactionPicker opens (bottom sheet on mobile, popover on desktop)
2. Tap sticker → Reaction added, picker closes
3. Tap sticker you've already used → Reaction removed (toggle)
4. Tap reaction count → ReactionViewAll shows who reacted

### Responsive Design

- Mobile-first approach
- Bottom sheet for picker on mobile, popover on desktop
- Touch-friendly tap targets (min 44px)
- Horizontal scroll on overflow for reaction bar

## Admin Panel

### Global Sticker Admin

New route: `/admin/stickers` (only accessible by `dingle_documentary`)

- Grid of global stickers with delete buttons
- Upload button with crop modal

### Group Sticker Admin

New section in existing `/groups/{groupId}/admin`:

- Grid of group-specific stickers
- Upload button with crop modal
- Note explaining global stickers are also available

### Upload UI

1. Click "Upload Sticker" → File picker (PNG/GIF/WEBP, max 2MB)
2. Crop modal with square aspect ratio enforced
3. Enter sticker name
4. Submit → Upload to GCS → Backend processes → Appears in grid

## GCS Integration

### Bucket Structure

```
gs://movieclub-stickers/
├── global/
│   └── {uuid}.{ext}
└── groups/
    └── {groupId}/
        └── {uuid}.{ext}
```

### Configuration

```
GCS_BUCKET=movieclub-stickers
GCS_PROJECT_ID=your-project
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Image Processing

- Accept up to 2MB uploads
- Resize to max 512×512
- Compress to target ~256KB
- Use Go `imaging` library or Cloud Function

## Error Handling

| Scenario | Handling |
|----------|----------|
| File too large (>2MB) | Client-side validation + backend rejection |
| Invalid format | Client-side validation + backend content-type check |
| GCS upload fails | Error toast, retry option |
| Entity doesn't exist | 404 response |
| Sticker deleted while in picker | Refresh list, show toast |
| Network failure | Optimistic UI with rollback |

### Deletion Cascades

- Deleting sticker → All reactions using it removed (DB cascade)
- Deleting verdict → App code removes associated reactions
- Show confirmation when deleting sticker with existing reactions

### Authorization

- Non-admin upload attempt → 403
- Admin deleting global sticker → 403 (super admin only)
- Non-member reacting → 403

## Verification Plan

### Manual Testing

1. **Admin upload**: Upload as super admin and group admin, verify crop and display
2. **Reaction flow**: Add, toggle off, view all reactors
3. **Mobile**: Test on actual device, verify bottom sheet and tap targets
4. **Edge cases**: Delete sticker/verdict, verify cleanup

### Automated Tests

- Go: Unit tests for handlers and service validation
- React: Component tests for ReactionPicker, ReactionBar
- Integration: API tests for upload and reaction CRUD

## Files to Modify/Create

### Backend (go-api/)

- `migrations/000027_create_stickers_reactions.up.sql` - Schema
- `internal/db/queries/stickers.sql` - SQLC queries
- `internal/db/queries/reactions.sql` - SQLC queries
- `internal/handler/sticker.go` - Sticker endpoints
- `internal/handler/reaction.go` - Reaction endpoints
- `internal/service/gcs.go` - GCS client wrapper
- `internal/handler/verdict.go` - Add reaction cleanup on delete

### Frontend (artifacts/movie-club/src/)

- `domains/reactions/` - New domain (components, hooks, types)
- `domains/admin/components/StickerManager.tsx` - Admin sticker grid
- `domains/admin/components/StickerUploadModal.tsx` - Upload with crop
- `pages/global-admin.tsx` - New page for super admin
- `pages/group-admin.tsx` - Add sticker section

### Shared (lib/)

- `api-spec/` - OpenAPI updates for new endpoints
- `api-client-react/` - Generated hooks for new endpoints
