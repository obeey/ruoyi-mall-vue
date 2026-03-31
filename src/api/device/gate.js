import request from '@/utils/request'

// 下发闸机控制命令
export function controlGate(data) {
  return request({
    url: '/device/gate/control',
    method: 'post',
    data: data
  })
}

// 下发闸机人员人脸配置
export function insertGatePerson(data) {
  return request({
    url: '/device/gate/person/insert',
    method: 'post',
    data: data
  })
}
