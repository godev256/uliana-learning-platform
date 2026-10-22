package handler

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"time"
	"ulianaa.math/backend/internal/config"
	"ulianaa.math/backend/internal/model"
	"ulianaa.math/backend/internal/service"
)

const cookieName = "uliana_go_session"

type Handler struct {
	Service *service.Service
	Config  config.Config
	Ping    func(context.Context) error
	Log     *slog.Logger
}
type request struct {
	Login     string          `json:"login"`
	Password  string          `json:"password"`
	StudentID string          `json:"studentId"`
	TopicID   string          `json:"topicId"`
	Operation string          `json:"operation"`
	Title     string          `json:"title"`
	IDs       []string        `json:"ids"`
	Notebook  *model.Notebook `json:"notebook"`
	Revision  *int64          `json:"revision"`
	Document  *model.Document `json:"document"`
	AssetID   string          `json:"assetId"`
	Part      *int            `json:"part"`
	Total     int             `json:"total"`
	Mime      string          `json:"mime"`
	Data      string          `json:"data"`
	Schedule  json.RawMessage `json:"schedule"`
	Lessons   json.RawMessage `json:"lessons"`
	Calendar  json.RawMessage `json:"calendar"`
}

func (h *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { reply(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := h.Ping(ctx); err != nil {
			reply(w, 503, map[string]string{"status": "database unavailable"})
			return
		}
		reply(w, 200, map[string]string{"status": "ready"})
	})
	mux.HandleFunc("/api/account", func(w http.ResponseWriter, r *http.Request) {
		action := r.URL.Query().Get("action")
		if action == "" {
			action = "session"
		}
		h.account(w, r, action, "")
	})
	for path, action := range map[string]string{"POST /api/v1/auth/login": "login", "POST /api/v1/auth/logout": "logout", "GET /api/v1/auth/me": "me", "GET /api/v1/students": "students", "POST /api/v1/students": "students", "GET /api/v1/students/{studentID}/boards": "topics", "POST /api/v1/students/{studentID}/boards": "topics", "GET /api/v1/students/{studentID}/boards/{boardID}": "board", "PUT /api/v1/students/{studentID}/boards/{boardID}": "board", "PATCH /api/v1/students/{studentID}/boards/{boardID}": "topics"} {
		action := action
		mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
			operation := ""
			if r.Method == http.MethodPatch {
				operation = "rename"
			}
			h.account(w, r, action, operation)
		})
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		defer func() {
			if recovered := recover(); recovered != nil {
				h.Log.Error("HTTP panic", "path", r.URL.Path)
				reply(w, 500, map[string]string{"error": "Не удалось выполнить действие."})
			}
		}()
		origin := r.Header.Get("Origin")
		if origin != "" && h.allowedOrigin(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Add("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			if !h.allowedOrigin(origin) {
				reply(w, 403, map[string]string{"error": "Origin is not allowed"})
				return
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		mux.ServeHTTP(w, r.WithContext(ctx))
	})
}
func reply(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
func (h *Handler) fail(w http.ResponseWriter, err error) {
	status, message := model.Status(err)
	if status == 500 {
		h.Log.Error("request failed", "error", err)
	}
	reply(w, status, map[string]string{"error": message})
}
func token(r *http.Request) (string, bool, error) {
	if value := r.Header.Get("Authorization"); value != "" {
		parts := strings.Fields(value)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			return "", true, model.ErrUnauthorized
		}
		return parts[1], true, nil
	}
	cookie, err := r.Cookie(cookieName)
	if err == http.ErrNoCookie {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return cookie.Value, false, nil
}
func (h *Handler) writeCookie(w http.ResponseWriter, value string, age int) {
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: value, Path: "/api", HttpOnly: true, Secure: h.Config.SecureCookie, SameSite: http.SameSiteLaxMode, MaxAge: age})
}
func (h *Handler) allowedOrigin(origin string) bool {
	for _, allowed := range h.Config.Origins {
		if origin == allowed {
			return true
		}
	}
	return false
}
func (h *Handler) localSetup(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	ip := net.ParseIP(host)
	return h.Config.LocalSetup && err == nil && ip != nil && ip.IsLoopback()
}
func (h *Handler) account(w http.ResponseWriter, r *http.Request, action, operation string) {
	ctx := r.Context()
	if (action == "password" || action == "logout") && r.Method != http.MethodPost {
		reply(w, 405, map[string]string{"error": "Нужен POST."})
		return
	}
	write := r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodPatch
	if !write && r.Method != http.MethodGet {
		reply(w, 405, map[string]string{"error": "Метод не поддерживается."})
		return
	}
	raw, bearer, err := token(r)
	if err != nil {
		h.fail(w, model.ErrUnauthorized)
		return
	}
	var body request
	if write {
		origin := r.Header.Get("Origin")
		if r.Header.Get("Sec-Fetch-Site") == "cross-site" || (origin != "" && !h.allowedOrigin(origin)) || (!bearer && origin == "") {
			h.fail(w, model.ErrForbidden)
			return
		}
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			reply(w, 415, map[string]string{"error": "Нужен application/json."})
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 3500000)
		decoder := json.NewDecoder(r.Body)
		if err = decoder.Decode(&body); err != nil {
			var large *http.MaxBytesError
			if errors.As(err, &large) {
				reply(w, 413, map[string]string{"error": "Слишком большой запрос."})
			} else {
				h.fail(w, model.Bad("Некорректный JSON."))
			}
			return
		}
		var extra any
		if decoder.Decode(&extra) != io.EOF {
			h.fail(w, model.Bad("Некорректный JSON."))
			return
		}
	}
	if action == "setup" || action == "login" {
		if !write || r.Method != http.MethodPost {
			reply(w, 405, map[string]string{"error": "Нужен POST."})
			return
		}
		if action == "setup" {
			if !h.localSetup(r) {
				h.fail(w, model.ErrForbidden)
				return
			}
			if _, err = h.Service.Setup(ctx, body.Login, body.Password); err != nil {
				h.fail(w, err)
				return
			}
		}
		result, err := h.Service.Login(ctx, body.Login, body.Password, h.clientIP(r))
		if err != nil {
			h.fail(w, err)
			return
		}
		h.writeCookie(w, result.AccessToken, int(result.ExpiresIn))
		reply(w, 200, result)
		return
	}
	var principal model.Principal
	if raw != "" {
		principal, err = h.Service.Authenticate(ctx, raw)
	} else {
		err = model.ErrUnauthorized
	}
	if action == "session" && !write {
		if err != nil && !errors.Is(err, model.ErrUnauthorized) {
			h.fail(w, err)
			return
		}
		var user *model.User
		if err == nil {
			user = &principal.User
		}
		setup := false
		if h.localSetup(r) {
			exists, e := h.Service.Users.HasTeacher(ctx)
			if e != nil {
				h.fail(w, e)
				return
			}
			setup = !exists
		}
		reply(w, 200, map[string]any{"user": user, "setupRequired": setup})
		return
	}
	if err != nil {
		h.fail(w, err)
		return
	}
	if action == "me" && !write {
		reply(w, 200, map[string]any{"user": principal.User})
		return
	}
	if action == "logout" && write {
		if err = h.Service.Sessions.DeleteSession(ctx, principal.SessionID); err != nil {
			h.fail(w, err)
			return
		}
		h.writeCookie(w, "", -1)
		reply(w, 200, map[string]bool{"ok": true})
		return
	}
	if action == "students" {
		if write {
			u, err := h.Service.CreateStudent(ctx, principal, body.Login, body.Password)
			if err != nil {
				h.fail(w, err)
				return
			}
			reply(w, 201, map[string]any{"student": u})
			return
		}
		users, err := h.Service.Students(ctx, principal)
		if err != nil {
			h.fail(w, err)
			return
		}
		reply(w, 200, map[string]any{"students": users})
		return
	}
	id := body.StudentID
	queryID := r.URL.Query().Get("studentId")
	pathID := r.PathValue("studentID")
	for _, other := range []string{queryID, pathID} {
		if other != "" {
			if id != "" && id != other {
				h.fail(w, model.ErrForbidden)
				return
			}
			id = other
		}
	}
	topic := body.TopicID
	if topic == "" {
		topic = r.URL.Query().Get("topicId")
	}
	if r.PathValue("boardID") != "" {
		if topic != "" && topic != r.PathValue("boardID") {
			h.fail(w, model.Bad("Некорректная доска."))
			return
		}
		topic = r.PathValue("boardID")
	}
	if len(topic) > 80 {
		h.fail(w, model.Bad("Некорректная доска."))
		return
	}
	switch action {
	case "password":
		if !write {
			break
		}
		err = h.Service.ResetPassword(ctx, principal, id, body.Password)
	case "profile":
		if write {
			err = h.Service.SaveProfile(ctx, principal, id, body.Schedule, body.Lessons, body.Calendar)
		} else {
			profile, e := h.Service.Profile(ctx, principal, id)
			if e != nil {
				h.fail(w, e)
				return
			}
			reply(w, 200, profile)
			return
		}
	case "topics":
		if !write {
			topics, e := h.Service.Topics(ctx, principal, id)
			if e != nil {
				h.fail(w, e)
				return
			}
			reply(w, 200, map[string]any{"topics": topics})
			return
		}
		if operation == "" {
			operation = body.Operation
		}
		if operation == "" && strings.HasPrefix(r.URL.Path, "/api/v1/") {
			operation = "create"
		}
		switch operation {
		case "create":
			t, e := h.Service.CreateTopic(ctx, principal, id, body.Title, body.Document)
			if e != nil {
				h.fail(w, e)
				return
			}
			reply(w, 201, map[string]any{"topic": t})
			return
		case "rename":
			err = h.Service.RenameTopic(ctx, principal, id, topic, body.Title)
		case "delete":
			err = h.Service.DeleteTopic(ctx, principal, id, topic)
		case "reorder":
			err = h.Service.ReorderTopics(ctx, principal, id, body.IDs)
		default:
			err = model.Bad("Неизвестное действие.")
		}
	case "board":
		if write {
			if body.Notebook == nil || body.Revision == nil {
				h.fail(w, model.Bad("Нужны notebook и revision."))
				return
			}
			revision, e := h.Service.SaveBoard(ctx, principal, id, topic, *body.Notebook, *body.Revision)
			if e != nil {
				h.fail(w, e)
				return
			}
			reply(w, 200, map[string]int64{"revision": revision})
			return
		}
		book, e := h.Service.Board(ctx, principal, id, topic)
		if e != nil {
			h.fail(w, e)
			return
		}
		reply(w, 200, book)
		return
	case "asset":
		asset := body.AssetID
		if asset == "" {
			asset = r.URL.Query().Get("assetId")
		}
		part := 0
		if body.Part != nil {
			part = *body.Part
		} else if value := r.URL.Query().Get("part"); value != "" {
			part, err = strconv.Atoi(value)
			if err != nil {
				h.fail(w, model.Bad("Некорректная часть файла."))
				return
			}
		}
		if write {
			data, e := base64.StdEncoding.DecodeString(body.Data)
			if e != nil {
				h.fail(w, model.Bad("Некорректные данные файла."))
				return
			}
			err = h.Service.PutAsset(ctx, principal, id, asset, part, body.Total, body.Mime, data)
		} else {
			a, e := h.Service.Asset(ctx, principal, id, asset, part)
			if e != nil {
				h.fail(w, e)
				return
			}
			reply(w, 200, map[string]any{"data": base64.StdEncoding.EncodeToString(a.Data), "total": a.Total, "mime": a.Mime})
			return
		}
	default:
		h.fail(w, model.ErrNotFound)
		return
	}
	if err != nil {
		h.fail(w, err)
		return
	}
	reply(w, 200, map[string]bool{"ok": true})
}

// Only the private Caddy address may supply the client IP used for login limits.
func (h *Handler) clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	peer, err := netip.ParseAddr(host)
	if err != nil {
		return host
	}
	for _, prefix := range h.Config.TrustedProxies {
		if prefix.Contains(peer.Unmap()) {
			if forwarded, err := netip.ParseAddr(r.Header.Get("X-Real-IP")); err == nil {
				return forwarded.Unmap().String()
			}
		}
	}
	return peer.Unmap().String()
}
