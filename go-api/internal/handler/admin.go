package handler

import (
	"context"
	"errors"
	"math"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

func (h *Handler) AdminGetSchedule(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	group, err := h.q.GetGroupByID(r.Context(), groupID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Group not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to fetch group")
		return
	}

	config, _ := h.buildTurnConfig(r.Context(), group)
	currentWeekOf := getCurrentTurnWeekOf(config)

	centerWeekOf := queryString(r, "centerWeekOf")
	if centerWeekOf == "" || !isValidDateStr(centerWeekOf) {
		centerWeekOf = currentWeekOf
	}

	memberCount, _ := h.q.GetGroupMemberCount(r.Context(), groupID)
	members, _ := h.q.GetGroupMembers(r.Context(), groupID)

	type memberResp struct {
		ID       int32  `json:"id"`
		Username string `json:"username"`
	}
	memberList := make([]memberResp, 0, len(members))
	for _, m := range members {
		memberList = append(memberList, memberResp{ID: m.UserID, Username: m.Username})
	}

	// Build schedule: 4 past + current + memberCount future
	pickerAssignments, _ := h.q.GetPickerAssignmentsForGroup(r.Context(), groupID)
	paMap := make(map[string]db.GetPickerAssignmentsForGroupRow)
	for _, pa := range pickerAssignments {
		paMap[pa.WeekOf] = pa
	}

	overrides, _ := h.q.GetTurnOverridesForGroup(r.Context(), groupID)
	overrideMap := make(map[string]db.GetTurnOverridesForGroupRow)
	for _, o := range overrides {
		overrideMap[pgDateToString(o.WeekOf)] = o
	}

	centerIdx := getTurnIndexForDate(centerWeekOf, config)
	startIdx := max(centerIdx-4, 0)
	endIdx := centerIdx + int(memberCount) + 1

	type scheduleEntry struct {
		WeekOf                string  `json:"weekOf"`
		PickerUserID          *int32  `json:"pickerUserId"`
		PickerUsername        *string `json:"pickerUsername"`
		Movie                 any     `json:"movie"`
		ReviewUnlockedByAdmin bool    `json:"reviewUnlockedByAdmin"`
		MovieUnlockedByAdmin  bool    `json:"movieUnlockedByAdmin"`
		ExtendedDays          int32   `json:"extendedDays"`
		StartOffsetDays       int32   `json:"startOffsetDays"`
		DeadlineMs            int64   `json:"deadlineMs"`
	}

	schedule := make([]scheduleEntry, 0, endIdx-startIdx)
	for i := startIdx; i < endIdx; i++ {
		wof := getTurnStartDate(i, config)
		entry := scheduleEntry{WeekOf: wof}

		if pa, ok := paMap[wof]; ok {
			entry.PickerUserID = &pa.UserID
			entry.PickerUsername = &pa.PickerUsername
		}

		if movie, err := h.q.GetMovieByGroupWeek(r.Context(), db.GetMovieByGroupWeekParams{
			GroupID: groupID, WeekOf: wof,
		}); err == nil {
			entry.Movie = map[string]any{
				"id": movie.ID, "title": movie.Title,
				"weekOf": movie.WeekOf, "poster": movie.Poster,
			}
		}

		adminExt := 0
		if o, ok := overrideMap[wof]; ok {
			entry.ReviewUnlockedByAdmin = o.ReviewUnlockedByAdmin
			entry.MovieUnlockedByAdmin = o.MovieUnlockedByAdmin
			entry.ExtendedDays = o.ExtendedDays
			entry.StartOffsetDays = o.StartOffsetDays
			adminExt = int(o.ExtendedDays)
		}

		entry.DeadlineMs = getDeadlineMs(wof, config, adminExt)
		schedule = append(schedule, entry)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"schedule":         schedule,
		"members":          memberList,
		"currentTurnWeekOf": currentWeekOf,
		"centerWeekOf":     centerWeekOf,
	})
}

