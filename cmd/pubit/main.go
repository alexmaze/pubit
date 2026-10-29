package main

import (
	"log/slog"
	"net/http"
	"os"
	"path/filepath"

	"pubit/internal/auth"
	"pubit/internal/config"
	"pubit/internal/server"
	"pubit/internal/store"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	cfg := config.Load()

	if err := os.MkdirAll(filepath.Join(cfg.DataDir, "sites"), 0o755); err != nil {
		log.Error("mkdir data", "err", err)
		os.Exit(1)
	}
	st, err := store.Open(filepath.Join(cfg.DataDir, "pubit.db"))
	if err != nil {
		log.Error("open db", "err", err)
		os.Exit(1)
	}
	defer st.Close()

	srv := server.New(cfg, st, auth.New(cfg.AdminUser, cfg.AdminPass, cfg.AgentToken), log)
	log.Info("pubit listening", "addr", cfg.Listen, "data", cfg.DataDir)
	if err := http.ListenAndServe(cfg.Listen, srv.Handler()); err != nil {
		log.Error("listen", "err", err)
		os.Exit(1)
	}
}
