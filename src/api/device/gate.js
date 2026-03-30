import request from '@/utils/request'

// 下发闸机控制命令
export function controlGate(data) {
  return request({
    url: '/device/gate/control',
    method: 'post',
    data: data
  })
}
