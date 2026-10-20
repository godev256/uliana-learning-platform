FROM golang:1.27.2-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/api ./cmd/api
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/admin ./cmd/admin
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/import-local ./cmd/import-local

FROM alpine:3.22
RUN apk add --no-cache ca-certificates && addgroup -S app && adduser -S app -G app
LABEL org.opencontainers.image.source="https://github.com/godev256/uliana-learning-platform"
WORKDIR /app
COPY --from=build /out/api /out/admin /out/import-local ./
USER app
EXPOSE 8081
ENTRYPOINT ["/app/api"]
