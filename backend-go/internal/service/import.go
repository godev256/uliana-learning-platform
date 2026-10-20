package service

import (
	"encoding/hex"
	"encoding/json"
	"strings"
	"ulianaa.math/backend/internal/model"
)

func ValidateSnapshot(s model.Snapshot) error {
	if s.Version != 1 {
		return model.Bad("Unsupported snapshot version")
	}
	users := map[string]bool{}
	logins := map[string]bool{}
	teachers := 0
	for _, u := range s.Users {
		parts := strings.Split(u.PasswordHash, ":")
		if u.ID == "" || users[u.ID] || logins[u.Login] || !loginRE.MatchString(u.Login) || (u.Role != "teacher" && u.Role != "student") || len(parts) != 3 || parts[0] != "scrypt-v2" {
			return model.Bad("Invalid imported account")
		}
		key, err := hex.DecodeString(parts[2])
		if err != nil || len(key) != 64 || len(parts[1]) != 32 {
			return model.Bad("Invalid password hash")
		}
		if u.Role == "teacher" {
			teachers++
		}
		users[u.ID] = true
		logins[u.Login] = true
	}
	if teachers > 1 {
		return model.Bad("Snapshot has more than one teacher")
	}
	boards := map[string]bool{}
	for _, b := range s.Boards {
		key := b.StudentID + ":" + b.Topic.ID
		if !users[b.StudentID] || b.Topic.ID == "" || boards[key] || b.Revision < 0 || (b.Topic.Kind != "board" && b.Topic.Kind != "pdf") {
			return model.Bad("Invalid imported board")
		}
		if err := validTitle(b.Topic.Title); err != nil {
			return err
		}
		if err := ValidateNotebook(b.Notebook); err != nil {
			return err
		}
		boards[key] = true
	}
	for _, p := range s.Profiles {
		if !users[p.StudentID] {
			return model.Bad("Invalid profile owner")
		}
		for _, raw := range []json.RawMessage{p.Schedule, p.Lessons, p.Calendar} {
			var items []json.RawMessage
			if json.Unmarshal(raw, &items) != nil || items == nil {
				return model.Bad("Invalid imported profile")
			}
		}
	}
	assets := map[string]bool{}
	for _, a := range s.Assets {
		key := a.StudentID + ":" + a.ID + ":" + itoa(a.Part)
		if !users[a.StudentID] || !assetRE.MatchString(a.ID) || a.Part < 0 || a.Part >= a.Total || a.Total > 200 || a.Mime == "" || len(a.Data) == 0 || len(a.Data) > 262500 || assets[key] {
			return model.Bad("Invalid imported asset")
		}
		assets[key] = true
	}
	return nil
}