func (h *Handler) AdminSetPicker(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		UserID *int32 `json:"userId"`
		WeekOf string `json:"weekOf"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if !isValidDateStr(req.WeekOf) {
		writeError(w, http.StatusBadRequest, "weekOf must be a valid YYYY-MM-DD date")
		return
	}

	if req.UserID == nil {
		if err := h.q.DeletePickerAssignment(r.Context(), db.DeletePickerAssignmentParams{
			GroupID: groupID, WeekOf: req.WeekOf,
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to clear picker")
			return
		}
		writeMessage(w, http.StatusOK, "Picker cleared")
		return
	}

	// Validate member
	if _, err := h.q.GetMembership(r.Context(), db.GetMembershipParams{
		UserID: *req.UserID, GroupID: groupID,
	}); err != nil {
		writeError(w, http.StatusNotFound, "Member not found")
		return
	}

	if err := h.q.UpsertPickerAssignment(r.Context(), db.UpsertPickerAssignmentParams{
		GroupID: groupID, UserID: *req.UserID, WeekOf: req.WeekOf,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to assign picker")
		return
	}

	writeMessage(w, http.StatusOK, "Picker assigned")
}

func (h *Handler) AdminExtendTurn(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		WeekOf       string `json:"weekOf"`
		ExtendedDays int32  `json:"extendedDays"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if !isValidDateStr(req.WeekOf) {
		writeError(w, http.StatusBadRequest, "weekOf must be a valid YYYY-MM-DD date")
		return
	}

	group, err := h.q.GetGroupByID(r.Context(), groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch group")
		return
	}

	minDays := -(group.TurnLengthDays - 1)
	if req.ExtendedDays < int32(minDays) || req.ExtendedDays > 365 {
		writeError(w, http.StatusBadRequest, "extendedDays would result in a turn shorter than 1 day or longer than 365 extra days")
		return
	}

	// Ensure deadline stays after the start offset for this turn.
	existing, _ := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
		GroupID: groupID, WeekOf: timeToPgDate(req.WeekOf),
	})
	effectiveTurnDays := int(group.TurnLengthDays) + int(req.ExtendedDays)
	if effectiveTurnDays <= int(existing.StartOffsetDays) {
		writeError(w, http.StatusBadRequest, "deadline must be at least 1 day after the turn's start date")
		return
	}

	config, _ := h.buildTurnConfig(r.Context(), group)

	weekOfPgDate := timeToPgDate(req.WeekOf)
	h.q.UpsertTurnOverrideExtendedDays(r.Context(), db.UpsertTurnOverrideExtendedDaysParams{
		GroupID: groupID, WeekOf: weekOfPgDate, ExtendedDays: req.ExtendedDays,
	})

	deadlineMs := getDeadlineMs(req.WeekOf, config, int(req.ExtendedDays))

	writeJSON(w, http.StatusOK, map[string]any{
		"message":      "Turn extended",
		"weekOf":       req.WeekOf,
		"extendedDays": req.ExtendedDays,
		"deadlineMs":   deadlineMs,
	})
}

