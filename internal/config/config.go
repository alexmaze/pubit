package config

import (
	"os"
	"strings"
)

type Config struct {
	Listen      string
	DataDir     string
	BaseURL     string
	AdminUser   string
	AdminPass   string
	AgentToken  string
}

func Load() Config {
	c := Config{
		Listen:     env("PUBIT_LISTEN", ":8080"),
		DataDir:    env("PUBIT_DATA", "./data"),
		BaseURL:    strings.TrimRight(env("PUBIT_BASE_URL", "http://localhost:8080"), "/"),
		AdminUser:  env("PUBIT_ADMIN_USER", "admin"),
		AdminPass:  env("PUBIT_ADMIN_PASSWORD", "admin"),
		AgentToken: env("PUBIT_AGENT_TOKEN", "change-me"),
	}
	return c
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
