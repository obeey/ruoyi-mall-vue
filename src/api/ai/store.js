import request from '@/utils/request'

export function listAiStore(query, pageReq) {
  return request({
    url: '/ai/store/list',
    method: 'post',
    data: query,
    params: pageReq
  })
}

export function getAiStore(id) {
  return request({
    url: `/ai/store/${id}`,
    method: 'get'
  })
}

export function updateAiStore(data) {
  return request({
    url: '/ai/store',
    method: 'put',
    data
  })
}

export function getAiStoreLayout(id) {
  return request({
    url: `/ai/store/${id}/layout`,
    method: 'get'
  })
}

export function updateAiStoreLayout(id, data) {
  return request({
    url: `/ai/store/${id}/layout`,
    method: 'put',
    data
  })
}

export function listManagerCandidates(keyword) {
  return request({
    url: '/ai/store/managerCandidates',
    method: 'get',
    params: { keyword }
  })
}

export function assignStoreManager(data) {
  return request({
    url: '/ai/store/assignManager',
    method: 'post',
    data
  })
}
