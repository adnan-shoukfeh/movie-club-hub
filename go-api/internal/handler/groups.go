package handler

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/service"
)

func (h *Handler) ListGroups(w http.ResponseWriter, r *http.Request) {
	userID := h.userID(r)
	groups, err := h.q.GetUserGroups(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch groups")
		return
	}

	type groupItem struct {
		ID               int32   `json:"id"`
		Name             string  `json:"name"`
		Role             string  `json:"role"`
		MemberCount      int64   `json:"memberCount"`
		CurrentMovie     *string `json:"currentMovie"`
		MoviePoster      *string `json:"moviePoster"`
		VotingOpen       bool    `json:"votingOpen"`
		HasVoted         bool    `json:"hasVoted"`
		ResultsAvailable bool    `json:"resultsAvailable"`
		TurnLengthDays   int32   `json:"turnLengthDays"`
		StartDate        string  `json:"startDate"`
	}

	result := make([]groupItem, 0, len(groups))
	for _, g := range groups {
		item := groupItem{
			ID:             g.ID,
			Name:           g.Name,
			Role:           g.Role,
			MemberCount:    g.MemberCount,
			TurnLengthDays: g.TurnLengthDays,
			StartDate:      pgDateToString(g.StartDate),
		}

		config, err := h.buildTurnConfig(r.Context(), db.Group{
			ID: g.ID, StartDate: g.StartDate, TurnLengthDays: g.TurnLengthDays,
		})
		if err != nil {
			result = append(result, item)
			continue
		}

		weekOf := getCurrentTurnWeekOf(config)
		movie, err := h.q.GetMovieByGroupWeek(r.Context(), db.GetMovieByGroupWeekParams{
			GroupID: g.ID, WeekOf: weekOf,
		})
		if err == nil {
			item.CurrentMovie = &movie.Title
			item.MoviePoster = movie.Poster
		}

		adminExt := int(0)
		if override, err := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
			GroupID: g.ID, WeekOf: timeToPgDate(weekOf),
		}); err == nil {
			adminExt = int(override.ExtendedDays)
		}

		item.VotingOpen = isVotingOpen(weekOf, config, adminExt)
		item.ResultsAvailable = isResultsAvailable(weekOf, config, adminExt)

		if voted, err := h.q.HasUserVoted(r.Context(), db.HasUserVotedParams{
			UserID: userID, GroupID: g.ID, WeekOf: weekOf,
		}); err == nil {
			item.HasVoted = voted
		}

		result = append(result, item)
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name           string  `json:"name"`
		TurnLengthDays *int32  `json:"turnLengthDays"`
		StartDate      *string `json:"startDate"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	turnLen := int32(7)
	if req.TurnLengthDays != nil {
		turnLen = *req.TurnLengthDays
	}

	startDate := ""
	if req.StartDate != nil {
		startDate = *req.StartDate
	}

	userID := h.userID(r)
	group, err := h.groupSvc.Create(r.Context(), userID, req.Name, startDate, turnLen)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":             group.ID,
		"name":           group.Name,
		"createdAt":      group.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
		"ownerId":        group.OwnerID,
		"startDate":      pgDateToString(group.StartDate),
		"turnLengthDays": group.TurnLengthDays,
	})
}

func (h *Handler) GetGroup(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
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

	mem, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return
	}

	config, err := h.buildTurnConfig(r.Context(), group)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to build turn config")
		return
	}

	currentWeekOf := getCurrentTurnWeekOf(config)
	weekOf := queryString(r, "weekOf")
	if weekOf == "" || !isValidDateStr(weekOf) {
		weekOf = currentWeekOf
	}

	memberCount, err := h.q.GetGroupMemberCount(r.Context(), groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get member count")
		return
	}

	if !isTurnWithinCap(weekOf, config, int(memberCount)) {
		writeError(w, http.StatusBadRequest, "Requested turn is beyond the allowed future range.")
		return
	}

	members, err := h.q.GetGroupMembers(r.Context(), groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch members")
		return
	}

	watchStatuses, _ := h.q.GetWatchStatuses(r.Context(), db.GetWatchStatusesParams{
		GroupID: groupID, WeekOf: weekOf,
	})
	watchMap := make(map[int32]bool)
	for _, ws := range watchStatuses {
		watchMap[ws.UserID] = ws.Watched
	}

	type memberResp struct {
		ID       int32  `json:"id"`
		Username string `json:"username"`
		Role     string `json:"role"`
		JoinedAt string `json:"joinedAt"`
		Watched  bool   `json:"watched"`
	}
	memberList := make([]memberResp, 0, len(members))
	for _, m := range members {
		memberList = append(memberList, memberResp{
			ID: m.UserID, Username: m.Username, Role: m.Role,
			JoinedAt: m.JoinedAt.Format("2006-01-02T15:04:05.000Z"),
			Watched:  watchMap[m.UserID],
		})
	}

	// Movie data
	var movieData any
	movie, movieErr := h.q.GetMovieByGroupWeek(r.Context(), db.GetMovieByGroupWeekParams{
		GroupID: groupID, WeekOf: weekOf,
	})
	if movieErr == nil {
		var nominatorUsername *string
		if movie.NominatorUserID != nil {
			if u, err := h.q.GetUserByID(r.Context(), *movie.NominatorUserID); err == nil {
				nominatorUsername = &u.Username
			}
		}
		var setByUsername *string
		if movie.SetByUserID != nil {
			if u, err := h.q.GetUserByID(r.Context(), *movie.SetByUserID); err == nil {
				setByUsername = &u.Username
			}
		}
		movieData = map[string]any{
			"id": movie.ID, "title": movie.Title, "weekOf": movie.WeekOf,
			"imdbId": movie.ImdbID, "poster": movie.Poster,
			"director": movie.Director, "genre": movie.Genre,
			"runtime": movie.Runtime, "year": movie.Year,
			"nominatorUserId": movie.NominatorUserID, "nominatorUsername": nominatorUsername,
			"setByUserId": movie.SetByUserID, "setByUsername": setByUsername,
		}
	}

	// Picker
	var pickerUserID *int32
	var pickerUsername *string
	if pa, err := h.q.GetPickerAssignment(r.Context(), db.GetPickerAssignmentParams{
		GroupID: groupID, WeekOf: weekOf,
	}); err == nil {
		pickerUserID = &pa.UserID
		if u, err := h.q.GetUserByID(r.Context(), pa.UserID); err == nil {
			pickerUsername = &u.Username
		}
	}

	// Turn override
	adminExt := 0
	movieUnlocked := false
	reviewUnlocked := false
	if override, err := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
		GroupID: groupID, WeekOf: timeToPgDate(weekOf),
	}); err == nil {
		adminExt = int(override.ExtendedDays)
		movieUnlocked = override.MovieUnlockedByAdmin
		reviewUnlocked = override.ReviewUnlockedByAdmin
	}

	votingOpen := false
	if movieErr == nil {
		isCurrentTurn := weekOf == currentWeekOf
		votingOpen = (isVotingOpen(weekOf, config, adminExt) && isCurrentTurn) || reviewUnlocked
	}
	resultsAvail := movieErr == nil && isResultsAvailable(weekOf, config, adminExt)

	// My vote
	userID := h.userID(r)
	var myVote *float32
	var myReview *string
	if v, err := h.q.GetUserVote(r.Context(), db.GetUserVoteParams{
		UserID: userID, GroupID: groupID, WeekOf: weekOf,
	}); err == nil {
		myVote = &v.Rating
		myReview = v.Review
	}
	myWatched := watchMap[userID]

	// Picker schedule
	type scheduleEntry struct {
		WeekOf         string  `json:"weekOf"`
		EndDate        string  `json:"endDate"`
		PickerUserID   *int32  `json:"pickerUserId"`
		PickerUsername *string `json:"pickerUsername"`
		IsCurrent      bool    `json:"isCurrent"`
	}

	pickerAssignments, _ := h.q.GetPickerAssignmentsForGroup(r.Context(), groupID)
	paMap := make(map[string]db.GetPickerAssignmentsForGroupRow)
	for _, pa := range pickerAssignments {
		paMap[pa.WeekOf] = pa
	}

	currentIdx := getTurnIndexForDate(currentWeekOf, config)
	scheduleCount := int(memberCount)
	schedule := make([]scheduleEntry, 0, scheduleCount)
	for i := 0; i < scheduleCount; i++ {
		idx := currentIdx + i
		wof := getTurnStartDate(idx, config)
		endDate := getTurnStartDate(idx+1, config)

		entry := scheduleEntry{
			WeekOf:    wof,
			EndDate:   endDate,
			IsCurrent: i == 0,
		}
		if pa, ok := paMap[wof]; ok {
			entry.PickerUserID = &pa.UserID
			entry.PickerUsername = &pa.PickerUsername
		}
		schedule = append(schedule, entry)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id": group.ID, "name": group.Name, "ownerId": group.OwnerID,
		"members": memberList, "weekOf": weekOf,
		"currentTurnWeekOf": currentWeekOf,
		"turnConfig": map[string]any{
			"startDate":      config.StartDate,
			"turnLengthDays": config.TurnLengthDays,
			"extensions":     config.Extensions,
		},
		"movieData": movieData, "pickerUserId": pickerUserID, "pickerUsername": pickerUsername,
		"votingOpen": votingOpen, "resultsAvailable": resultsAvail,
		"myRole": mem.Role, "myVote": myVote, "myReview": myReview, "myWatched": myWatched,
		"turnLengthDays": group.TurnLengthDays, "startDate": pgDateToString(group.StartDate),
		"pickerSchedule": schedule, "movieUnlockedByAdmin": movieUnlocked,
	})
}

func (h *Handler) GetGroupStatus(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
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

	mem, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return
	}

	config, err := h.buildTurnConfig(r.Context(), group)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to build turn config")
		return
	}

	currentWeekOf := getCurrentTurnWeekOf(config)
	weekOf := queryString(r, "weekOf")
	if weekOf == "" || !isValidDateStr(weekOf) {
		weekOf = currentWeekOf
	}

	memberCount, _ := h.q.GetGroupMemberCount(r.Context(), groupID)
	if !isTurnWithinCap(weekOf, config, int(memberCount)) {
		writeError(w, http.StatusBadRequest, "Requested turn is beyond the allowed future range.")
		return
	}

	var movieData any
	movie, movieErr := h.q.GetMovieByGroupWeek(r.Context(), db.GetMovieByGroupWeekParams{
		GroupID: groupID, WeekOf: weekOf,
	})
	if movieErr == nil {
		movieData = map[string]any{
			"id": movie.ID, "title": movie.Title, "weekOf": movie.WeekOf,
			"imdbId": movie.ImdbID, "poster": movie.Poster,
			"director": movie.Director, "genre": movie.Genre,
			"runtime": movie.Runtime, "year": movie.Year,
			"nominatorUserId": movie.NominatorUserID,
		}
	}

	adminExt := 0
	reviewUnlocked := false
	if override, err := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
		GroupID: groupID, WeekOf: timeToPgDate(weekOf),
	}); err == nil {
		adminExt = int(override.ExtendedDays)
		reviewUnlocked = override.ReviewUnlockedByAdmin
	}

	votingOpen := false
	if movieErr == nil {
		isCurrentTurn := weekOf == currentWeekOf
		votingOpen = (isVotingOpen(weekOf, config, adminExt) && isCurrentTurn) || reviewUnlocked
	}
	resultsAvail := movieErr == nil && isResultsAvailable(weekOf, config, adminExt)

	var deadlineMs *int64
	if movieErr == nil {
		d := getDeadlineMs(weekOf, config, adminExt)
		deadlineMs = &d
	}

	userID := h.userID(r)
	hasVoted := false
	var myVote *float32
	var myReview *string
	if v, err := h.q.GetUserVote(r.Context(), db.GetUserVoteParams{
		UserID: userID, GroupID: groupID, WeekOf: weekOf,
	}); err == nil {
		hasVoted = true
		myVote = &v.Rating
		myReview = v.Review
	}

	myWatched := false
	if ws, err := h.q.GetWatchStatuses(r.Context(), db.GetWatchStatusesParams{
		GroupID: groupID, WeekOf: weekOf,
	}); err == nil {
		for _, s := range ws {
			if s.UserID == userID {
				myWatched = s.Watched
				break
			}
		}
	}

	var pickerUserID *int32
	var pickerUsername *string
	if pa, err := h.q.GetPickerAssignment(r.Context(), db.GetPickerAssignmentParams{
		GroupID: groupID, WeekOf: weekOf,
	}); err == nil {
		pickerUserID = &pa.UserID
		if u, err := h.q.GetUserByID(r.Context(), pa.UserID); err == nil {
			pickerUsername = &u.Username
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"groupId": groupID, "weekOf": weekOf,
		"movieData": movieData, "votingOpen": votingOpen, "resultsAvailable": resultsAvail,
		"deadlineMs": deadlineMs, "hasVoted": hasVoted,
		"myVote": myVote, "myReview": myReview, "myWatched": myWatched,
		"pickerUserId": pickerUserID, "pickerUsername": pickerUsername,
		"myRole": mem.Role, "turnLengthDays": group.TurnLengthDays,
		"startDate": pgDateToString(group.StartDate),
	})
}

func (h *Handler) KickMember(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	var req struct {
		UserID int32 `json:"userId"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	callerID := h.userID(r)
	if err := h.groupSvc.RemoveMember(r.Context(), callerID, groupID, req.UserID); err != nil {
		switch {
		case errors.Is(err, service.ErrForbidden):
			writeError(w, http.StatusForbidden, "Insufficient permissions")
		case errors.Is(err, service.ErrNotFound):
			writeError(w, http.StatusNotFound, "Not found")
		default:
			writeError(w, http.StatusInternalServerError, "Internal error")
		}
		return
	}

	writeMessage(w, http.StatusOK, "Member removed")
}

