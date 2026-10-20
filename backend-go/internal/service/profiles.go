package service

import (
	"context"
	"encoding/json"
	"regexp"
	"time"
	"ulianaa.math/backend/internal/model"
	"unicode/utf8"
)

type scheduleRow struct {
	Day      int    `json:"day"`
	Time     string `json:"time"`
	Duration int    `json:"duration"`
}
type attachment struct {
	AssetID string `json:"assetId"`
	Name    string `json:"name"`
	Size    int    `json:"size"`
}
type lessonRow struct {
	Date       string      `json:"date"`
	Grade      *int        `json:"grade"`
	Homework   *int        `json:"homework"`
	Note       string      `json:"note"`
	Attachment *attachment `json:"attachment"`
}
type calendarRow struct {
	OriginalDate string `json:"originalDate"`
	OriginalTime string `json:"originalTime"`
	Date         string `json:"date"`
	Time         string `json:"time"`
	Duration     int    `json:"duration"`
}

var clockRE = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

func dateOK(date string) bool {
	_, err := time.Parse("2006-01-02", date)
	return len(date) == 10 && err == nil
}
func (s *Service) Profile(ctx context.Context, p model.Principal, id string) (model.Profile, error) {
	u, err := s.Student(ctx, p, id)
	if err != nil {
		return model.Profile{}, err
	}
	out, err := s.Profiles.Profile(ctx, u.ID)
	out.Student = u
	return out, err
}
func (s *Service) SaveProfile(ctx context.Context, p model.Principal, id string, schedule, lessons, calendar json.RawMessage) error {
	if err := Teacher(p); err != nil {
		return err
	}
	u, err := s.Student(ctx, p, id)
	if err != nil {
		return err
	}
	var rows []scheduleRow
	if json.Unmarshal(schedule, &rows) != nil || rows == nil || len(rows) > 14 {
		return model.Bad("Проверьте расписание.")
	}
	for _, r := range rows {
		if r.Day < 0 || r.Day > 6 || !clockRE.MatchString(r.Time) || r.Duration < 15 || r.Duration > 180 {
			return model.Bad("Проверьте расписание.")
		}
	}
	var notes []lessonRow
	if json.Unmarshal(lessons, &notes) != nil || notes == nil || len(notes) > 500 {
		return model.Bad("Проверьте результаты уроков.")
	}
	for _, r := range notes {
		if !dateOK(r.Date) || (r.Grade != nil && (*r.Grade < 1 || *r.Grade > 10)) || (r.Homework != nil && (*r.Homework < 0 || *r.Homework > 100)) || utf8.RuneCountInString(r.Note) > 1000 {
			return model.Bad("Проверьте результаты уроков.")
		}
		if a := r.Attachment; a != nil {
			if a.AssetID == "" || len(a.AssetID) > 80 || a.Name == "" || utf8.RuneCountInString(a.Name) > 512 || a.Size < 5 || a.Size > 20*1024*1024 {
				return model.Bad("Проверьте конспект.")
			}
			if err = s.CompletePDF(ctx, u.ID, a.AssetID, a.Size); err != nil {
				return err
			}
		}
	}
	if len(calendar) > 0 {
		var changes []calendarRow
		if json.Unmarshal(calendar, &changes) != nil || changes == nil || len(changes) > 1000 {
			return model.Bad("Проверьте переносы занятий.")
		}
		seen := map[string]bool{}
		for _, r := range changes {
			key := r.OriginalDate + "T" + r.OriginalTime
			if !dateOK(r.OriginalDate) || !dateOK(r.Date) || !clockRE.MatchString(r.Time) || !clockRE.MatchString(r.OriginalTime) || r.Duration < 15 || r.Duration > 180 || seen[key] {
				return model.Bad("Проверьте переносы занятий.")
			}
			seen[key] = true
		}
	}
	return s.Profiles.SaveProfile(ctx, u.ID, schedule, lessons, calendar)
}
