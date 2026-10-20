.PHONY: db run test check

db:
	./scripts/dev.sh db
run:
	./scripts/dev.sh api
test:
	./scripts/dev.sh test
check:
	./scripts/go.sh vet ./...
	./scripts/go.sh build ./cmd/api ./cmd/admin
