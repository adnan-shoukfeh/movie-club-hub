package handler

import (
	"net/http"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

func (h *Handler) Dashboard(w http.ResponseWriter, r *http.Request) {
	userID := h.userID(r)

	user, err := h.q.GetUserByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "User not found")
		return
	}

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

	pendingVotes := 0
	groupList := make([]groupItem, 0, len(groups))
	groupConfigs := make(map[int32]TurnConfig)

	for _, g := range groups {
		item := groupItem{
			ID: g.ID, Name: g.Name, Role: g.Role,
			MemberCount: g.MemberCount, TurnLengthDays: g.TurnLengthDays,
			StartDate: pgDateToString(g.StartDate),
		}

		config, err := h.buildTurnConfig(r.Context(), db.Group{
			ID: g.ID, StartDate: g.StartDate, TurnLengthDays: g.TurnLengthDays,
		})
		if err != nil {
			groupList = append(groupList, item)
			continue
		}
		groupConfigs[g.ID] = config

		weekOf := getCurrentTurnWeekOf(config)
		movie, err := h.q.GetMovieByGroupWeek(r.Context(), db.GetMovieByGroupWeekParams{
			GroupID: g.ID, WeekOf: timeToPgDate(weekOf),
		})
		if err == nil {
			item.CurrentMovie = &movie.Title
			item.MoviePoster = movie.PosterUrl
		}

		adminExt := 0
		reviewUnlocked := false
		if override, err := h.q.GetTurnOverride(r.Context(), db.GetTurnOverrideParams{
			GroupID: g.ID, WeekOf: timeToPgDate(weekOf),
		}); err == nil {
			adminExt = int(override.ExtendedDays)
			reviewUnlocked = override.ReviewUnlockedByAdmin
		}

		votingOpen := false
		if movie.Title != "" {
			votingOpen = isVotingOpen(weekOf, config, adminExt) || reviewUnlocked
		}
		item.VotingOpen = votingOpen
		item.ResultsAvailable = movie.Title != "" && isResultsAvailable(weekOf, config, adminExt)

		if voted, err := h.q.HasUserVoted(r.Context(), db.HasUserVotedParams{
			UserID: userID, GroupID: g.ID, WeekOf: timeToPgDate(weekOf),
		}); err == nil {
			item.HasVoted = voted
		}

		if votingOpen && !item.HasVoted && movie.Title != "" {
			pendingVotes++
		}

		groupList = append(groupList, item)
	}

	// Recent results
	type recentResult struct {
		GroupID       int32   `json:"groupId"`
		GroupName     string  `json:"groupName"`
		Movie         string  `json:"movie"`
		AverageRating float32 `json:"averageRating"`
		TotalVotes    int32   `json:"totalVotes"`
		WeekOf        string  `json:"weekOf"`
	}

	recentRows, _ := h.q.GetRecentMoviesWithResults(r.Context(), db.GetRecentMoviesWithResultsParams{
		UserID: userID, Limit: 10,
	})

	recentResults := make([]recentResult, 0, len(recentRows))
	for _, row := range recentRows {
		rowWeekOf := pgDateToString(row.WeekOf)
		recentResults = append(recentResults, recentResult{
			GroupID: row.GroupID, GroupName: row.GroupName,
			Movie: row.Movie, AverageRating: row.AverageRating,
			TotalVotes: row.TotalVotes, WeekOf: rowWeekOf,
		})
		if len(recentResults) == 5 {
			break
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user": map[string]any{
			"id": user.ID, "username": user.Username,
			"createdAt": user.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
		},
		"groups":        groupList,
		"totalGroups":   len(groupList),
		"pendingVotes":  pendingVotes,
		"recentResults": recentResults,
	})
}
