package handler

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/service"
)

// toTurnConfig converts a service.TurnConfig to the handler-local TurnConfig
// so that the service result can be used with the existing handler helper functions.
func toTurnConfig(sc service.TurnConfig) TurnConfig {
	exts := make([]TurnExtension, len(sc.Extensions))
	for i, e := range sc.Extensions {
		exts[i] = TurnExtension{TurnIndex: e.TurnIndex, ExtraDays: e.ExtraDays}
	}
	return TurnConfig{
		StartDate:      sc.StartDate,
		TurnLengthDays: sc.TurnLengthDays,
		Extensions:     exts,
	}
}

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

	// Build the schedule from the turns table (source of truth) so non-uniform
	// turn lengths stay aligned with reality. Not-yet-created future turns are
	// synthesized at the configured turn_length_days. The legacy config walk
	// computed week_of from turn_length_days alone, which desynced from the table
	// whenever a turn's real length differed (e.g. the base length was changed
	// after the turns were created), producing phantom weeks that no edit matched.
	allTurns, _ := h.q.GetTurnsForGroup(r.Context(), groupID)
	turnByIdx := make(map[int]db.Turn, len(allTurns))
	maxIdx := -1
	for _, t := range allTurns {
		turnByIdx[int(t.TurnIndex)] = t
		if int(t.TurnIndex) > maxIdx {
			maxIdx = int(t.TurnIndex)
		}
	}

	loc, _ := time.LoadLocation("America/New_York")
	turnLen := int(group.TurnLengthDays)
	var lastRealEnd time.Time
	if maxIdx >= 0 {
		lastRealEnd = pgDateToTime(turnByIdx[maxIdx].EndDate)
	}

	// Use real shifted turns for the current turn. If today is beyond the last
	// stored turn, synthesize the active future turn from the last real deadline.
	var currentWeekOf string
	realCurrent := false
	if currentTurn, err := h.q.GetCurrentTurn(r.Context(), groupID); err == nil {
		currentWeekOf = pgDateToString(currentTurn.WeekOf)
		realCurrent = true
	} else {
		currentWeekOf = getCurrentTurnWeekOf(config)
		todayT, _ := time.Parse("2006-01-02", time.Now().In(loc).Format("2006-01-02"))
		for _, t := range allTurns {
			startT := pgDateToTime(t.StartDate)
			endT := pgDateToTime(t.EndDate)
			if !todayT.Before(startT) && !todayT.After(endT) {
				currentWeekOf = pgDateToString(t.WeekOf)
				realCurrent = true
				break
			}
		}
		if !realCurrent && maxIdx >= 0 && turnLen > 0 && todayT.After(lastRealEnd) {
			daysAfterLastReal := int(math.Round(todayT.Sub(lastRealEnd).Hours() / 24))
			if daysAfterLastReal > 0 {
				currentIdx := maxIdx + 1 + (daysAfterLastReal-1)/turnLen
				startT := lastRealEnd.AddDate(0, 0, 1+(currentIdx-maxIdx-1)*turnLen)
				currentWeekOf = startT.Format("2006-01-02")
			}
		}
	}

	centerWeekOf := queryString(r, "centerWeekOf")
	explicitPageStart := centerWeekOf != "" && isValidDateStr(centerWeekOf)
	if !explicitPageStart {
		centerWeekOf = currentWeekOf
	}

	members, _ := h.q.GetGroupMembers(r.Context(), groupID)

	type memberResp struct {
		ID       int32  `json:"id"`
		Username string `json:"username"`
	}
	memberList := make([]memberResp, 0, len(members))
	for _, m := range members {
		memberList = append(memberList, memberResp{ID: m.UserID, Username: m.Username})
	}

	usernameByID := make(map[int32]string, len(members))
	for _, m := range members {
		usernameByID[m.UserID] = m.Username
	}

	// Center on the real turn whose week_of matches centerWeekOf when possible.
	centerIdx := getTurnIndexForDate(centerWeekOf, config)
	foundRealCenter := false
	for _, t := range allTurns {
		if pgDateToString(t.WeekOf) == centerWeekOf {
			centerIdx = int(t.TurnIndex)
			foundRealCenter = true
			break
		}
	}
	if !foundRealCenter && maxIdx >= 0 {
		if centerT, err := time.Parse("2006-01-02", centerWeekOf); err == nil && centerT.After(lastRealEnd) {
			daysAfterLastReal := int(math.Round(centerT.Sub(lastRealEnd).Hours() / 24))
			if daysAfterLastReal > 0 {
				centerIdx = maxIdx + 1 + (daysAfterLastReal-1)/turnLen
			}
		}
	}

	// The default schedule view keeps a few recent turns visible for context.
	// Explicit pagination requests are page-start cursors so Prev/Next pages do
	// not repeat dates from the currently visible page.
	const adminHistoryTurns = 4
	const adminForwardTurns = 20
	const adminPageTurns = adminHistoryTurns + adminForwardTurns
	startIdx := max(centerIdx-adminHistoryTurns, 0)
	endIdx := centerIdx + adminForwardTurns
	if explicitPageStart {
		startIdx = max(centerIdx, 0)
		endIdx = startIdx + adminPageTurns
	}

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
		var entry scheduleEntry
		var startT, endT time.Time

		if t, ok := turnByIdx[i]; ok {
			entry.WeekOf = pgDateToString(t.WeekOf)
			startT = pgDateToTime(t.StartDate)
			endT = pgDateToTime(t.EndDate)
			if uname, ok := usernameByID[t.PickerUserID]; ok {
				pid := t.PickerUserID
				uu := uname
				entry.PickerUserID = &pid
				entry.PickerUsername = &uu
			}
			entry.MovieUnlockedByAdmin = t.MovieUnlocked
			entry.ReviewUnlockedByAdmin = isReviewWindowOpen(t, time.Now())
		} else if maxIdx >= 0 && i > maxIdx {
			// Synthesized future turn (only past the last real turn): starts the day
			// after the previous one ends.
			startT = lastRealEnd.AddDate(0, 0, 1+(i-maxIdx-1)*turnLen)
			endT = startT.AddDate(0, 0, turnLen-1)
			entry.WeekOf = startT.Format("2006-01-02")
		} else if maxIdx < 0 {
			// No turns exist yet; fall back to the computed schedule.
			entry.WeekOf = getTurnStartDate(i, config)
			startT = timeToPgDate(entry.WeekOf).Time
			endT = startT.AddDate(0, 0, turnLen-1)
		} else {
			// Gap in the index sequence (no real turn here, and it's before the last
			// real turn) — skip so nothing renders out of chronological order.
			continue
		}

		if movie, err := h.q.GetMovieByGroupWeek(r.Context(), db.GetMovieByGroupWeekParams{
			GroupID: groupID, WeekOf: timeToPgDate(entry.WeekOf),
		}); err == nil {
			entry.Movie = map[string]any{
				"id": movie.ID, "title": movie.Title,
				"weekOf": pgDateToString(movie.WeekOf), "poster": movie.PosterUrl,
			}
		}

		// Express the real start/end as the offsets the calendar UI expects:
		// start = weekOf + startOffset; deadline last day = weekOf + turnLen + extDays - 1.
		wofT, _ := time.Parse("2006-01-02", entry.WeekOf)
		entry.StartOffsetDays = int32(math.Round(startT.Sub(wofT).Hours() / 24))
		endDays := int(math.Round(endT.Sub(wofT).Hours() / 24))
		entry.ExtendedDays = int32(endDays - turnLen + 1)
		entry.DeadlineMs = time.Date(endT.Year(), endT.Month(), endT.Day()+1, 0, 0, 0, 0, loc).UnixMilli()

		schedule = append(schedule, entry)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"schedule":          schedule,
		"members":           memberList,
		"currentTurnWeekOf": currentWeekOf,
		"centerWeekOf":      centerWeekOf,
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
		if err := h.turnSvc.ClearPicker(r.Context(), groupID, req.WeekOf); err != nil {
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

	if err := h.turnSvc.SetPicker(r.Context(), groupID, req.WeekOf, *req.UserID); err != nil {
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

	// Materialize the turn first. On a brand-new (or otherwise inactive) group
	// the turns are created lazily, so the row for this week may not exist yet.
	// UpsertTurnOverrideExtendedDays is a plain UPDATE that would match 0 rows,
	// and the GetTurn read below would then fail, silently skipping the whole
	// deadline + cascade block — the deadline picker appears to do nothing.
	if _, err := h.turnSvc.EnsureTurnExists(r.Context(), groupID, req.WeekOf); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to prepare turn")
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

	weekOfPgDate := timeToPgDate(req.WeekOf)
	h.q.UpsertTurnOverrideExtendedDays(r.Context(), db.UpsertTurnOverrideExtendedDaysParams{
		GroupID: groupID, WeekOf: weekOfPgDate, ExtendedDays: req.ExtendedDays,
	})

	// Read back the turn's real new end date, then cascade off the turns table.
	loc, _ := time.LoadLocation("America/New_York")
	var deadlineMs int64
	if extended, err := h.q.GetTurn(r.Context(), db.GetTurnParams{GroupID: groupID, WeekOf: weekOfPgDate}); err == nil {
		endT := pgDateToTime(extended.EndDate)
		deadlineMs = time.Date(endT.Year(), endT.Month(), endT.Day()+1, 0, 0, 0, 0, loc).UnixMilli()

		// Cascade through EVERY later turn so the whole schedule stays contiguous:
		// each turn starts the day after the previous turn's deadline and keeps its
		// own length. The shift propagates all the way down, not just one turn.
		// GetTurnsForGroup is ordered by turn_index, so this tolerates gaps in the
		// index sequence.
		type shift struct {
			id         int64
			start, end time.Time
		}
		var shifts []shift
		prevEnd := endT
		allTurns, _ := h.q.GetTurnsForGroup(r.Context(), groupID)
		for _, next := range allTurns {
			if next.TurnIndex <= extended.TurnIndex {
				continue
			}
			spanDays := int(math.Round(pgDateToTime(next.EndDate).Sub(pgDateToTime(next.StartDate)).Hours() / 24))
			ns := prevEnd.AddDate(0, 0, 1)
			ne := ns.AddDate(0, 0, spanDays)
			shifts = append(shifts, shift{id: next.ID, start: ns, end: ne})
			prevEnd = ne
		}
		// Two passes (park on far-future unique dates, then set final dates) so the
		// week_of unique constraint never trips while the turns reshuffle.
		for i, s := range shifts {
			park := time.Date(9000, 1, 1, 0, 0, 0, 0, time.UTC).AddDate(0, 0, i).Format("2006-01-02")
			h.q.UpdateTurnDates(r.Context(), db.UpdateTurnDatesParams{
				ID: s.id, StartDate: timeToPgDate(park), EndDate: timeToPgDate(park),
			})
		}
		for _, s := range shifts {
			h.q.UpdateTurnDates(r.Context(), db.UpdateTurnDatesParams{
				ID:        s.id,
				StartDate: timeToPgDate(s.start.Format("2006-01-02")),
				EndDate:   timeToPgDate(s.end.Format("2006-01-02")),
			})
		}
	}

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

	if _, err := h.q.GetGroupByID(r.Context(), groupID); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch group")
		return
	}

	// Materialize the turn first — on a new/inactive group its row is created
	// lazily, and UpsertTurnOverrideStartOffset (a plain UPDATE) would otherwise
	// match 0 rows and silently no-op.
	if _, err := h.turnSvc.EnsureTurnExists(r.Context(), groupID, req.WeekOf); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to prepare turn")
		return
	}

	// Turns stay contiguous automatically: every turn after the first starts the
	// day after the previous turn's deadline, so there's never an overlap to
	// reject. Only the very first turn honors an explicit start offset.
	offset := req.StartOffsetDays
	if this, err := h.q.GetTurn(r.Context(), db.GetTurnParams{
		GroupID: groupID, WeekOf: timeToPgDate(req.WeekOf),
	}); err == nil && this.TurnIndex > 0 {
		if prev, err := h.q.GetTurnByIndex(r.Context(), db.GetTurnByIndexParams{
			GroupID: groupID, TurnIndex: this.TurnIndex - 1,
		}); err == nil {
			weekT, _ := time.Parse("2006-01-02", req.WeekOf)
			desiredStart := pgDateToTime(prev.EndDate).AddDate(0, 0, 1)
			offset = int32(math.Round(desiredStart.Sub(weekT).Hours() / 24))
		}
	}

	h.q.UpsertTurnOverrideStartOffset(r.Context(), db.UpsertTurnOverrideStartOffsetParams{
		GroupID:         groupID,
		WeekOf:          timeToPgDate(req.WeekOf),
		StartOffsetDays: offset,
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"message":         "Turn start updated",
		"weekOf":          req.WeekOf,
		"startOffsetDays": offset,
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
		"message":               msg,
		"weekOf":                req.WeekOf,
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
		GroupID: groupID, WeekOf: timeToPgDate(weekOf),
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
		GroupID: groupID, WeekOf: timeToPgDate(req.WeekOf),
	}); err != nil {
		writeError(w, http.StatusBadRequest, "No movie set for this week")
		return
	}

	rounded := math.Round(req.Rating*10) / 10
	var ratingNumeric pgtype.Numeric
	if err := ratingNumeric.Scan(fmt.Sprintf("%.1f", rounded)); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid rating")
		return
	}
	var review *string
	if req.Review != nil {
		s := sanitizeReview(*req.Review)
		review = &s
	}

	weekOfDate := timeToPgDate(req.WeekOf)

	// Check if already voted
	alreadyVoted, _ := h.q.HasUserVoted(r.Context(), db.HasUserVotedParams{
		UserID: req.TargetUserID, GroupID: groupID, WeekOf: weekOfDate,
	})

	if err := h.q.UpsertVote(r.Context(), db.UpsertVoteParams{
		UserID: req.TargetUserID, GroupID: groupID,
		Rating: ratingNumeric, Review: review, WeekOf: weekOfDate,
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
		UserID: req.TargetUserID, GroupID: groupID, WeekOf: timeToPgDate(req.WeekOf),
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
		GroupID: groupID, WeekOf: timeToPgDate(req.WeekOf),
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
	svcConfig, _ := h.turnSvc.BuildTurnConfig(r.Context(), group)
	config := toTurnConfig(svcConfig)

	reviewUnlocked := false
	movieUnlocked := false
	extDays := int32(0)
	startOffset := int32(0)

	if override, err := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
		GroupID: groupID, WeekOf: timeToPgDate(weekOf),
	}); err == nil {
		reviewUnlocked = override.ReviewUnlockedByAdmin
		movieUnlocked = override.MovieUnlockedByAdmin
		extDays = override.ExtendedDays
		startOffset = override.StartOffsetDays
	}

	deadlineMs := getDeadlineMs(weekOf, config, int(extDays), int(startOffset))
	if turn, err := h.q.GetTurn(r.Context(), db.GetTurnParams{
		GroupID: groupID, WeekOf: timeToPgDate(weekOf),
	}); err == nil {
		reviewUnlocked = isReviewWindowOpen(turn, time.Now())
		movieUnlocked = turn.MovieUnlocked
		deadlineTime := getTurnDeadlineTime(turn)
		deadlineMs = deadlineTime.UnixMilli()
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"weekOf":                weekOf,
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