func (h *Handler) AdminSetTurnStart(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		WeekOf          string `json:"weekOf"`
		StartOffsetDays int32  `json:"startOffsetDays"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if !isValidDateStr(req.WeekOf) {
		writeError(w, http.StatusBadRequest, "weekOf must be a valid YYYY-MM-DD date")
		return
	}

	if req.StartOffsetDays < 0 {
		writeError(w, http.StatusBadRequest, "startOffsetDays must be >= 0")
		return
	}

	group, err := h.q.GetGroupByID(r.Context(), groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch group")
		return
	}

	// Deadline must remain at least 1 day after the new start.
	existing, _ := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
		GroupID: groupID, WeekOf: timeToPgDate(req.WeekOf),
	})
	effectiveTurnDays := int(group.TurnLengthDays) + int(existing.ExtendedDays)
	if int(req.StartOffsetDays) >= effectiveTurnDays {
		writeError(w, http.StatusBadRequest, "start date must be before the turn's deadline")
		return
	}

	// Start must not overlap with the previous turn's active period.
	config, _ := h.buildTurnConfig(r.Context(), group)
	turnIdx := getTurnIndexForDate(req.WeekOf, config)
	if turnIdx > 0 {
		prevWeekOf := getTurnStartDate(turnIdx-1, config)
		prevOverride, _ := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
			GroupID: groupID, WeekOf: timeToPgDate(prevWeekOf),
		})
		prevDeadlineMs := getDeadlineMs(prevWeekOf, config, int(prevOverride.ExtendedDays))
		thisStart, _ := time.Parse("2006-01-02", req.WeekOf)
		thisEffectiveStartMs := thisStart.AddDate(0, 0, int(req.StartOffsetDays)).UnixMilli()
		if thisEffectiveStartMs < prevDeadlineMs {
			writeError(w, http.StatusBadRequest, "start date overlaps with the previous turn's active period")
			return
		}
	}

	h.q.UpsertTurnOverrideStartOffset(r.Context(), db.UpsertTurnOverrideStartOffsetParams{
		GroupID:         groupID,
		WeekOf:          timeToPgDate(req.WeekOf),
		StartOffsetDays: req.StartOffsetDays,
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"message":         "Turn start updated",
		"weekOf":          req.WeekOf,
		"startOffsetDays": req.StartOffsetDays,
	})
}

func (h *Handler) AdminUnlockMovie(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		WeekOf   string `json:"weekOf"`
		Unlocked bool   `json:"unlocked"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if !isValidDateStr(req.WeekOf) {
		writeError(w, http.StatusBadRequest, "weekOf must be a valid YYYY-MM-DD date")
		return
	}

	weekOfPgDate := timeToPgDate(req.WeekOf)
	if err := h.q.UpsertTurnOverrideMovieUnlocked(r.Context(), db.UpsertTurnOverrideMovieUnlockedParams{
		GroupID: groupID, WeekOf: weekOfPgDate, MovieUnlockedByAdmin: req.Unlocked,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update movie unlock")
		return
	}

	msg := "Movie locked"
	if req.Unlocked {
		msg = "Movie unlocked"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"message":              msg,
		"weekOf":               req.WeekOf,
		"movieUnlockedByAdmin": req.Unlocked,
	})
}

