package di

import (
	"perfect-pic-server/internal/config"
	"perfect-pic-server/internal/router"

	"gorm.io/gorm"
)

type Application struct {
	Router   *router.Router
	DbConfig *config.DBConfig
	GormDB   *gorm.DB
}

func NewApplication(r *router.Router, dbConfig *config.DBConfig, gormDB *gorm.DB) *Application {
	return &Application{
		Router:   r,
		DbConfig: dbConfig,
		GormDB:   gormDB,
	}
}
