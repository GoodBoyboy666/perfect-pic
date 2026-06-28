package handler

import (
	"net/http"
	"perfect-pic-server/internal/common/httpx"
	"perfect-pic-server/internal/service"

	"github.com/gin-gonic/gin"
)

// GetServerStats 获取服务器概览统计信息
func (h *SystemHandler) GetServerStats(c *gin.Context) {
	stats, err := service.AdminGetServerStats(h.imageStore, h.userStore)
	if err != nil {
		httpx.WriteServiceError(c, err, "统计图片数据失败")
		return
	}

	c.JSON(http.StatusOK, stats)
}
