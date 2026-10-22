package handler_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
	"ulianaa.math/backend/internal/auth"
	"ulianaa.math/backend/internal/config"
	"ulianaa.math/backend/internal/handler"
	"ulianaa.math/backend/internal/model"
	"ulianaa.math/backend/internal/repository/postgres"
	"ulianaa.math/backend/internal/service"
	"ulianaa.math/backend/migrations"
)

type client struct {
	t      *testing.T
	http   *http.Client
	origin string
}

func (c client) call(method, path string, data any, status int) map[string]json.RawMessage {
	c.t.Helper()
	var body io.Reader
	if data != nil {
		b, e := json.Marshal(data)
		if e != nil {
			c.t.Fatal(e)
		}
		body = bytes.NewReader(b)
	}
	r, e := http.NewRequest(method, c.origin+path, body)
	if e != nil {
		c.t.Fatal(e)
	}
	if data != nil {
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", c.origin)
	}
	response, e := c.http.Do(r)
	if e != nil {
		c.t.Fatal(e)
	}
	defer response.Body.Close()
	raw, _ := io.ReadAll(response.Body)
	if response.StatusCode != status {
		c.t.Fatalf("%s %s: want %d, got %d: %s", method, path, status, response.StatusCode, raw)
	}
	var out map[string]json.RawMessage
	if e = json.Unmarshal(raw, &out); e != nil {
		c.t.Fatalf("invalid JSON: %s", raw)
	}
	return out
}
func decode[T any](t *testing.T, raw json.RawMessage) T {
	t.Helper()
	var out T
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}
func TestPostgresHTTPWorkflow(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to run real PostgreSQL integration tests")
	}
	ctx := context.Background()
	root, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer root.DB.Close()
	schema := "integration_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err = root.DB.ExecContext(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer root.DB.ExecContext(ctx, "DROP SCHEMA "+schema+" CASCADE")
	parsed, _ := url.Parse(dsn)
	q := parsed.Query()
	q.Set("search_path", schema)
	parsed.RawQuery = q.Encode()
	store, err := postgres.Open(ctx, parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	defer store.DB.Close()
	for i := 0; i < 2; i++ {
		if err = migrations.Apply(ctx, store.DB); err != nil {
			t.Fatal(err)
		}
	}
	tokens := auth.Tokens{Key: []byte(strings.Repeat("test-key-", 8)), Issuer: "integration", Audience: "frontend", TTL: time.Hour}
	svc := &service.Service{Users: store, Sessions: store, Boards: store, Assets: store, Profiles: store, Tokens: tokens}
	h := &handler.Handler{Service: svc, Config: config.Config{LocalSetup: true}, Ping: store.DB.PingContext, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	server := httptest.NewServer(h.Routes())
	defer server.Close()
	h.Config.Origins = []string{server.URL}
	makeClient := func() client { jar, _ := cookiejar.New(nil); return client{t, &http.Client{Jar: jar}, server.URL} }
	teacher, student, other := makeClient(), makeClient(), makeClient()
	teacher.call("GET", "/readyz", nil, 200)
	setup := teacher.call("GET", "/api/account?action=session", nil, 200)
	if !decode[bool](t, setup["setupRequired"]) {
		t.Fatal("missing setup")
	}
	login := teacher.call("POST", "/api/account?action=setup", map[string]any{"login": "teacher", "password": "Teacher-test-12345"}, 200)
	jwtToken := decode[string](t, login["accessToken"])
	if len(strings.Split(jwtToken, ".")) != 3 {
		t.Fatal("not a JWT")
	}
	cookies := teacher.http.Jar.Cookies(mustURL(server.URL + "/api/account"))
	if len(cookies) == 0 {
		t.Fatal("missing auth cookie")
	}
	created := teacher.call("POST", "/api/v1/students", map[string]any{"login": "student01", "password": "Student-test-12345", "role": "teacher"}, 201)
	u := decode[model.User](t, created["student"])
	if u.Role != "student" {
		t.Fatal("role injection")
	}
	second := teacher.call("POST", "/api/account?action=students", map[string]any{"login": "student02", "password": "Student-test-12345"}, 201)
	otherID := decode[model.User](t, second["student"]).ID
	student.call("POST", "/api/v1/auth/login", map[string]any{"login": "student01", "password": "Student-test-12345"}, 200)
	student.call("GET", "/api/v1/students", nil, 403)
	student.call("GET", "/api/account?action=board&studentId="+otherID, nil, 403)
	other.call("GET", "/api/account?action=board&studentId="+u.ID, nil, 401)
	path := "/api/account?action=board&studentId=" + u.ID
	initial := student.call("GET", path, nil, 200)
	rev := decode[int64](t, initial["revision"])
	if rev != 0 {
		t.Fatal("initial revision")
	}
	notebook := model.Notebook{PageCount: 3, Items: []json.RawMessage{json.RawMessage(`{"id":"cube","type":"viz-cube","page":1,"rotation":[15,30,0],"points":[[80,80],[1520,980]],"color":"#2f493f","size":4,"edgePoints":[{"id":"M","edge":[0,1],"t":0.5,"label":"M"}],"customFutureField":{"preserve":true}}`), json.RawMessage(`{"id":"ink","type":"pen","page":0,"color":"#212123","size":4,"points":[[10,10],[20,25]]}`)}}
	result := student.call("POST", path, map[string]any{"notebook": notebook, "revision": rev}, 200)
	if decode[int64](t, result["revision"]) != 1 {
		t.Fatal("revision not incremented")
	}
	teacher.call("POST", path, map[string]any{"notebook": notebook, "revision": rev}, 409)
	loaded := teacher.call("GET", path, nil, 200)
	stored := decode[model.Notebook](t, loaded["notebook"])
	if len(stored.Items) != 2 || stored.PageCount != 3 {
		t.Fatal("lost pages")
	}
	for i := range notebook.Items {
		a, b := decode[map[string]any](t, notebook.Items[i]), decode[map[string]any](t, stored.Items[i])
		ja, _ := json.Marshal(a)
		jb, _ := json.Marshal(b)
		if !bytes.Equal(ja, jb) {
			t.Fatal("changed drawing fields or order")
		}
	}
	var pages int
	if err = store.DB.QueryRowContext(ctx, "SELECT count(*) FROM pages WHERE student_id=$1 AND board_id='main'", u.ID).Scan(&pages); err != nil || pages != 3 {
		t.Fatalf("not every page persisted: %d %v", pages, err)
	}
	bad := model.Notebook{PageCount: 1, Items: []json.RawMessage{json.RawMessage(`{"id":"bad","type":"pen","page":1}`)}}
	student.call("POST", path, map[string]any{"notebook": bad, "revision": 1}, 400)
	// Concurrent transactions: one succeeds, the stale writer receives a conflict.
	var wg sync.WaitGroup
	codes := make(chan int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, e := svc.SaveBoard(ctx, model.Principal{User: u}, u.ID, "main", notebook, 1)
			status := 200
			if e != nil {
				status, _ = model.Status(e)
			}
			codes <- status
		}()
	}
	wg.Wait()
	close(codes)
	counts := map[int]int{}
	for status := range codes {
		counts[status]++
	}
	if counts[200] != 1 || counts[409] != 1 {
		t.Fatalf("concurrent save: %v", counts)
	}
	topic := teacher.call("POST", "/api/account?action=topics", map[string]any{"studentId": u.ID, "operation": "create", "title": "16 тип ОГЭ"}, 201)
	topicID := decode[model.Topic](t, topic["topic"]).ID
	student.call("POST", "/api/account?action=topics", map[string]any{"operation": "rename", "topicId": topicID, "title": "Denied"}, 403)
	teacher.call("PATCH", "/api/v1/students/"+u.ID+"/boards/"+topicID, map[string]any{"title": "Геометрия"}, 200)
	student.call("POST", "/api/account?action=topics", map[string]any{"operation": "delete", "topicId": topicID}, 403)
	teacher.call("POST", "/api/account?action=topics", map[string]any{"studentId": u.ID, "operation": "delete", "topicId": "main"}, 400)
	teacher.call("POST", "/api/account?action=topics", map[string]any{"studentId": u.ID, "operation": "delete", "topicId": topicID}, 200)
	student.call("GET", "/api/account?action=board&topicId="+topicID, nil, 404)
	teacher.call("POST", "/api/account?action=topics", map[string]any{"studentId": u.ID, "operation": "delete", "topicId": topicID}, 404)
	pdf := []byte("%PDF-1.7\noriginal lesson bytes")
	asset := uuid.NewString()
	body := map[string]any{"studentId": u.ID, "assetId": asset, "part": 0, "total": 1, "mime": "application/pdf", "data": base64.StdEncoding.EncodeToString(pdf)}
	teacher.call("POST", "/api/account?action=asset", body, 200)
	teacher.call("POST", "/api/account?action=asset", body, 200)
	body["data"] = base64.StdEncoding.EncodeToString([]byte("different"))
	teacher.call("POST", "/api/account?action=asset", body, 409)
	a := student.call("GET", "/api/account?action=asset&assetId="+asset, nil, 200)
	if decode[string](t, a["data"]) != base64.StdEncoding.EncodeToString(pdf) {
		t.Fatal("asset changed")
	}
	lesson := map[string]any{"date": "2026-10-19", "grade": 10, "homework": 90, "note": "Хорошо", "attachment": map[string]any{"assetId": asset, "name": "Урок.pdf", "size": len(pdf)}}
	teacher.call("POST", "/api/account?action=profile", map[string]any{"studentId": u.ID, "schedule": []any{}, "lessons": []any{lesson}}, 200)
	student.call("GET", "/api/account?action=profile", nil, 200)
	// JWTs remain valid across service/database reconnects; logout revokes the current token.
	reopened, e := postgres.Open(ctx, parsed.String())
	if e != nil {
		t.Fatal(e)
	}
	defer reopened.DB.Close()
	copySvc := *svc
	copySvc.Sessions = reopened
	if _, e = copySvc.Authenticate(ctx, jwtToken); e != nil {
		t.Fatalf("JWT lost on reconnect: %v", e)
	}
	student.call("POST", "/api/v1/auth/logout", map[string]any{}, 200)
	student.call("GET", path, nil, 401)
	request, _ := http.NewRequest("GET", server.URL+"/api/v1/auth/me", nil)
	request.Header.Set("Authorization", "Bearer "+jwtToken)
	response, e := http.DefaultClient.Do(request)
	if e != nil {
		t.Fatal(e)
	}
	response.Body.Close()
	if response.StatusCode != 200 {
		t.Fatal("Bearer JWT rejected")
	}
	request, _ = http.NewRequest("POST", server.URL+"/api/account?action=logout", strings.NewReader("{}"))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://evil.example")
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}
	response, e = http.DefaultClient.Do(request)
	if e != nil {
		t.Fatal(e)
	}
	response.Body.Close()
	if response.StatusCode != 403 {
		t.Fatal("cross-origin write accepted")
	}
	teacher.call("POST", "/api/account?action=password", map[string]any{"studentId": u.ID, "password": "Changed-pass-12345"}, 200)
	student.call("POST", "/api/v1/auth/login", map[string]any{"login": "student01", "password": "Student-test-12345"}, 401)
	var triggers int
	if err = store.DB.QueryRowContext(ctx, "SELECT count(*) FROM information_schema.triggers WHERE trigger_schema=$1", schema).Scan(&triggers); err != nil || triggers != 0 {
		t.Fatalf("unexpected database triggers: %d %v", triggers, err)
	}
	if err = store.ImportEmpty(ctx, model.Snapshot{Version: 1}); err == nil {
		t.Fatal("import overwrote a nonempty database")
	}
	t.Log(fmt.Sprintf("PostgreSQL pages, assets, JWT, roles, revisions, profile, concurrent writes and trigger-free migrations passed (%s)", schema))
}
func mustURL(raw string) *url.URL { u, _ := url.Parse(raw); return u }
