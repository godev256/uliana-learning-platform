package handler

import (
	"net/http"
	"sync"
	"time"
	"ulianaa.math/backend/internal/model"
)

type boardCursor struct {
	Page int     `json:"page"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
}
type cursorPeer struct {
	ID     string      `json:"id"`
	Role   string      `json:"role"`
	Cursor boardCursor `json:"cursor"`
}
type cursorEntry struct {
	room, actor string
	peer        cursorPeer
	seen        time.Time
}
type cursorStore struct {
	mu      sync.Mutex
	entries map[string]cursorEntry
}

func (s *cursorStore) exchange(room, actor, role string, cursor *boardCursor, now time.Time) []cursorPeer {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.entries == nil {
		s.entries = map[string]cursorEntry{}
	}
	for key, entry := range s.entries {
		if now.Sub(entry.seen) > 4*time.Second {
			delete(s.entries, key)
		}
	}
	key := room + "\x00" + actor
	if cursor == nil {
		delete(s.entries, key)
	} else if _, exists := s.entries[key]; exists || len(s.entries) < 4096 {
		s.entries[key] = cursorEntry{room: room, actor: actor, peer: cursorPeer{ID: actor, Role: role, Cursor: *cursor}, seen: now}
	}
	peers := []cursorPeer{}
	for _, entry := range s.entries {
		if entry.room == room && entry.actor != actor {
			peers = append(peers, entry.peer)
		}
	}
	return peers
}
func (h *Handler) presence(w http.ResponseWriter, r *http.Request, p model.Principal, body request, id, topic string) {
	if r.Method != http.MethodPost {
		reply(w, 405, map[string]string{"error": "Нужен POST."})
		return
	}
	if len(body.ClientID) < 16 || len(body.ClientID) > 80 {
		h.fail(w, model.Bad("Некорректный указатель."))
		return
	}
	for _, ch := range body.ClientID {
		if !(ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch >= '0' && ch <= '9' || ch == '-' || ch == '_') {
			h.fail(w, model.Bad("Некорректный указатель."))
			return
		}
	}
	if c := body.Cursor; c != nil && (c.Page < 0 || c.Page >= 100 || !(c.X >= 0 && c.X <= 1680 && c.Y >= 0 && c.Y <= 2376)) {
		h.fail(w, model.Bad("Некорректная позиция указателя."))
		return
	}
	owner, err := h.Service.Owner(r.Context(), p, id)
	if err != nil {
		h.fail(w, err)
		return
	}
	if topic == "" {
		topic = "main"
	}
	// Presence is scoped exactly like board contents, including trash exclusion.
	if _, err = h.Service.Boards.BoardRevision(r.Context(), owner.ID, topic); err != nil {
		h.fail(w, err)
		return
	}
	peers := h.cursors.exchange(owner.ID+"\x00"+topic, p.User.ID+":"+body.ClientID, p.User.Role, body.Cursor, time.Now())
	reply(w, 200, map[string]any{"peers": peers})
}
