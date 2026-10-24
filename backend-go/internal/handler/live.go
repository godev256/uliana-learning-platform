package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
	"ulianaa.math/backend/internal/model"
)

type liveCommit struct {
	Revision int64             `json:"revision"`
	Patch    *model.BoardPatch `json:"patch"`
}
type livePeer struct {
	send   chan []byte
	cancel context.CancelFunc
}
type liveRoom struct {
	peers   map[*livePeer]bool
	history []liveCommit
	bytes   int
}
type liveRooms struct {
	mu    sync.Mutex
	rooms map[string]*liveRoom
}

func (s *liveRooms) join(room string, p *livePeer) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.rooms == nil {
		s.rooms = map[string]*liveRoom{}
	}
	if s.rooms[room] == nil {
		if len(s.rooms) >= 256 {
			return false
		}
		s.rooms[room] = &liveRoom{peers: map[*livePeer]bool{}}
	}
	if len(s.rooms[room].peers) >= 32 {
		return false
	}
	s.rooms[room].peers[p] = true
	return true
}
func (s *liveRooms) leave(room string, p *livePeer) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if r := s.rooms[room]; r != nil {
		delete(r.peers, p)
		if len(r.peers) == 0 {
			delete(s.rooms, room)
		}
	}
}
func (s *liveRooms) broadcastLocked(room string, message any) {
	r := s.rooms[room]
	if r == nil {
		return
	}
	data, err := json.Marshal(message)
	if err != nil {
		return
	}
	for p := range r.peers {
		select {
		case p.send <- data:
		default:
			p.cancel()
		}
	}
}
func (s *liveRooms) cursor(room, actor, role string, cursor *boardCursor) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.broadcastLocked(room, map[string]any{"type": "cursor", "id": actor, "role": role, "cursor": cursor})
}
func (s *liveRooms) commit(room string, revision int64, patch *model.BoardPatch) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r := s.rooms[room]
	if r == nil {
		return
	}
	entry := liveCommit{Revision: revision, Patch: patch}
	data, _ := json.Marshal(entry)
	// Bounded replay only while a room has subscribers. Missing/out-of-order history falls back to a full authorized read.
	r.history = append(r.history, entry)
	r.bytes += len(data)
	for len(r.history) > 64 || r.bytes > 2*1024*1024 {
		old, _ := json.Marshal(r.history[0])
		r.bytes -= len(old)
		r.history = r.history[1:]
	}
	s.broadcastLocked(room, map[string]any{"type": "commit", "revision": revision, "patch": patch})
}
func (s *liveRooms) since(room string, from, to int64) ([]liveCommit, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r := s.rooms[room]
	if r == nil || from > to || to-from > int64(len(r.history)) {
		return nil, false
	}
	byRevision := map[int64]liveCommit{}
	for _, entry := range r.history {
		byRevision[entry.Revision] = entry
	}
	result := []liveCommit{}
	for revision := from + 1; revision <= to; revision++ {
		entry, ok := byRevision[revision]
		if !ok || entry.Patch == nil {
			return nil, false
		}
		result = append(result, entry)
	}
	return result, true
}
func validLiveCursor(c *boardCursor) bool {
	return c == nil || (c.Page >= 0 && c.Page < 100 && c.X >= 0 && c.X <= 1680 && c.Y >= 0 && c.Y <= 2376)
}
func validClientID(id string) bool {
	if len(id) < 16 || len(id) > 80 {
		return false
	}
	for _, ch := range id {
		if !(ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch >= '0' && ch <= '9' || ch == '-' || ch == '_') {
			return false
		}
	}
	return true
}
func (h *Handler) boardLive(w http.ResponseWriter, r *http.Request) {
	// Cookie authentication needs an exact allowed Origin, including for WebSocket upgrades.
	if !h.allowedOrigin(r.Header.Get("Origin")) {
		h.fail(w, model.ErrForbidden)
		return
	}
	raw, _, err := token(r)
	if err != nil {
		h.fail(w, model.ErrUnauthorized)
		return
	}
	authCtx, cancelAuth := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancelAuth()
	principal, err := h.Service.Authenticate(authCtx, raw)
	if err != nil {
		h.fail(w, err)
		return
	}
	id, topic, client := r.URL.Query().Get("studentId"), r.URL.Query().Get("topicId"), r.URL.Query().Get("clientId")
	if topic == "" {
		topic = "main"
	}
	if !validClientID(client) {
		h.fail(w, model.Bad("Некорректный указатель."))
		return
	}
	owner, err := h.Service.Owner(authCtx, principal, id)
	if err != nil {
		h.fail(w, err)
		return
	}
	revision, err := h.Service.Boards.BoardRevision(authCtx, owner.ID, topic)
	if err != nil {
		h.fail(w, err)
		return
	}
	// Origin was checked against exact configured origins above, before upgrading.
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(4096)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	room, actor := owner.ID+"\x00"+topic, principal.User.ID+":"+client
	peer := &livePeer{send: make(chan []byte, 32), cancel: cancel}
	if !h.live.join(room, peer) {
		_ = conn.Close(websocket.StatusTryAgainLater, "Room limit")
		return
	}
	defer h.live.leave(room, peer)
	defer func() {
		h.cursors.exchange(room, actor, principal.User.Role, nil, time.Now())
		h.live.cursor(room, actor, principal.User.Role, nil)
	}()
	peers := h.cursors.exchange(room, actor, principal.User.Role, nil, time.Now())
	ready, _ := json.Marshal(map[string]any{"type": "ready", "revision": revision, "peers": peers})
	peer.send <- ready
	go func() {
		defer cancel()
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case data := <-peer.send:
				writeCtx, done := context.WithTimeout(ctx, 3*time.Second)
				err := conn.Write(writeCtx, websocket.MessageText, data)
				done()
				if err != nil {
					return
				}
			case <-ticker.C:
				check, done := context.WithTimeout(ctx, 5*time.Second)
				_, authErr := h.Service.Authenticate(check, raw)
				_, boardErr := h.Service.Boards.BoardRevision(check, owner.ID, topic)
				if authErr != nil || boardErr != nil {
					done()
					return
				}
				err := conn.Ping(check)
				done()
				if err != nil {
					return
				}
			}
		}
	}()
	window, count := time.Now(), 0
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		if time.Since(window) >= time.Second {
			window = time.Now()
			count = 0
		}
		count++
		if count > 120 {
			return
		}
		var message struct {
			Type   string       `json:"type"`
			Cursor *boardCursor `json:"cursor"`
		}
		if json.Unmarshal(data, &message) != nil || message.Type != "cursor" || !validLiveCursor(message.Cursor) {
			_ = conn.Close(websocket.StatusPolicyViolation, "Invalid cursor")
			return
		}
		h.cursors.exchange(room, actor, principal.User.Role, message.Cursor, time.Now())
		h.live.cursor(room, actor, principal.User.Role, message.Cursor)
	}
}
