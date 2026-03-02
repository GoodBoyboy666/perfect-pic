package di

import (
	"perfect-pic-server/internal/config"
	"perfect-pic-server/internal/router"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type Application struct {
	Router   *router.Router
	DbConfig *config.DBConfig
	GormDB   *gorm.DB
	RedisDB  *redis.Client
}

func NewApplication(r *router.Router, dbConfig *config.DBConfig, gormDB *gorm.DB, redisDB *redis.Client) *Application {
	return &Application{
		Router:   r,
		DbConfig: dbConfig,
		GormDB:   gormDB,
		RedisDB:  redisDB,
	}
}