func (h *Handler) AdminUnlockReviews(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		WeekOf   string `json:"weekOf"`
		Unlocked bool   `json:"unlocked"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if !isValidDateStr(req.WeekOf) {
		writeError(w, http.StatusBadRequest, "weekOf must be a valid YYYY-MM-DD date")
		return
	}

	weekOfPgDate := timeToPgDate(req.WeekOf)
	if err := h.q.UpsertTurnOverrideReviewUnlocked(r.Context(), db.UpsertTurnOverrideReviewUnlockedParams{
		GroupID: groupID, WeekOf: weekOfPgDate, ReviewUnlockedByAdmin: req.Unlocked,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update review unlock")
		return
	}

	msg := "Reviews locked"
	if req.Unlocked {
		msg = "Reviews unlocked"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"message":                msg,
		"weekOf":                 req.WeekOf,
		"reviewUnlockedByAdmin": req.Unlocked,
	})
}

func (h *Handler) AdminGetVotes(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	weekOf := queryString(r, "weekOf")
	if !isValidDateStr(weekOf) {
		writeError(w, http.StatusBadRequest, "weekOf must be a valid YYYY-MM-DD date")
		return
	}

	votes, err := h.q.GetVotesForGroupWeek(r.Context(), db.GetVotesForGroupWeekParams{
		GroupID: groupID, WeekOf: weekOf,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch votes")
		return
	}

	type voteResp struct {
		UserID   int32   `json:"userId"`
		Username string  `json:"username"`
		Rating   float32 `json:"rating"`
		Review   *string `json:"review"`
	}

	voteList := make([]voteResp, 0, len(votes))
	for _, v := range votes {
		voteList = append(voteList, voteResp{
			UserID: v.UserID, Username: v.Username,
			Rating: v.Rating, Review: v.Review,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"weekOf": weekOf,
		"votes":  voteList,
	})
}

func (h *Handler) AdminVoteOverride(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		TargetUserID int32   `json:"targetUserId"`
		WeekOf       string  `json:"weekOf"`
		Rating       float64 `json:"rating"`
		Review       *string `json:"review"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if !isValidDateStr(req.WeekOf) {
		writeError(w, http.StatusBadRequest, "weekOf must be a valid YYYY-MM-DD date")
		return
	}

	if req.TargetUserID == 0 {
		writeError(w, http.StatusBadRequest, "targetUserId is required")
		return
	}

	if req.Rating < 1 || req.Rating > 10 {
		writeError(w, http.StatusBadRequest, "Rating must be between 1 and 10")
		return
	}

	// Validate target is a member
	if _, err := h.q.GetMembership(r.Context(), db.GetMembershipParams{
		UserID: req.TargetUserID, GroupID: groupID,
	}); err != nil {
		writeError(w, http.StatusNotFound, "Target user is not a member of this group")
		return
	}

	// Check movie exists
	if _, err := h.q.GetMovieByGroupWeek(r.Context(), db.GetMovieByGroupWeekParams{
		GroupID: groupID, WeekOf: req.WeekOf,
	}); err != nil {
		writeError(w, http.StatusBadRequest, "No movie set for this week")
		return
	}

	rating := float32(math.Round(req.Rating*10) / 10)
	var review *string
	if req.Review != nil {
		s := sanitizeReview(*req.Review)
		review = &s
	}

	// Check if already voted
	alreadyVoted, _ := h.q.HasUserVoted(r.Context(), db.HasUserVotedParams{
		UserID: req.TargetUserID, GroupID: groupID, WeekOf: req.WeekOf,
	})

	if err := h.q.UpsertVote(r.Context(), db.UpsertVoteParams{
		UserID: req.TargetUserID, GroupID: groupID,
		Rating: rating, Review: review, WeekOf: req.WeekOf,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to override vote")
		return
	}

	msg := "Vote created"
	if alreadyVoted {
		msg = "Vote updated"
	}
	writeMessage(w, http.StatusOK, msg)
}

func (h *Handler) AdminDeleteVoteOverride(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		TargetUserID int32  `json:"targetUserId"`
		WeekOf       string `json:"weekOf"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if !isValidDateStr(req.WeekOf) {
		writeError(w, http.StatusBadRequest, "weekOf must be a valid YYYY-MM-DD date")
		return
	}

	if req.TargetUserID == 0 {
		writeError(w, http.StatusBadRequest, "targetUserId is required")
		return
	}

	if err := h.q.DeleteVote(r.Context(), db.DeleteVoteParams{
		UserID: req.TargetUserID, GroupID: groupID, WeekOf: req.WeekOf,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to remove vote")
		return
	}

	writeMessage(w, http.StatusOK, "Vote removed")
}

func (h *Handler) AdminTransferOwnership(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireOwner(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		NewOwnerID int32 `json:"newOwnerId"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.NewOwnerID == 0 {
		writeError(w, http.StatusBadRequest, "newOwnerId is required")
		return
	}

	userID := h.userID(r)
	if req.NewOwnerID == userID {
		writeError(w, http.StatusBadRequest, "You are already the owner")
		return
	}

	// Validate target is a member
	if _, err := h.q.GetMembership(r.Context(), db.GetMembershipParams{
		UserID: req.NewOwnerID, GroupID: groupID,
	}); err != nil {
		writeError(w, http.StatusNotFound, "Target member not found")
		return
	}

	// Transaction
	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to start transaction")
		return
	}
	defer tx.Rollback(context.Background())

	qtx := h.q.WithTx(tx)

	// Set new owner
	if err := qtx.UpdateMemberRole(r.Context(), db.UpdateMemberRoleParams{
		UserID: req.NewOwnerID, GroupID: groupID, Role: "owner",
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to transfer ownership")
		return
	}

	// Demote current owner to admin
	if err := qtx.UpdateMemberRole(r.Context(), db.UpdateMemberRoleParams{
		UserID: userID, GroupID: groupID, Role: "admin",
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to transfer ownership")
		return
	}

	// Update groups table
	if err := qtx.UpdateGroupOwner(r.Context(), db.UpdateGroupOwnerParams{
		ID: groupID, OwnerID: req.NewOwnerID,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to transfer ownership")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to commit transaction")
		return
	}

	writeMessage(w, http.StatusOK, "Ownership transferred")
}

func (h *Handler) AdminDeleteNomination(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		NominationID int32 `json:"nominationId"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.NominationID == 0 {
		writeError(w, http.StatusBadRequest, "nominationId (integer) is required")
		return
	}

	nom, err := h.q.GetNominationByID(r.Context(), req.NominationID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Nomination not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to fetch nomination")
		return
	}

	if nom.GroupID != groupID {
		writeError(w, http.StatusNotFound, "Nomination not found")
		return
	}

	if err := h.q.DeleteNomination(r.Context(), req.NominationID); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete nomination")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message":      "Nomination removed",
		"nominationId": req.NominationID,
	})
}

func (h *Handler) AdminDeleteMovie(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		WeekOf string `json:"weekOf"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if !isValidDateStr(req.WeekOf) {
		writeError(w, http.StatusBadRequest, "weekOf must be a valid YYYY-MM-DD date")
		return
	}

	rows, err := h.q.DeleteMovieByGroupWeek(r.Context(), db.DeleteMovieByGroupWeekParams{
		GroupID: groupID, WeekOf: req.WeekOf,
	})
	if err != nil || rows == 0 {
		writeError(w, http.StatusNotFound, "No movie found for this week")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message": "Movie cleared",
		"weekOf":  req.WeekOf,
	})
}

func (h *Handler) AdminGetTurnOverride(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	weekOf := queryString(r, "weekOf")
	if !isValidDateStr(weekOf) {
		writeError(w, http.StatusBadRequest, "weekOf must be a valid YYYY-MM-DD date")
		return
	}

	group, _ := h.q.GetGroupByID(r.Context(), groupID)
	config, _ := h.buildTurnConfig(r.Context(), group)

	reviewUnlocked := false
	movieUnlocked := false
	extDays := int32(0)

	if override, err := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
		GroupID: groupID, WeekOf: timeToPgDate(weekOf),
	}); err == nil {
		reviewUnlocked = override.ReviewUnlockedByAdmin
		movieUnlocked = override.MovieUnlockedByAdmin
		extDays = override.ExtendedDays
	}

	deadlineMs := getDeadlineMs(weekOf, config, int(extDays))

	writeJSON(w, http.StatusOK, map[string]any{
		"weekOf":                 weekOf,
		"reviewUnlockedByAdmin": reviewUnlocked,
		"movieUnlockedByAdmin":  movieUnlocked,
		"extendedDays":          extDays,
		"deadlineMs":            deadlineMs,
	})
}

