import request from '@/utils/request';

/**
 * 使用添加用户信息接口
 * @param data
 */
export function getHistoryDetail(historyId) {
  return request({
    url: `/api/historyDetail?historyId=${historyId}`,
    method: 'get',

  });
}

export function getCommunityDetail(communityCode) {
  return request({
    url: `/api/residential/detail/${communityCode}`,
    method: 'get',
  });
}

export function getRoadByCode(code) {
  return request({
    url: `/api/residentialRoad/list/bycode?code=${code}`,
    method: 'get',
  }); 
}

export function getHouseSunshineData(code,solarTerm) {
  return request({
    url: `/api/rSunshineData/residentialSunshineData/solarTerm?residentialCode=${code}&solarTerm=${solarTerm}`,
    method: 'get',
  });
}

export function saveFieldData(fieldDataList) {
  return request({
    url: `/api/fieldData/save/batch`,
    method: 'post',
    params: fieldDataList
  });
}

export function getFieldData(code) {
  return request({
    url: `/api/fieldData/query/ByCode?code=${code}`,
    method: 'get',
  });
}

export function isMember(code) {
  return request({
    url: `/api/residential/isMember?code=${code}`,
    method: 'get',
  });
}

/**
 * 使用添加窗前光影表格查询接口
 * @param data
 */
export function getSunshineWindowList(historyId) {
  return request({
    url: `/api/sunshineHistoryWindow/sunshineWindowList?historyId=${historyId}`,
    method: 'get',
    
  });
}

/**
 * 使用添加窗前光影面积计算接口
 * @param data
 */
export function getDailyWindowSunShineArea(historyId, dateStr) {
  return request({
    url: `/api/sunshineHistoryWindow/historyWindowSunShineArea?historyId=${historyId}&dateStr=${dateStr}`,
    method: 'get',
  });
}

/**
 * 获取用户会员充值记录接口
 * @param data
 */
export function getMemberRechargeRecords() {
  return request({
    url: `/api/memberRechargeRecords/queryRecords`,
    method: 'get',
    header: {
      'Content-Type': 'application/json'
    },
  });
}

export function selectDistancesInfo(code) {
  return request({
    url: `/api/buildingDistance/distancesInfo?code=${code}`,
    method: 'get',
  });
}

export function getResidentialByCode(code) {
  return request({
    url: `/api/residential/getResidentialByCode?code=${code}`,
    method: 'get',
  });
}