func (h *Handler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	var req struct {
		UserID int32  `json:"userId"`
		Role   string `json:"role"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Role != "member" && req.Role != "admin" {
		writeError(w, http.StatusBadRequest, "Invalid role. Must be 'member' or 'admin'")
		return
	}

	callerID := h.userID(r)
	if err := h.groupSvc.UpdateMemberRole(r.Context(), callerID, groupID, req.UserID, req.Role); err != nil {
		switch {
		case errors.Is(err, service.ErrForbidden):
			writeError(w, http.StatusForbidden, "Insufficient permissions")
		case errors.Is(err, service.ErrNotFound):
			writeError(w, http.StatusNotFound, "Not found")
		default:
			writeError(w, http.StatusInternalServerError, "Internal error")
		}
		return
	}

	writeMessage(w, http.StatusOK, "Role updated")
}

func (h *Handler) AssignPicker(w http.ResponseWriter, r *http.Request) {
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
		UserID int32 `json:"userId"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate target is a member
	if _, err := h.q.GetMembership(r.Context(), db.GetMembershipParams{
		UserID: req.UserID, GroupID: groupID,
	}); err != nil {
		writeError(w, http.StatusNotFound, "Member not found")
		return
	}

	group, err := h.q.GetGroupByID(r.Context(), groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch group")
		return
	}

	config, _ := h.buildTurnConfig(r.Context(), group)
	weekOf := getCurrentTurnWeekOf(config)

	if err := h.q.UpsertPickerAssignment(r.Context(), db.UpsertPickerAssignmentParams{
		GroupID: groupID, UserID: req.UserID, WeekOf: weekOf,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to assign picker")
		return
	}

	writeMessage(w, http.StatusOK, "Picker assigned")
}

func (h *Handler) SetTurnExtension(w http.ResponseWriter, r *http.Request) {
	groupID, err := pathInt(r, "groupId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid groupId or turnIndex")
		return
	}

	turnIndexStr := chi_URLParam(r, "turnIndex")
	turnIndex, err := strconv.Atoi(turnIndexStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid groupId or turnIndex")
		return
	}

	mem, ok := h.requireMembership(w, r, groupID)
	if !ok {
		return
	}
	if mem.Role != "owner" && mem.Role != "admin" {
		writeError(w, http.StatusForbidden, "Only admins and owners can set turn extensions")
		return
	}

	var req struct {
		ExtraDays int32 `json:"extraDays"`
	}
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.ExtraDays < 0 {
		writeError(w, http.StatusBadRequest, "extraDays must be a non-negative integer")
		return
	}

	if err := h.q.UpsertTurnExtension(r.Context(), db.UpsertTurnExtensionParams{
		GroupID: groupID, TurnIndex: int32(turnIndex), ExtraDays: req.ExtraDays,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to set turn extension")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message":   "Turn extension set",
		"groupId":   groupID,
		"turnIndex": turnIndex,
		"extraDays": req.ExtraDays,
	})
}

// helper to parse weekOf string to time.Time for DB queries
func parseWeekOfToTime(weekOf string) time.Time {
	t, _ := time.Parse("2006-01-02", weekOf)
	return t
}

// chi URL param helper (avoiding import cycle)
func chi_URLParam(r *http.Request, key string) string {
	return r.PathValue(key)
}
