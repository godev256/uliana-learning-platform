package handler

import (
	"sync"
	"testing"
	"time"
)

func TestCursorRoomsAndExpiry(t *testing.T) {
	var store cursorStore
	now := time.Now()
	a := boardCursor{Page: 0, X: 200, Y: 300}
	b := boardCursor{Page: 2, X: 400, Y: 500}
	if len(store.exchange("pupil:board-a", "teacher-client", "teacher", &a, now)) != 0 {
		t.Fatal("own cursor must be excluded")
	}
	peers := store.exchange("pupil:board-a", "pupil-client", "student", &b, now)
	if len(peers) != 1 || peers[0].Role != "teacher" || peers[0].Cursor != a {
		t.Fatal("teacher cursor missing")
	}
	if len(store.exchange("pupil:board-b", "observer", "student", nil, now)) != 0 || len(store.exchange("other-pupil:board-a", "observer", "student", nil, now)) != 0 {
		t.Fatal("cursor leaked across workspaces")
	}
	peers = store.exchange("pupil:board-a", "teacher-client", "teacher", nil, now)
	if len(peers) != 1 || peers[0].Cursor != b {
		t.Fatal("hide must remove only this client")
	}
	if len(store.exchange("pupil:board-a", "observer", "teacher", nil, now.Add(5*time.Second))) != 0 {
		t.Fatal("disconnected cursor did not expire")
	}
	var wg sync.WaitGroup
	for range 20 {
		wg.Add(1)
		go func() { defer wg.Done(); store.exchange("room", "actor", "student", &a, now) }()
	}
	wg.Wait()
}
