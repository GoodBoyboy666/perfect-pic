package service

import (
	platformservice "perfect-pic-server/internal/common"
	moduledto "perfect-pic-server/internal/dto"
	repo "perfect-pic-server/internal/repository"
	"runtime"
)

// AdminGetServerStats 获取后台仪表盘统计数据。
func AdminGetServerStats(imageStore repo.ImageStore, userStore repo.UserStore) (*moduledto.ServerStatsResponse, error) {
	imageCount, err := imageStore.CountAll()
	if err != nil {
		return nil, platformservice.NewInternalError("统计图片数据失败")
	}

	totalSize, err := imageStore.SumAllSize()
	if err != nil {
		return nil, platformservice.NewInternalError("统计图片数据失败")
	}

	userCount, err := userStore.CountAll()
	if err != nil {
		return nil, platformservice.NewInternalError("统计用户数据失败")
	}

	return &moduledto.ServerStatsResponse{
		ImageCount:   imageCount,
		StorageUsage: totalSize,
		UserCount:    userCount,
		SystemInfo: moduledto.SystemInfoResponse{
			OS:           runtime.GOOS,
			Arch:         runtime.GOARCH,
			GoVersion:    runtime.Version(),
			NumCPU:       runtime.NumCPU(),
			NumGoroutine: runtime.NumGoroutine(),
		},
	}, nil
}
