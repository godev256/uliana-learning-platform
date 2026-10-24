package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"ulianaa.math/backend/internal/model"
)

func verifyLiveBoard(t *testing.T, teacher, student, other client, studentID, otherID string) {
	t.Helper()
	topic := decode[model.Topic](t, teacher.call("POST", "/api/account?action=topics", map[string]any{"studentId": studentID, "operation": "create", "title": "Realtime integration"}, 201)["topic"])
	path := "/api/account?action=board&studentId=" + studentID + "&topicId=" + topic.ID
	dial := func(c client, id, origin string) (*websocket.Conn, *http.Response, error) {
		headers := http.Header{"Origin": []string{origin}}
		for _, cookie := range c.http.Jar.Cookies(mustURL(c.origin + "/api/board/live")) {
			headers.Add("Cookie", cookie.String())
		}
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		return websocket.Dial(ctx, "ws"+strings.TrimPrefix(c.origin, "http")+"/api/board/live?studentId="+id+"&topicId="+topic.ID+"&clientId=live-integration-client", &websocket.DialOptions{HTTPHeader: headers})
	}
	for _, denied := range []struct {
		c          client
		id, origin string
		status     int
	}{{other, studentID, teacher.origin, 401}, {student, otherID, teacher.origin, 403}, {teacher, studentID, "https://untrusted.invalid", 403}} {
		conn, response, err := dial(denied.c, denied.id, denied.origin)
		if conn != nil {
			conn.CloseNow()
		}
		if err == nil || response == nil || response.StatusCode != denied.status {
			t.Fatalf("unauthorized live connection accepted: %v", err)
		}
	}
	tc, _, err := dial(teacher, studentID, teacher.origin)
	if err != nil {
		t.Fatal(err)
	}
	defer tc.CloseNow()
	sc, _, err := dial(student, studentID, student.origin)
	if err != nil {
		t.Fatal(err)
	}
	defer sc.CloseNow()
	read := func(c *websocket.Conn, kind string) map[string]json.RawMessage {
		t.Helper()
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		for {
			var message map[string]json.RawMessage
			if err := wsjson.Read(ctx, c, &message); err != nil {
				t.Fatal(err)
			}
			if decode[string](t, message["type"]) == kind {
				return message
			}
		}
	}
	read(tc, "ready")
	read(sc, "ready")
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := wsjson.Write(ctx, tc, map[string]any{"type": "cursor", "cursor": map[string]any{"page": 0, "x": 123, "y": 456}, "role": "student"}); err != nil {
		t.Fatal(err)
	}
	cursor := read(sc, "cursor")
	if decode[string](t, cursor["role"]) != "teacher" {
		t.Fatal("cursor role was not authenticated")
	}
	if time.Since(start) > time.Second {
		t.Fatal("cursor relay waited for polling")
	}
	// Large existing notebook must not appear in either the write or live response.
	large := model.Notebook{PageCount: 12, Items: []json.RawMessage{json.RawMessage(`{"id":"background","type":"rect","page":11,"text":"` + strings.Repeat("x", 300000) + `"}`)}}
	teacher.call("POST", path, map[string]any{"studentId": studentID, "topicId": topic.ID, "notebook": large, "revision": 0}, 200)
	read(sc, "commit")
	for revision := int64(1); revision <= 4; revision++ {
		patch := model.BoardPatch{PageCount: 12, Upsert: []json.RawMessage{json.RawMessage(`{"id":"ink","type":"pen","page":0,"points":[[1,1],[` + jsonNumber(revision) + `,2]]}`)}, Remove: []string{}}
		start = time.Now()
		result := teacher.call("POST", path, map[string]any{"studentId": studentID, "topicId": topic.ID, "patch": patch, "revision": revision}, 200)
		if decode[int64](t, result["revision"]) != revision+1 {
			t.Fatal("patch not committed")
		}
		commit := read(sc, "commit")
		if decode[int64](t, commit["revision"]) != revision+1 || len(commit["patch"]) > 1024 {
			t.Fatal("live response resent the whole notebook")
		}
		if time.Since(start) > time.Second {
			t.Fatal("live ink waited for polling")
		}
	}
	deltas := student.call("GET", path+"&since=1&patches=1", nil, 200)
	if len(decode[[]json.RawMessage](t, deltas["patches"])) != 4 || len(deltas["notebook"]) != 0 {
		t.Fatal("missed revisions did not use patch replay")
	}
	teacher.call("POST", path, map[string]any{"studentId": studentID, "topicId": topic.ID, "patch": model.BoardPatch{PageCount: 1}, "revision": 5}, 400)
	teacher.call("POST", path, map[string]any{"studentId": studentID, "topicId": topic.ID, "patch": model.BoardPatch{PageCount: 12}, "revision": 1}, 409)
	saved := decode[model.Notebook](t, student.call("GET", path, nil, 200)["notebook"])
	if len(saved.Items) != 2 || len(saved.Items[0]) < 300000 {
		t.Fatal("patch damaged pre-existing pages")
	}
	// Explicit full read after reconnect is authoritative even when replay cache is gone.
	if err := sc.Close(websocket.StatusNormalClosure, ""); err != nil {
		t.Fatal(err)
	}
	sc, _, err = dial(student, studentID, student.origin)
	if err != nil {
		t.Fatal(err)
	}
	defer sc.CloseNow()
	ready := read(sc, "ready")
	if decode[int64](t, ready["revision"]) != 5 {
		t.Fatal("reconnect revision is stale")
	}
}
func jsonNumber(n int64) string { b, _ := json.Marshal(n); return string(b) }