func (h *Handler) AdminUpdateSettings(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	_, ok := h.requireAdmin(w, r, groupID)
	if !ok {
		return
	}

	var req struct {
		StartDate      *string `json:"startDate"`
		TurnLengthDays *int32  `json:"turnLengthDays"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.StartDate == nil && req.TurnLengthDays == nil {
		writeError(w, http.StatusBadRequest, "No valid fields provided to update")
		return
	}

	if req.StartDate != nil {
		if !isValidDateStr(*req.StartDate) {
			writeError(w, http.StatusBadRequest, "startDate must be a YYYY-MM-DD date string")
			return
		}
	}

	if req.TurnLengthDays != nil {
		if *req.TurnLengthDays < 1 || *req.TurnLengthDays > 365 {
			writeError(w, http.StatusBadRequest, "turnLengthDays must be an integer between 1 and 365")
			return
		}
	}

	// Read current group to get defaults for COALESCE params
	currentGroup, err := h.q.GetGroupByID(r.Context(), groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch current group settings")
		return
	}

	params := db.UpdateGroupSettingsParams{
		ID:             groupID,
		StartDate:      currentGroup.StartDate,
		TurnLengthDays: currentGroup.TurnLengthDays,
	}
	if req.StartDate != nil {
		params.StartDate = timeToPgDate(*req.StartDate)
	}
	if req.TurnLengthDays != nil {
		params.TurnLengthDays = *req.TurnLengthDays
	}

	group, err := h.q.UpdateGroupSettings(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update settings")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id":             group.ID,
		"startDate":      pgDateToString(group.StartDate),
		"turnLengthDays": group.TurnLengthDays,
		"message":        "Group settings updated",
	})
}
