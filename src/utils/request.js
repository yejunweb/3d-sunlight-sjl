import axios from 'axios'
import { tokenStore } from '@/utils/stores'


// 创建 axios 实例
const request = axios.create({
  // API 请求的默认前缀
  // baseURL: "https://sunshine.trihorns.com",
  // baseURL: "http://sunshine.test.trihorns.com",
  // baseURL: "http://139.9.172.5",
  baseURL: "https://sunshine.profession.trihorns.com",
  // baseURL: "http://localhost:9099",
  timeout: 60000 // 请求超时时间
})

// 请求拦截器
request.interceptors.request.use(
	config => {
		// 在请求发送之前可以做一些处理，比如添加请求头等
    let store = tokenStore();
    const token =  store.token
    // 如果 token 存在
    // 让每个请求携带自定义 token 请根据实际情况自行修改
    if (token) {
      config.headers['Authorization'] = 'Bearer ' + token
    }
    return config
	},
	error => {
		// 请求错误处理
		return Promise.reject(error);
	}
);

// response interceptor
// request.interceptors.response.use((response) => {
//   return response.data
// }, errorHandler)

// const installer = {
//   vm: {},
//   install (Vue) {
//     Vue.use(VueAxios, request)
//   }
// }

export default request

export {
  request as axios
}
